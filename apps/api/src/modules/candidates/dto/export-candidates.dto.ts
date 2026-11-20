import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsInt, IsOptional, IsString, Min, ValidateIf, ValidateNested } from 'class-validator';

import { EXPORT_FIELD_KEYS } from '../lib/export-fields';

import { ListCandidatesQueryDto } from './list-candidates-query.dto';

export const MAX_EXPORT_ROWS = 20_000;

export class CandidateSelectionDto {
  @ApiProperty({ enum: ['IDS', 'FILTER'], description: 'IDS = exactly these candidates; FILTER = everyone matching the filters (minus excludeIds)' })
  @IsIn(['IDS', 'FILTER'])
  mode!: 'IDS' | 'FILTER';

  @ApiPropertyOptional({ type: [String] })
  @ValidateIf((o: CandidateSelectionDto) => o.mode === 'IDS')
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_EXPORT_ROWS)
  @IsString({ each: true })
  ids?: string[];

  @ApiPropertyOptional({ type: ListCandidatesQueryDto })
  @ValidateIf((o: CandidateSelectionDto) => o.mode === 'FILTER')
  @ValidateNested()
  @Type(() => ListCandidatesQueryDto)
  filters?: ListCandidatesQueryDto;

  @ApiPropertyOptional({ type: [String], description: 'With FILTER: people taken out of the selection one by one' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_EXPORT_ROWS)
  @IsString({ each: true })
  excludeIds?: string[];
}

export class PreviewExportDto {
  @ApiProperty({ enum: ['SMS', 'EMAIL', 'CALL'], description: 'What the list is for — decides who may be on it' })
  @IsIn(['SMS', 'EMAIL', 'CALL'])
  purpose!: 'SMS' | 'EMAIL' | 'CALL';

  @ApiProperty()
  @ValidateNested()
  @Type(() => CandidateSelectionDto)
  selection!: CandidateSelectionDto;
}

export class ExportCandidatesDto extends PreviewExportDto {
  @ApiProperty({ enum: ['CSV', 'XLSX', 'DIALPAD'] })
  @IsIn(['CSV', 'XLSX', 'DIALPAD'])
  format!: 'CSV' | 'XLSX' | 'DIALPAD';

  @ApiProperty({ enum: EXPORT_FIELD_KEYS, isArray: true, description: 'Only these columns are written (ignored for DIALPAD, which has a fixed layout)' })
  @IsArray()
  @ArrayMinSize(1)
  @IsIn(EXPORT_FIELD_KEYS, { each: true })
  fields!: string[];

  @ApiPropertyOptional({ description: 'DIALPAD takes 500 contacts per file: which file (1, 2, ...)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  part?: number;
}

export class SetConsentDto {
  @ApiProperty()
  @ValidateNested()
  @Type(() => CandidateSelectionDto)
  selection!: CandidateSelectionDto;

  @ApiProperty({ enum: ['SMS', 'EMAIL', 'CALL'], isArray: true })
  @IsArray()
  @ArrayMinSize(1)
  @IsIn(['SMS', 'EMAIL', 'CALL'], { each: true })
  channels!: ('SMS' | 'EMAIL' | 'CALL')[];

  @ApiProperty({ enum: ['GRANTED', 'OPTED_OUT', 'UNKNOWN'] })
  @IsIn(['GRANTED', 'OPTED_OUT', 'UNKNOWN'])
  status!: 'GRANTED' | 'OPTED_OUT' | 'UNKNOWN';

  @ApiPropertyOptional({ description: 'Where the consent comes from (required when granting), e.g. "Signed consent form, 3 Nov 2026"' })
  @IsOptional()
  @IsString()
  evidence?: string;
}
