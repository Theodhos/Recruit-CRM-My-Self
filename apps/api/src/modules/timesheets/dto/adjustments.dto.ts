import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export const ADJUSTMENT_KIND_VALUES = ['BONUS', 'ADDITIONAL_PAYMENT', 'DEDUCTION', 'ADMIN_FEE', 'ADJUSTMENT'] as const;

export class AddAdjustmentDto {
  @ApiProperty({ enum: ADJUSTMENT_KIND_VALUES })
  @IsIn(ADJUSTMENT_KIND_VALUES as unknown as string[])
  kind!: (typeof ADJUSTMENT_KIND_VALUES)[number];

  @ApiProperty({ description: 'What the line is called on the payslip' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  label!: string;

  @ApiProperty({ description: 'Positive, except for "Adjustment" where a minus takes money off' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(-100000)
  @Max(100000)
  amount!: number;

  @ApiProperty({ description: 'Why — kept in the history' })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}

export class ReasonDto {
  @ApiProperty({ description: 'Why — kept in the history' })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}

export class OverrideDto extends ReasonDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(-1000000)
  @Max(1000000)
  gross?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(-1000000)
  @Max(1000000)
  cisDeduction?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(-1000000)
  @Max(1000000)
  payrollFee?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(-1000000)
  @Max(1000000)
  netPay?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(-1000000)
  @Max(1000000)
  chargeTotal?: number;
}

export class PayslipNotesDto {
  @ApiPropertyOptional({ description: 'Printed under "Notes" on the payslip. Empty clears it.' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string | null;
}
