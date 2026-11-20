import { CurrentTenant, CurrentUser, Permissions } from '@crm/auth';
import type { TokenPayload } from '@crm/auth';
import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';

import { PERMISSIONS } from '../../../common/constants/permissions.constants';
import { RequiresSection } from '../../../common/guards/section.guard';
import { MarkPaidDto, PaymentActionDto, PayrollQueryDto, PayslipsQueryDto, RecalculateDto } from '../dto';
import { PayrollService } from '../service/payroll.service';

/**
 * The weekly payroll screen (page "/payroll"). It is money, so — like Fees and Payments — it belongs to the
 * administrator or to a user it was ticked for. Authorising, paying and exporting additionally need `payroll:approve`.
 */
@ApiTags('payroll')
@ApiBearerAuth()
@Controller('payroll')
@RequiresSection('/payroll')
export class PayrollController {
  constructor(private readonly payroll: PayrollService) {}

  @Get()
  overview(@CurrentTenant() organisationId: string, @Query() query: PayrollQueryDto) {
    return this.payroll.overview(organisationId, query);
  }

  @Get('export.xlsx')
  @Permissions(PERMISSIONS.PAYROLL.APPROVE)
  async export(@CurrentTenant() organisationId: string, @CurrentUser() user: TokenPayload, @Query() query: PayrollQueryDto, @Res() res: Response) {
    const file = await this.payroll.exportXlsx(organisationId, user.sub, query, Boolean(user.permissions?.includes(PERMISSIONS.PAYROLL.SENSITIVE)));
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${file.filename}"`,
      'Cache-Control': 'no-store',
      'Access-Control-Expose-Headers': 'Content-Disposition',
    });
    res.send(file.buffer);
  }

  /** The payslips of the week (or of the filtered / selected lines) in one go: a ZIP of PDFs, or one PDF with a page each. */
  @Get('payslips')
  @Permissions(PERMISSIONS.PAYROLL.APPROVE)
  async payslips(@CurrentTenant() organisationId: string, @CurrentUser() user: TokenPayload, @Query() query: PayslipsQueryDto, @Res() res: Response) {
    const file = await this.payroll.bulkPayslips(organisationId, user.sub, query);
    res.set({
      'Content-Type': file.contentType,
      'Content-Disposition': `attachment; filename="${file.filename}"`,
      'Cache-Control': 'no-store',
      'X-Payslips': String(file.count),
      'Access-Control-Expose-Headers': 'Content-Disposition, X-Payslips',
    });
    res.send(file.buffer);
  }

  /** Works the whole week out again after amendments. With dryRun it only shows what would change. */
  @Post('recalculate')
  @HttpCode(HttpStatus.OK)
  @Permissions(PERMISSIONS.PAYROLL.APPROVE)
  recalculate(@CurrentTenant() organisationId: string, @CurrentUser() user: TokenPayload, @Body() dto: RecalculateDto) {
    return this.payroll.recalculateWeek(organisationId, user.sub, dto.week, dto.dryRun ?? false);
  }

  @Post('authorise')
  @HttpCode(HttpStatus.OK)
  @Permissions(PERMISSIONS.PAYROLL.APPROVE)
  authorise(@CurrentTenant() organisationId: string, @CurrentUser() user: TokenPayload, @Body() dto: PaymentActionDto) {
    return this.payroll.authorise(organisationId, user.sub, dto.payslipIds);
  }

  /** The payslips have been given to the workers (stage: payslip issued). */
  @Post('issue')
  @HttpCode(HttpStatus.OK)
  @Permissions(PERMISSIONS.PAYROLL.APPROVE)
  issue(@CurrentTenant() organisationId: string, @CurrentUser() user: TokenPayload, @Body() dto: PaymentActionDto) {
    return this.payroll.issue(organisationId, user.sub, dto.payslipIds);
  }

  @Post('unauthorise')
  @HttpCode(HttpStatus.OK)
  @Permissions(PERMISSIONS.PAYROLL.APPROVE)
  unauthorise(@CurrentTenant() organisationId: string, @CurrentUser() user: TokenPayload, @Body() dto: PaymentActionDto) {
    return this.payroll.reverse(organisationId, user.sub, dto.payslipIds);
  }

  @Post('mark-paid')
  @HttpCode(HttpStatus.OK)
  @Permissions(PERMISSIONS.PAYROLL.APPROVE)
  markPaid(@CurrentTenant() organisationId: string, @CurrentUser() user: TokenPayload, @Body() dto: MarkPaidDto) {
    return this.payroll.markPaid(organisationId, user.sub, dto);
  }
}
