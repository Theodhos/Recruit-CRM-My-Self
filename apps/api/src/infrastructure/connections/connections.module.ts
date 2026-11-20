import { Global, Module } from '@nestjs/common';

import { ZoomModule } from '../zoom/zoom.module';

import { ConnectionSettingsService } from './connection-settings.service';
import { ConnectionsController } from './connections.controller';

/** Settings → Connections: Zoom and File storage credentials, saved encrypted and applied without a restart. */
@Global()
@Module({
  imports: [ZoomModule],
  controllers: [ConnectionsController],
  providers: [ConnectionSettingsService],
  exports: [ConnectionSettingsService],
})
export class ConnectionsModule {}
