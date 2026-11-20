import { CurrentTenant, CurrentUser, Permissions } from '@crm/auth';
import type { TokenPayload } from '@crm/auth';
import { Body, Controller, Delete, Get, HttpStatus, Inject, Put } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

import { PERMISSIONS } from '../../common/constants/permissions.constants';
import { AppException } from '../../common/exceptions/app.exception';
import { buildStorageProvider, DynamicStorageProvider } from '../storage/dynamic-storage.provider';
import { STORAGE_PROVIDER } from '../storage/storage.constants';
import { ZoomService } from '../zoom/zoom.service';

import { ConnectionSettingsService, STORAGE, ZOOM, type StorageSettings } from './connection-settings.service';

export class SaveZoomDto {
  @IsString() @MaxLength(200) accountId!: string;
  @IsString() @MaxLength(200) clientId!: string;
  @IsOptional() @IsString() @MaxLength(500) clientSecret?: string;
}

export class SaveStorageDto {
  @IsIn(['gdrive', 's3', 'r2', 'minio', 'local']) provider!: StorageSettings['provider'];
  @IsOptional() @IsString() @MaxLength(300) bucket?: string;
  @IsOptional() @IsString() @MaxLength(100) region?: string;
  @IsOptional() @IsString() @MaxLength(500) endpoint?: string;
  @IsOptional() @IsBoolean() forcePathStyle?: boolean;
  @IsOptional() @IsString() @MaxLength(500) accessKeyId?: string;
  @IsOptional() @IsString() @MaxLength(2000) secretAccessKey?: string;
  @IsOptional() @IsString() @MaxLength(500) driveClientId?: string;
  @IsOptional() @IsString() @MaxLength(2000) driveClientSecret?: string;
  @IsOptional() @IsString() @MaxLength(4000) driveRefreshToken?: string;
  @IsOptional() @IsString() @MaxLength(500) driveFolderId?: string;
}

/** A secret is never sent back: only that it is set, and the last four characters to recognise it. */
const mask = (value?: string | null) => (value ? `${'•'.repeat(8)}${value.length > 8 ? value.slice(-4) : ''}` : null);

/** Settings → Connections: Zoom and File storage, for an administrator. */
@ApiTags('connections')
@ApiBearerAuth()
@Controller('connections')
export class ConnectionsController {
  constructor(
    private readonly settings: ConnectionSettingsService,
    private readonly zoom: ZoomService,
    private readonly config: ConfigService,
    @Inject(STORAGE_PROVIDER) private readonly storage: unknown,
  ) {}

  // ---- Zoom ---------------------------------------------------------------------------------------------------

  private async zoomView(organisationId: string) {
    const credentials = this.settings.zoomCredentials();
    return {
      connected: credentials !== null,
      source: this.settings.zoomSource(),
      accountId: credentials?.accountId ?? '',
      clientId: credentials?.clientId ?? '',
      clientSecret: mask(credentials?.clientSecret),
      savedAt: await this.settings.savedAt(organisationId, ZOOM),
    };
  }

  @Get('zoom')
  @Permissions(PERMISSIONS.USERS.MANAGE)
  getZoom(@CurrentTenant() organisationId: string) {
    return this.zoomView(organisationId);
  }

  @Put('zoom')
  @Permissions(PERMISSIONS.USERS.MANAGE)
  async saveZoom(@CurrentTenant() organisationId: string, @CurrentUser() user: TokenPayload, @Body() dto: SaveZoomDto) {
    const credentials = await this.settings.mergedZoom(organisationId, dto);
    if (!dto.accountId.trim() || !dto.clientId.trim() || !credentials) {
      throw new AppException('ZOOM_INCOMPLETE', 'Account ID, Client ID and Client Secret are all needed.', HttpStatus.UNPROCESSABLE_ENTITY);
    }
    // Zoom is asked first: wrong credentials are never saved
    await this.zoom.verify(credentials);
    await this.settings.saveZoom(organisationId, user.sub, dto);
    return this.zoomView(organisationId);
  }

  @Delete('zoom')
  @Permissions(PERMISSIONS.USERS.MANAGE)
  async clearZoom(@CurrentTenant() organisationId: string) {
    await this.settings.clear(organisationId, ZOOM);
    return this.zoomView(organisationId);
  }

  // ---- File storage -------------------------------------------------------------------------------------------

  private async storageView(organisationId: string) {
    const saved = this.settings.savedStorage();
    const effective = this.settings.effectiveStorage();
    return {
      source: saved ? ('settings' as const) : ('server' as const),
      provider: effective.provider,
      bucket: effective.bucket ?? '',
      region: effective.region ?? '',
      endpoint: effective.endpoint ?? '',
      forcePathStyle: Boolean(effective.forcePathStyle),
      accessKeyId: effective.accessKeyId ?? '',
      secretAccessKey: mask(effective.secretAccessKey),
      driveClientId: effective.driveClientId ?? '',
      driveClientSecret: mask(effective.driveClientSecret),
      driveRefreshToken: mask(effective.driveRefreshToken),
      driveFolderId: effective.driveFolderId ?? '',
      savedAt: await this.settings.savedAt(organisationId, STORAGE),
      // set when the main storage refused a file and this server's disk kept it: the storage needs to be reconnected
      fallback: this.storage instanceof DynamicStorageProvider ? this.storage.lastFallback : null,
    };
  }

  @Get('storage')
  @Permissions(PERMISSIONS.USERS.MANAGE)
  getStorage(@CurrentTenant() organisationId: string) {
    return this.storageView(organisationId);
  }

  @Put('storage')
  @Permissions(PERMISSIONS.USERS.MANAGE)
  async saveStorage(@CurrentTenant() organisationId: string, @CurrentUser() user: TokenPayload, @Body() dto: SaveStorageDto) {
    const merged = await this.settings.mergedStorage(organisationId, dto);
    this.assertComplete(merged);
    // the storage is tried before anything is saved: settings that cannot reach it are refused
    try {
      const provider = buildStorageProvider(merged, this.config);
      await provider.exists(`${organisationId}/.connection-check`);
    } catch (error) {
      throw new AppException('STORAGE_UNREACHABLE', `The storage could not be reached with these settings: ${(error as Error).message}`, HttpStatus.UNPROCESSABLE_ENTITY);
    }
    await this.settings.saveStorage(organisationId, user.sub, dto);
    return this.storageView(organisationId);
  }

  @Delete('storage')
  @Permissions(PERMISSIONS.USERS.MANAGE)
  async clearStorage(@CurrentTenant() organisationId: string) {
    await this.settings.clear(organisationId, STORAGE);
    return this.storageView(organisationId);
  }

  private assertComplete(s: StorageSettings): void {
    const missing: string[] = [];
    if (s.provider === 'gdrive') {
      if (!s.driveClientId) missing.push('Client ID');
      if (!s.driveClientSecret) missing.push('Client secret');
      if (!s.driveRefreshToken) missing.push('Refresh token');
      if (!s.driveFolderId) missing.push('Folder ID');
    } else if (s.provider !== 'local') {
      if (!s.bucket) missing.push('Bucket');
      if (!s.accessKeyId) missing.push('Access key ID');
      if (!s.secretAccessKey) missing.push('Secret access key');
    }
    if (missing.length) throw new AppException('STORAGE_INCOMPLETE', `Still needed: ${missing.join(', ')}.`, HttpStatus.UNPROCESSABLE_ENTITY);
  }
}
