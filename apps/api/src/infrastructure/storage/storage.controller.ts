import { createReadStream } from 'fs';
import { stat } from 'fs/promises';
import { join, resolve, sep } from 'path';

import { CurrentTenant, Permissions } from '@crm/auth';
import type { StorageProvider } from '@crm/storage';
import { Controller, Get, Inject, NotFoundException, Param, StreamableFile } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { PERMISSIONS } from '../../common/constants/permissions.constants';

import { resolveStorageLocalRoot } from './local-root';
import { STORAGE_PROVIDER } from './storage.constants';

/**
 * Only meaningful when STORAGE_PROVIDER=local (see LocalDiskStorageProvider
 * — real S3/R2/MinIO hand back their own presigned URL instead, and the
 * browser never touches this route for those). Keys are namespaced
 * `${organisationId}/...`, so the tenant-prefix check below is the whole
 * access-control story: no DB lookup, no risk of leaking another org's key
 * even if someone guesses/replays an encoded key.
 */
@ApiTags('storage')
@ApiBearerAuth()
@Controller('storage')
export class StorageController {
  constructor(
    private readonly config: ConfigService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}

  @Get('download/:encodedKey')
  @Permissions(PERMISSIONS.DOCUMENT.READ)
  async download(
    @CurrentTenant() organisationId: string,
    @Param('encodedKey') encodedKey: string,
  ): Promise<StreamableFile> {
    let key: string;
    try {
      key = Buffer.from(encodedKey, 'base64url').toString('utf-8');
    } catch {
      throw new NotFoundException('File not found.');
    }

    // The prefix alone is not enough: "org/../other-org/file" starts with the right prefix and still leaves the
    // tenant's folder. Every segment has to be a plain name.
    const segments = key.split('/');
    const unsafe = key.includes('\\') || key.includes('\0') || segments.some((segment) => segment === '' || segment === '.' || segment === '..');
    if (unsafe || segments[0] !== organisationId || segments.length < 2) {
      throw new NotFoundException('File not found.');
    }

    const filename = key.split('/').pop() ?? 'file';

    // Providers without presigned URLs (Google Drive) hand the bytes back; the tenant check above already ran.
    if (this.storage.getObject) {
      let file;
      try {
        file = await this.storage.getObject(key);
      } catch {
        throw new NotFoundException('File not found.');
      }
      if (!file) throw new NotFoundException('File not found.');
      return new StreamableFile(file.body, {
        type: file.contentType,
        disposition: `attachment; filename="${encodeURIComponent(filename)}"`,
      });
    }

    const root = resolve(resolveStorageLocalRoot(this.config));
    const filePath = resolve(root, key);
    if (!filePath.startsWith(join(root, organisationId) + sep)) {
      throw new NotFoundException('File not found.');
    }

    try {
      await stat(filePath);
    } catch {
      throw new NotFoundException('File not found.');
    }

    return new StreamableFile(createReadStream(filePath), {
      disposition: `attachment; filename="${encodeURIComponent(filename)}"`,
    });
  }
}
