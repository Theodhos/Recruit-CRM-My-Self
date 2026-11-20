import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { FxService } from './fx.service';

/** The exchange rates the forms use when a currency is changed. No @Permissions() gate: it is public market data. */
@ApiTags('fx')
@ApiBearerAuth()
@Controller('fx')
export class FxController {
  constructor(private readonly fx: FxService) {}

  @Get('rates')
  rates() {
    return this.fx.rates();
  }
}
