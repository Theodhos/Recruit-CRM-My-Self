import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, IsString, Length, MaxLength, MinLength, ValidateNested } from 'class-validator';

import { CandidateSelectionDto } from '../../candidates/dto/export-candidates.dto';
import { MAX_SMS_LENGTH } from '../lib/placeholders';

export class ConnectDialpadDto {
  @ApiProperty({ description: 'Dialpad API key from the company admin console (stored encrypted, never returned)' })
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  apiKey!: string;

  @ApiPropertyOptional({ description: 'The existing company business number, e.g. +442071234567' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  fromNumber?: string;
}

export class SetDialpadNumberDto {
  @ApiProperty()
  @IsString()
  @MaxLength(40)
  fromNumber!: string;
}

export class SendSmsDto {
  @ApiProperty({ description: 'Message text; may use {{firstName}}, {{lastName}}, {{fullName}}, {{jobTitle}}, {{recruiterName}}' })
  @IsString()
  @Length(1, MAX_SMS_LENGTH * 2)
  text!: string;

  @ApiPropertyOptional({ description: 'Vacancy used for {{jobTitle}}' })
  @IsOptional()
  @IsString()
  jobId?: string;
}

export class BulkPreviewDto {
  @ApiProperty()
  @ValidateNested()
  @Type(() => CandidateSelectionDto)
  selection!: CandidateSelectionDto;

  @ApiProperty()
  @IsString()
  @Length(1, MAX_SMS_LENGTH * 2)
  text!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  jobId?: string;
}

export class BulkSendDto extends BulkPreviewDto {
  @ApiProperty({ description: 'Made by the browser when the dialog opens: a double click or a retry sends once' })
  @IsString()
  @Length(8, 100)
  idempotencyKey!: string;
}

export class TemplateDto {
  @ApiProperty()
  @IsString()
  @Length(1, 80)
  name!: string;

  @ApiProperty()
  @IsString()
  @Length(1, MAX_SMS_LENGTH)
  body!: string;
}

export class UpdateTemplateDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 80)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, MAX_SMS_LENGTH)
  body?: string;
}

export class AssignUnmatchedDto {
  @ApiProperty()
  @IsString()
  candidateId!: string;
}
