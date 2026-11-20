import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';

import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export const RATE_TYPES = ['DAY', 'HOUR'] as const;
export type RateTypeValue = (typeof RATE_TYPES)[number];
export const TIMESHEET_STATUSES = ['PENDING_APPROVAL', 'APPROVED', 'REJECTED'] as const;

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export class DayEntryDto {
  @ApiProperty({ example: '2026-11-02' })
  @Matches(DATE, { message: 'date must be YYYY-MM-DD' })
  date!: string;

  @ApiProperty({ description: 'Days (0, 0.5, 1) or hours worked that day' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(24)
  units!: number;
}

export class CreateTimesheetDto {
  @ApiProperty()
  @IsString()
  candidateId!: string;

  @ApiProperty()
  @IsString()
  companyId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  placementId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  jobId?: string;

  @ApiProperty({ description: 'The Monday of the working week (YYYY-MM-DD)' })
  @Matches(DATE, { message: 'weekStart must be YYYY-MM-DD' })
  weekStart!: string;

  @ApiProperty({ enum: RATE_TYPES })
  @IsIn(RATE_TYPES as unknown as string[])
  rateType!: RateTypeValue;

  @ApiProperty({ description: 'What the worker is paid per day / hour' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100000)
  payRate!: number;

  @ApiProperty({ description: 'What the client is charged per day / hour' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100000)
  chargeRate!: number;

  @ApiProperty({ type: [DayEntryDto] })
  @IsArray()
  @ArrayMaxSize(7)
  @ValidateNested({ each: true })
  @Type(() => DayEntryDto)
  days!: DayEntryDto[];

  @ApiPropertyOptional({ description: 'Who at the client confirmed the hours' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  clientConfirmedBy?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  clientConfirmedEmail?: string;

  @ApiPropertyOptional({ description: 'A document (the signed timesheet) already uploaded for the worker' })
  @IsOptional()
  @IsString()
  attachmentDocumentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

/** An amendment: the same fields, all optional. The worker, client and week of a timesheet never change. */
export class UpdateTimesheetDto {
  @ApiPropertyOptional({ enum: RATE_TYPES })
  @IsOptional()
  @IsIn(RATE_TYPES as unknown as string[])
  rateType?: RateTypeValue;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100000)
  payRate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100000)
  chargeRate?: number;

  @ApiPropertyOptional({ type: [DayEntryDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(7)
  @ValidateNested({ each: true })
  @Type(() => DayEntryDto)
  days?: DayEntryDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  clientConfirmedBy?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  clientConfirmedEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  attachmentDocumentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @ApiPropertyOptional({ description: 'What was changed and why (shown in the approval history)' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  amendmentNote?: string;
}

export class RejectTimesheetDto {
  @ApiProperty({ description: 'Why it is rejected — shown to whoever amends it' })
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  reason!: string;
}

export class ApproveTimesheetDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class ListTimesheetsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Any date: the timesheets of that Monday-to-Sunday week' })
  @IsOptional()
  @Matches(DATE, { message: 'week must be YYYY-MM-DD' })
  week?: string;

  @ApiPropertyOptional({ enum: TIMESHEET_STATUSES })
  @IsOptional()
  @IsIn(TIMESHEET_STATUSES as unknown as string[])
  status?: (typeof TIMESHEET_STATUSES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  candidateId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  companyId?: string;
}

export class WorkersQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}

export class UpsertWorkerProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  nino?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  utr?: string | null;

  @ApiPropertyOptional({ description: 'CIS deduction in percent: 20 verified, 30 unverified, 0 gross status' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  cisRate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(10000)
  payrollFee?: number;

  @ApiPropertyOptional({ enum: RATE_TYPES })
  @IsOptional()
  @IsIn(RATE_TYPES as unknown as string[])
  rateType?: RateTypeValue;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100000)
  payRate?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100000)
  chargeRate?: number | null;
}

export { AddAdjustmentDto, ADJUSTMENT_KIND_VALUES, OverrideDto, PayslipNotesDto, ReasonDto } from './adjustments.dto';
