import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsNumber, IsOptional, IsString, Length, Max, MaxLength, Min } from 'class-validator';

import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export const FEE_STATUSES = ['PENDING', 'INVOICED', 'PAID', 'OVERDUE', 'CANCELLED'] as const;
export type FeeStatusValue = (typeof FEE_STATUSES)[number];
export const FEE_TYPES = ['PERCENTAGE', 'FIXED'] as const;

export class CreateFeeDto {
  @ApiProperty({ description: 'The permanent placement (Active Employees entry) this fee is charged for' })
  @IsString()
  placementId!: string;

  @ApiPropertyOptional({ enum: FEE_TYPES, description: 'Percentage of the annual salary, or a fixed fee. With a fee type the total is always worked out here.' })
  @IsOptional()
  @IsIn(FEE_TYPES as unknown as string[])
  feeType?: (typeof FEE_TYPES)[number];

  @ApiPropertyOptional({ description: 'The candidate’s agreed annual salary' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9_999_999)
  annualSalary?: number;

  @ApiPropertyOptional({ description: 'Agreed fee percentage (percentage fee type)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  feePercent?: number;

  @ApiPropertyOptional({ description: 'Agreed fixed fee (fixed fee type)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9_999_999)
  fixedFee?: number;

  @ApiPropertyOptional({ description: 'Only for a fee without terms (an older fee): the amount typed in. With a fee type it is ignored.' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9_999_999_999)
  amount?: number;

  @ApiPropertyOptional({ default: 'GBP' })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @ApiPropertyOptional({ enum: FEE_STATUSES, default: 'PENDING', description: 'PENDING = Draft, INVOICED = Sent' })
  @IsOptional()
  @IsIn(FEE_STATUSES as unknown as string[])
  status?: FeeStatusValue;

  @ApiPropertyOptional({ description: 'When the client has to pay by' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional({ description: 'The day the candidate was placed' })
  @IsOptional()
  @IsDateString()
  placementDate?: string;

  @ApiPropertyOptional({ description: 'The date the invoice was raised' })
  @IsOptional()
  @IsDateString()
  invoiceDate?: string;

  @ApiPropertyOptional({ description: 'The invoice reference' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  invoiceNumber?: string;
}

export class UpdateFeeDto extends PartialType(CreateFeeDto) {}

export class ListFeesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: FEE_STATUSES })
  @IsOptional()
  @IsIn(FEE_STATUSES as unknown as string[])
  status?: FeeStatusValue;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  companyId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  placementId?: string;
}
