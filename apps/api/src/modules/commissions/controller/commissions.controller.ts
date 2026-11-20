import { CurrentTenant, CurrentUser, Permissions } from '@crm/auth';
import type { TokenPayload } from '@crm/auth';
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';

import { PERMISSIONS } from '../../../common/constants/permissions.constants';
import { ParseCuidPipe } from '../../../common/pipes/parse-cuid.pipe';
import { DatabaseService } from '../../../infrastructure/database/database.service';
import { AddPaymentDto, MonthQueryDto, SetBasisDto, SetRateDto, SetResourcersDto, SetTriggerDto } from '../dto';
import { buildStatementPdf } from '../lib/statement-pdf';
import { CommissionsService } from '../service/commissions.service';

/**
 * Resourcer allocation and monthly commission. Setting resourcers, rates and payments, and seeing everyone's
 * figures, needs `commission:manage`. Anyone signed in can read their own statement (`my-statement`): nobody sees
 * another person's commission.
 */
@ApiTags('commissions')
@ApiBearerAuth()
@Controller('commissions')
export class CommissionsController {
  constructor(
    private readonly commissions: CommissionsService,
    private readonly db: DatabaseService,
  ) {}

  @Get('resourcers')
  @Permissions(PERMISSIONS.COMMISSION.MANAGE)
  resourcers(@CurrentTenant() organisationId: string) {
    return this.commissions.listResourcers(organisationId);
  }

  @Put('resourcers/:userId')
  @Permissions(PERMISSIONS.COMMISSION.MANAGE)
  setRate(@CurrentTenant() organisationId: string, @CurrentUser() user: TokenPayload, @Param('userId', ParseCuidPipe) userId: string, @Body() dto: SetRateDto) {
    return this.commissions.setRate(organisationId, user.sub, userId, dto);
  }

  @Put('settings/basis')
  @Permissions(PERMISSIONS.COMMISSION.MANAGE)
  setBasis(@CurrentTenant() organisationId: string, @CurrentUser() user: TokenPayload, @Body() dto: SetBasisDto) {
    return this.commissions.setOrgBasis(organisationId, user.sub, dto.commissionBasis);
  }

  @Put('settings/permanent-trigger')
  @Permissions(PERMISSIONS.COMMISSION.MANAGE)
  setTrigger(@CurrentTenant() organisationId: string, @CurrentUser() user: TokenPayload, @Body() dto: SetTriggerDto) {
    return this.commissions.setPermanentTrigger(organisationId, user.sub, dto.permanentCommissionTrigger);
  }

  @Get('placements/:placementId')
  @Permissions(PERMISSIONS.COMMISSION.MANAGE)
  allocation(@CurrentTenant() organisationId: string, @Param('placementId', ParseCuidPipe) placementId: string) {
    return this.commissions.getAllocation(organisationId, placementId);
  }

  @Put('placements/:placementId/resourcers')
  @Permissions(PERMISSIONS.COMMISSION.MANAGE)
  setAllocation(@CurrentTenant() organisationId: string, @CurrentUser() user: TokenPayload, @Param('placementId', ParseCuidPipe) placementId: string, @Body() dto: SetResourcersDto) {
    return this.commissions.setAllocation(organisationId, user.sub, placementId, dto.resourcers);
  }

  @Delete('placements/:placementId/resourcers')
  @Permissions(PERMISSIONS.COMMISSION.MANAGE)
  clearAllocation(@CurrentTenant() organisationId: string, @CurrentUser() user: TokenPayload, @Param('placementId', ParseCuidPipe) placementId: string) {
    return this.commissions.clearAllocation(organisationId, user.sub, placementId);
  }

  @Get('month')
  @Permissions(PERMISSIONS.COMMISSION.MANAGE)
  month(@CurrentTenant() organisationId: string, @Query() query: MonthQueryDto) {
    return this.commissions.overview(organisationId, query.month);
  }

  @Get('statement')
  @Permissions(PERMISSIONS.COMMISSION.MANAGE)
  statement(@CurrentTenant() organisationId: string, @Query() query: MonthQueryDto) {
    return this.commissions.statement(organisationId, query.month, query.userId ?? '');
  }

  /** Your own statement, whoever you are. */
  @Get('my-statement')
  myStatement(@CurrentTenant() organisationId: string, @CurrentUser() user: TokenPayload, @Query() query: MonthQueryDto) {
    return this.commissions.statement(organisationId, query.month, user.sub);
  }

  @Get('statement.pdf')
  async statementPdf(@CurrentTenant() organisationId: string, @CurrentUser() user: TokenPayload, @Query() query: MonthQueryDto, @Res() res: Response) {
    // an administrator may print anyone's; everyone else only their own
    const mayManage = Boolean(user.permissions?.includes(PERMISSIONS.COMMISSION.MANAGE));
    const userId = mayManage && query.userId ? query.userId : user.sub;
    const s = await this.commissions.statement(organisationId, query.month, userId);
    const org = await this.db.client.organisation.findUnique({ where: { id: organisationId }, select: { name: true } });
    const bytes = await buildStatementPdf({ company: 'DC Solutions Services Ltd', month: s.month, employee: s.employee, lines: s.lines.map((l) => ({ ...l, worker: l.kind === 'PERMANENT' ? `${l.worker} (permanent)` : l.worker })), payments: s.payments, totals: s.totals });
    void org;
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="Commission statement - ${s.employee.name} - ${s.month}.pdf"`, 'Cache-Control': 'no-store', 'Access-Control-Expose-Headers': 'Content-Disposition' });
    res.send(Buffer.from(bytes));
  }

  @Get('export.xlsx')
  @Permissions(PERMISSIONS.COMMISSION.MANAGE)
  async exportXlsx(@CurrentTenant() organisationId: string, @Query() query: MonthQueryDto, @Res() res: Response) {
    const file = await this.commissions.exportXlsx(organisationId, query.month);
    res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="${file.filename}"`, 'Cache-Control': 'no-store', 'Access-Control-Expose-Headers': 'Content-Disposition' });
    res.send(file.buffer);
  }

  @Post('payments')
  @HttpCode(HttpStatus.CREATED)
  @Permissions(PERMISSIONS.COMMISSION.MANAGE)
  addPayment(@CurrentTenant() organisationId: string, @CurrentUser() user: TokenPayload, @Body() dto: AddPaymentDto) {
    return this.commissions.addPayment(organisationId, user.sub, dto);
  }

  @Delete('payments/:id')
  @Permissions(PERMISSIONS.COMMISSION.MANAGE)
  removePayment(@CurrentTenant() organisationId: string, @CurrentUser() user: TokenPayload, @Param('id', ParseCuidPipe) id: string) {
    return this.commissions.removePayment(organisationId, user.sub, id);
  }
}
