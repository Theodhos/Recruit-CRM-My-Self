import { CurrentTenant, CurrentUser } from '@crm/auth';
import type { TokenPayload } from '@crm/auth';
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { RequiresSection } from '../../../common/guards/section.guard';
import { ParseCuidPipe } from '../../../common/pipes/parse-cuid.pipe';
import { CreatePayslipDto, ListPayslipsQueryDto, UpdatePayslipDto } from '../dto';
import { PayslipsService } from '../service/payslips.service';

/** Pagesat is money, so it belongs to the admin, or to a user it was ticked for — like Fees and Retainers. */
@ApiTags('payslips')
@ApiBearerAuth()
@Controller('payslips')
@RequiresSection('/payslips')
export class PayslipsController {
  constructor(private readonly payslipsService: PayslipsService) {}

  @Get()
  list(@CurrentTenant() organisationId: string, @Query() query: ListPayslipsQueryDto) {
    return this.payslipsService.list(organisationId, query);
  }

  @Get('overview')
  overview(@CurrentTenant() organisationId: string) {
    return this.payslipsService.overview(organisationId);
  }

  @Get(':id')
  getById(@CurrentTenant() organisationId: string, @Param('id', ParseCuidPipe) id: string) {
    return this.payslipsService.getById(organisationId, id);
  }

  @Post()
  create(@CurrentTenant() organisationId: string, @CurrentUser() user: TokenPayload, @Body() dto: CreatePayslipDto) {
    return this.payslipsService.create(organisationId, user.sub, dto);
  }

  @Patch(':id')
  update(@CurrentTenant() organisationId: string, @CurrentUser() user: TokenPayload, @Param('id', ParseCuidPipe) id: string, @Body() dto: UpdatePayslipDto) {
    return this.payslipsService.update(organisationId, user.sub, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentTenant() organisationId: string, @CurrentUser() user: TokenPayload, @Param('id', ParseCuidPipe) id: string) {
    return this.payslipsService.remove(organisationId, user.sub, id);
  }
}
