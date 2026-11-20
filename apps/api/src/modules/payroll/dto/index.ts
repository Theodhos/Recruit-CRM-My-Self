import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

import { PAYROLL_STAGES } from '../../timesheets/lib/payroll-stage';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export const APPROVALS = ['APPROVED', 'PENDING_APPROVAL', 'REJECTED'] as const;
export const PAYMENTS = ['NOT_READY', 'UNPAID', 'AUTHORISED', 'PAID'] as const;
export const CIS_STATUSES = ['VERIFIED', 'UNVERIFIED', 'GROSS', 'OTHER'] as const;

export class PayrollQueryDto {
  @ApiPropertyOptional({ description: 'Any date: the payroll week (Monday to Sunday) it falls in. Default: this week.' })
  @IsOptional()
  @Matches(DATE, { message: 'week must be YYYY-MM-DD' })
  week?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  companyId?: string;

  @ApiPropertyOptional({ description: 'Worker or client name' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ enum: APPROVALS })
  @IsOptional()
  @IsIn(APPROVALS as unknown as string[])
  approval?: (typeof APPROVALS)[number];

  @ApiPropertyOptional({ enum: PAYMENTS })
  @IsOptional()
  @IsIn(PAYMENTS as unknown as string[])
  payment?: (typeof PAYMENTS)[number];

  @ApiPropertyOptional({ enum: PAYROLL_STAGES, description: 'Where the worker’s week stands, from timesheet received to paid' })
  @IsOptional()
  @IsIn(PAYROLL_STAGES as unknown as string[])
  stage?: (typeof PAYROLL_STAGES)[number];

  @ApiPropertyOptional({ enum: ['PAID', 'UNPAID'] })
  @IsOptional()
  @IsIn(['PAID', 'UNPAID'])
  paid?: 'PAID' | 'UNPAID';

  @ApiPropertyOptional({ enum: CIS_STATUSES })
  @IsOptional()
  @IsIn(CIS_STATUSES as unknown as string[])
  cis?: (typeof CIS_STATUSES)[number];
}

export class PaymentActionDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @IsString({ each: true })
  payslipIds!: string[];
}

export class MarkPaidDto extends PaymentActionDto {
  @ApiPropertyOptional({ description: 'The day the money was sent (YYYY-MM-DD). Default: today.' })
  @IsOptional()
  @Matches(DATE, { message: 'paidDate must be YYYY-MM-DD' })
  paidDate?: string;

  @ApiPropertyOptional({ description: 'Bank batch / reference' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  reference?: string;
}

export class RecalculateDto {
  @ApiProperty({ description: 'Any date in the payroll week' })
  @Matches(DATE, { message: 'week must be YYYY-MM-DD' })
  week!: string;

  @ApiPropertyOptional({ description: 'Only report what would change' })
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}

export class PayslipsQueryDto extends PayrollQueryDto {
  @ApiPropertyOptional({ enum: ['zip', 'pdf'], description: 'zip: one PDF per worker in a ZIP file. pdf: one PDF with every payslip, a page each.' })
  @IsOptional()
  @IsIn(['zip', 'pdf'])
  format?: 'zip' | 'pdf';

  @ApiPropertyOptional({ description: 'Only these payslips (comma separated ids), on top of the filters' })
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  ids?: string;
}
