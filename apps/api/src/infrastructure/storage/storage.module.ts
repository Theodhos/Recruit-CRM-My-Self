import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { ConnectionSettingsService } from '../connections/connection-settings.service';

import { DynamicStorageProvider } from './dynamic-storage.provider';
import { STORAGE_PROVIDER } from './storage.constants';
import { StorageController } from './storage.controller';

/**
 * Global module exposing the abstracted StorageProvider (see packages/storage). Domain modules (candidates,
 * documents) inject STORAGE_PROVIDER and never import @aws-sdk/* directly. What it stores into is chosen in
 * Settings → Connections → File storage, or by the server's STORAGE_* settings when nothing is saved there, and can
 * be changed without a restart (see DynamicStorageProvider).
 */
@Global()
@Module({
  controllers: [StorageController],
  providers: [
    {
      provide: STORAGE_PROVIDER,
      useFactory: (settings: ConnectionSettingsService, config: ConfigService) => new DynamicStorageProvider(settings, config),
      inject: [ConnectionSettingsService, ConfigService],
    },
  ],
  exports: [STORAGE_PROVIDER],
})
export class StorageModule {}
