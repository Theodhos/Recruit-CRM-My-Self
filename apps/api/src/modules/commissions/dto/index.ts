import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min, ValidateNested } from 'class-validator';

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
export const BASES = ['PROFIT', 'BILLING'] as const;

export class ResourcerShareDto {
  @ApiProperty()
  @IsString()
  userId!: string;

  @ApiProperty({ description: 'Percent of the placement; both shares must add up to 100' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(100)
  splitPercent!: number;
}

export class SetResourcersDto {
  @ApiProperty({ type: [ResourcerShareDto], description: 'One resourcer (100%) or two (the split you decide, adding up to 100%)' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(2)
  @ValidateNested({ each: true })
  @Type(() => ResourcerShareDto)
  resourcers!: ResourcerShareDto[];
}

export class SetRateDto {
  @ApiProperty({ description: 'Commission percentage' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  commissionRate!: number;

  @ApiPropertyOptional({ enum: BASES, nullable: true, description: 'This person’s own basis; empty = the organisation default' })
  @IsOptional()
  @IsIn([...BASES, null] as unknown as string[])
  commissionBasis?: (typeof BASES)[number] | null;
}

export class SetBasisDto {
  @ApiProperty({ enum: BASES })
  @IsIn(BASES as unknown as string[])
  commissionBasis!: (typeof BASES)[number];
}

export class MonthQueryDto {
  @ApiProperty({ example: '2026-11' })
  @Matches(MONTH, { message: 'month must be YYYY-MM' })
  month!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  userId?: string;
}

export class AddPaymentDto {
  @ApiProperty()
  @IsString()
  userId!: string;

  @ApiProperty({ example: '2026-11' })
  @Matches(MONTH, { message: 'month must be YYYY-MM' })
  month!: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(1000000)
  amount!: number;

  @ApiPropertyOptional({ description: 'Day paid (YYYY-MM-DD); default today' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  paidDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  reference?: string;
}

export class SetTriggerDto {
  @ApiProperty({ enum: ['PLACEMENT', 'PAID'], description: 'When commission on a permanent placement is earned: when it is placed, or when the client pays the invoice' })
  @IsIn(['PLACEMENT', 'PAID'])
  permanentCommissionTrigger!: 'PLACEMENT' | 'PAID';
}
