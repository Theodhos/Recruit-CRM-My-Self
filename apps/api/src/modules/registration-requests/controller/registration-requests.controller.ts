import { Public } from '@crm/auth';
import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { RegistrationRequestDto } from '../dto/registration-request.dto';
import { RegistrationRequestsService } from '../service/registration-requests.service';

@ApiTags('public')
@Controller('public')
export class RegistrationRequestsController {
  constructor(private readonly service: RegistrationRequestsService) {}

  @ApiOperation({
    summary: 'Ask for an account from the public home page',
    description: 'Unauthenticated. E-mails the details to the platform owner; nothing is created in the CRM.',
  })
  @Public()
  // Open to the internet and it sends e-mail: a tight per-client limit.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('registration-requests')
  @HttpCode(201)
  submit(@Body() dto: RegistrationRequestDto) {
    return this.service.submit(dto);
  }
}
