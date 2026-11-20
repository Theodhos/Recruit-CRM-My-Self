import { CurrentTenant, CurrentUser, Permissions } from '@crm/auth';
import type { TokenPayload } from '@crm/auth';
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Put, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';

import { PERMISSIONS } from '../../../common/constants/permissions.constants';
import { RequiresSection } from '../../../common/guards/section.guard';
import { ParseCuidPipe } from '../../../common/pipes/parse-cuid.pipe';
import { AddAdjustmentDto, ApproveTimesheetDto, CreateTimesheetDto, OverrideDto, PayslipNotesDto, ReasonDto, ListTimesheetsQueryDto, RejectTimesheetDto, UpdateTimesheetDto, UpsertWorkerProfileDto, WorkersQueryDto } from '../dto';
import { TimesheetsService } from '../service/timesheets.service';

const canSeeSensitive = (user: TokenPayload) => Boolean(user.permissions?.includes(PERMISSIONS.PAYROLL.SENSITIVE));

/**
 * Weekly timesheets of temporary workers (page "/timesheets"). It is payroll, so — like Fees and Payments — it belongs
 * to the administrator, or to a user it was ticked for. Approving and rejecting additionally need `payroll:approve`.
 */
@ApiTags('timesheets')
@ApiBearerAuth()
@Controller('timesheets')
@RequiresSection('/timesheets')
export class TimesheetsController {
  constructor(private readonly timesheets: TimesheetsService) {}

  @Get()
  list(@CurrentTenant() organisationId: string, @Query() query: ListTimesheetsQueryDto) {
    return this.timesheets.list(organisationId, query);
  }

  @Get('workers')
  workers(@CurrentTenant() organisationId: string, @CurrentUser() user: TokenPayload, @Query() query: WorkersQueryDto) {
    return this.timesheets.workers(organisationId, query.search, canSeeSensitive(user));
  }

  @Get('workers/:candidateId/profile')
  profile(@CurrentTenant() organisationId: string, @CurrentUser() user: TokenPayload, @Param('candidateId', ParseCuidPipe) candidateId: string) {
    return this.timesheets.getProfile(organisationId, candidateId, canSeeSensitive(user));
  }

  @Put('workers/:candidateId/profile')
  saveProfile(@CurrentTenant() organisationId: string, @CurrentUser() user: TokenPayload, @Param('candidateId', ParseCuidPipe) candidateId: string, @Body() dto: UpsertWorkerProfileDto) {
    return this.timesheets.upsertProfile(organisationId, user.sub, candidateId, dto, canSeeSensitive(user));
  }

  @Get('payslips/:payslipId/pdf')
  async payslipPdfByPayslip(@CurrentTenant() organisationId: string, @Param('payslipId', ParseCuidPipe) payslipId: string, @Res() res: Response) {
    const file = await this.timesheets.payslipPdfByPayslip(organisationId, payslipId);
    this.sendPdf(res, file);
  }

  @Get(':id')
  getById(@CurrentTenant() organisationId: string, @Param('id', ParseCuidPipe) id: string) {
    return this.timesheets.getById(organisationId, id);
  }

  @Post()
  create(@CurrentTenant() organisationId: string, @CurrentUser() user: TokenPayload, @Body() dto: CreateTimesheetDto) {
    return this.timesheets.create(organisationId, user.sub, dto);
  }

  @Patch(':id')
  update(@CurrentTenant() organisationId: string, @CurrentUser() user: TokenPayload, @Param('id', ParseCuidPipe) id: string, @Body() dto: UpdateTimesheetDto) {
    return this.timesheets.update(organisationId, user.sub, id, dto, Boolean(user.permissions?.includes(PERMISSIONS.PAYROLL.APPROVE)));
  }

