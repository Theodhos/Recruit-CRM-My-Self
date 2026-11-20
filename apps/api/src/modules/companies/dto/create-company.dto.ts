import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsNumber,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/** A field left empty in the form arrives as "" — that means "nothing here" (null clears it), not an invalid value. */
const blankToNull = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
};

/** "acme.com" is a website too: the scheme is added when it was left out. */
const asWebsite = ({ value }: { value: unknown }) => {
  const text = blankToNull({ value });
  if (typeof text !== 'string') return text;
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `https://${text}`;
};

const COMPANY_STATUSES = ['PROSPECT', 'ACTIVE_CLIENT', 'FORMER_CLIENT', 'INACTIVE'] as const;
export const COMPANY_PIPELINE_STAGES = ['NEW', 'IN_CONVERSATION', 'WIN', 'LOST'] as const;

/** A blank name arrives as "" — nothing to set, so the company is still created (as "Untitled company"). */
const blankToUndefined = ({ value }: { value: unknown }) => (typeof value === 'string' && value.trim() === '' ? undefined : typeof value === 'string' ? value.trim() : value);

export class CreateCompanyDto {
  @ApiPropertyOptional()
  @Transform(blankToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional()
  @Transform(blankToNull)
  @IsOptional()
  @IsString()
  @MaxLength(150)
  industry?: string;

  @ApiPropertyOptional()
  @Transform(asWebsite)
  @IsOptional()
  @IsUrl()
  @MaxLength(300)
  website?: string;

  @ApiPropertyOptional()
  @Transform(blankToNull)
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @Transform(blankToNull)
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional()
  @Transform(blankToNull)
  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;

  @ApiPropertyOptional()
  @Transform(blankToNull)
  @IsOptional()
  @IsString()
  @MaxLength(150)
  city?: string;

  @ApiPropertyOptional()
  @Transform(blankToNull)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  source?: string;

  @ApiPropertyOptional()
  @Transform(blankToNull)
  @IsOptional()
  @IsString()
  @MaxLength(150)
  country?: string;

  @ApiPropertyOptional({ enum: COMPANY_STATUSES })
  @IsOptional()
  @IsIn(COMPANY_STATUSES)
  status?: (typeof COMPANY_STATUSES)[number];

  @ApiPropertyOptional({ enum: COMPANY_PIPELINE_STAGES, description: 'Column on the Pipeline Companies board' })
  @IsOptional()
  @IsIn(COMPANY_PIPELINE_STAGES)
  pipelineStage?: (typeof COMPANY_PIPELINE_STAGES)[number];

  @ApiPropertyOptional({ description: 'Invoicing of temporary workers: the CIS percentage this client deducts from our invoice' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  cisDeductionRate?: number;

  @ApiPropertyOptional({ description: 'VAT percentage on the invoices to this client' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  vatRate?: number;

  @ApiPropertyOptional({ description: 'Domestic reverse charge: the invoice carries no VAT' })
  @IsOptional()
  @IsBoolean()
  vatReverseCharge?: boolean;

  @ApiPropertyOptional({ description: 'Lost with the Do not contact button' })
  @IsOptional()
  @IsBoolean()
  doNotContact?: boolean;

  @ApiPropertyOptional({ description: 'Free text about the company: where it operates, the services it offers, …' })
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  about?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ownerId?: string;
}
