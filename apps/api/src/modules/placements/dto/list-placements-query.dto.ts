import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

const PLACEMENT_EMPLOYMENT_TYPES = ['PERMANENT', 'TEMPORARY'] as const;

export class ListPlacementsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: "Matches against the candidate's name or the company's name" })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional({
    description: 'One status, or several separated by commas (e.g. "COMPLETED,CANCELLED" — Completed Contract shows both by default)',
  })
  @IsOptional()
  @IsString()
  @Matches(/^(ACTIVE|COMPLETED|CANCELLED)(,(ACTIVE|COMPLETED|CANCELLED))*$/, {
    message: 'status must be one or more of ACTIVE, COMPLETED, CANCELLED, separated by commas',
  })
  status?: string;

  @ApiPropertyOptional({ description: 'Leave out the contracts of jobs whose every place is filled (they live on Completed Jobs) — Active Employees asks for this' })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  hideCompletedJobs?: boolean;

  @ApiPropertyOptional({ enum: PLACEMENT_EMPLOYMENT_TYPES, description: 'Permanent or temporary employees only' })
  @IsOptional()
  @IsIn(PLACEMENT_EMPLOYMENT_TYPES)
  employmentType?: (typeof PLACEMENT_EMPLOYMENT_TYPES)[number];

  @ApiPropertyOptional({ description: 'Only the records this user owns (added)' })
  @IsOptional()
  @IsString()
  ownerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  candidateId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  jobId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  companyId?: string;
}
