import { Module } from '@nestjs/common';

import { RegistrationRequestsController } from './controller/registration-requests.controller';
import { RegistrationRequestsService } from './service/registration-requests.service';

@Module({
  controllers: [RegistrationRequestsController],
  providers: [RegistrationRequestsService],
})
export class RegistrationRequestsModule {}
