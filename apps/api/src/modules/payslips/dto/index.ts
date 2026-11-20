import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsNumber, IsOptional, IsString, Length, Max, MaxLength, Min } from 'class-validator';

import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export const PAYSLIP_RATE_TYPES = ['DAY', 'HOUR'] as const;
export type PayslipRateTypeValue = (typeof PAYSLIP_RATE_TYPES)[number];

export class CreatePayslipDto {
  @ApiProperty()
  @IsString()
  @Length(1, 200)
  employeeName!: string;

  @ApiPropertyOptional({ description: 'National Insurance Number' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  nino?: string | null;

  @ApiPropertyOptional({ description: 'Unique Taxpayer Reference' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  utr?: string | null;

  @ApiProperty({ description: 'First day of the week covered' })
  @IsDateString()
  weekStart!: string;

  @ApiProperty({ description: 'Last day of the week covered' })
  @IsDateString()
  weekEnd!: string;

  @ApiProperty()
  @IsDateString()
  paymentDate!: string;

  @ApiProperty({ enum: PAYSLIP_RATE_TYPES })
  @IsIn(PAYSLIP_RATE_TYPES)
  rateType!: PayslipRateTypeValue;

  @ApiProperty({ description: 'Pay per day or per hour' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999_999)
  rate!: number;

  @ApiProperty({ description: 'Days or hours worked' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9_999)
  quantity!: number;

  @ApiPropertyOptional({ default: 20, description: 'CIS deduction, in percent' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  cisRate?: number;

  @ApiPropertyOptional({ default: 15 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999_999)
  payrollFee?: number;

  @ApiPropertyOptional({ default: 'GBP' })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;
}

export class UpdatePayslipDto extends PartialType(CreatePayslipDto) {}

export class ListPayslipsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Part of the employee name, NINO or UTR' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}