  /** Bonuses, additional payments, deductions and fees on a timesheet. Payroll control, so it needs payroll:approve. */
  @Post(':id/adjustments')
  @Permissions(PERMISSIONS.PAYROLL.APPROVE)
  addAdjustment(@CurrentTenant() organisationId: string, @CurrentUser() user: TokenPayload, @Param('id', ParseCuidPipe) id: string, @Body() dto: AddAdjustmentDto) {
    return this.timesheets.addAdjustment(organisationId, user.sub, id, dto);
  }

  @Delete(':id/adjustments/:adjustmentId')
  @Permissions(PERMISSIONS.PAYROLL.APPROVE)
  removeAdjustment(@CurrentTenant() organisationId: string, @CurrentUser() user: TokenPayload, @Param('id', ParseCuidPipe) id: string, @Param('adjustmentId') adjustmentId: string, @Body() dto: ReasonDto) {
    return this.timesheets.removeAdjustment(organisationId, user.sub, id, adjustmentId, dto.reason);
  }

  /** Replace calculated figures by hand, with a reason. */
  @Put(':id/overrides')
  @Permissions(PERMISSIONS.PAYROLL.APPROVE)
  setOverrides(@CurrentTenant() organisationId: string, @CurrentUser() user: TokenPayload, @Param('id', ParseCuidPipe) id: string, @Body() dto: OverrideDto) {
    const { reason, ...fields } = dto;
    return this.timesheets.setOverrides(organisationId, user.sub, id, fields, reason);
  }

  @Delete(':id/overrides')
  @Permissions(PERMISSIONS.PAYROLL.APPROVE)
  clearOverrides(@CurrentTenant() organisationId: string, @CurrentUser() user: TokenPayload, @Param('id', ParseCuidPipe) id: string, @Body() dto: ReasonDto) {
    return this.timesheets.clearOverrides(organisationId, user.sub, id, dto.reason);
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @Permissions(PERMISSIONS.PAYROLL.APPROVE)
  approve(@CurrentTenant() organisationId: string, @CurrentUser() user: TokenPayload, @Param('id', ParseCuidPipe) id: string, @Body() dto: ApproveTimesheetDto) {
    return this.timesheets.approve(organisationId, user.sub, id, dto);
  }

  /** The administrator has looked at it: received → awaiting approval. */
  @Post(':id/checked')
  @HttpCode(HttpStatus.OK)
  @Permissions(PERMISSIONS.PAYROLL.APPROVE)
  markChecked(@CurrentTenant() organisationId: string, @CurrentUser() user: TokenPayload, @Param('id', ParseCuidPipe) id: string) {
    return this.timesheets.markChecked(organisationId, user.sub, id);
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @Permissions(PERMISSIONS.PAYROLL.APPROVE)
  reject(@CurrentTenant() organisationId: string, @CurrentUser() user: TokenPayload, @Param('id', ParseCuidPipe) id: string, @Body() dto: RejectTimesheetDto) {
    return this.timesheets.reject(organisationId, user.sub, id, dto);
  }

  /** The note printed on the payslip. */
  @Put(':id/payslip-notes')
  @Permissions(PERMISSIONS.PAYROLL.APPROVE)
  setPayslipNotes(@CurrentTenant() organisationId: string, @CurrentUser() user: TokenPayload, @Param('id', ParseCuidPipe) id: string, @Body() dto: PayslipNotesDto) {
    return this.timesheets.setPayslipNotes(organisationId, user.sub, id, dto.notes ?? null);
  }

  @Get(':id/payslip.pdf')
  async payslipPdf(@CurrentTenant() organisationId: string, @Param('id', ParseCuidPipe) id: string, @Res() res: Response) {
    const file = await this.timesheets.payslipPdf(organisationId, id);
    this.sendPdf(res, file);
  }

  private sendPdf(res: Response, file: { buffer: Buffer; filename: string }) {
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${file.filename}"`,
      'Cache-Control': 'no-store',
      'Access-Control-Expose-Headers': 'Content-Disposition',
    });
    res.send(file.buffer);
  }
}
