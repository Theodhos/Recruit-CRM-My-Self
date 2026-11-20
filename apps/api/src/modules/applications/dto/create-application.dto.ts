import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

const APPLICATION_STATUSES = ['ACTIVE', 'ON_HOLD', 'REJECTED', 'WITHDRAWN', 'PLACED'] as const;
const APPLICATION_SOURCES = [
  'SOURCED', 'INBOUND', 'REFERRAL', 'JOB_BOARD', 'AGENCY', 'CAREER_SITE', 'OTHER',
] as const;

export class CreateApplicationDto {
  @ApiProperty()
  @IsString()
  candidateId!: string;

  @ApiPropertyOptional({ description: "Omit for a candidate added without a job: they sit on the pipeline at the first stage until a job is linked" })
  @IsOptional()
  @IsString()
  jobId?: string;

  @ApiPropertyOptional({ description: 'Defaults to the organisation\'s default pipeline if omitted' })
  @IsOptional()
  @IsString()
  pipelineId?: string;

  @ApiPropertyOptional({ description: 'Defaults to that pipeline\'s first stage if omitted' })
  @IsOptional()
  @IsString()
  pipelineStageId?: string;

  @ApiPropertyOptional({ enum: APPLICATION_STATUSES })
  @IsOptional()
  @IsIn(APPLICATION_STATUSES)
  status?: (typeof APPLICATION_STATUSES)[number];

  @ApiPropertyOptional({ enum: APPLICATION_SOURCES })
  @IsOptional()
  @IsIn(APPLICATION_SOURCES)
  source?: (typeof APPLICATION_SOURCES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ownerId?: string;
}
