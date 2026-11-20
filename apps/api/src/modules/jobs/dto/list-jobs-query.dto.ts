import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

const JOB_STATUSES = ['DRAFT', 'OPEN', 'ON_HOLD', 'CLOSED', 'ARCHIVED'] as const;
const EMPLOYMENT_GROUPS = ['PERMANENT', 'TEMPORARY'] as const;
const COMPLETIONS = ['COMPLETED', 'OPEN'] as const;
const AVAILABILITIES =['AVAILABLE', 'NOT_AVAILABLE', 'DO_NOT_USE'] as const;

export class ListJobsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Matches any column: title, company, location, type, experience, status, added by' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional({ description: 'Title contains' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({ description: 'Company name contains' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  company?: string;

  @ApiPropertyOptional({ description: 'Location contains' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string;

  @ApiPropertyOptional({ description: 'Place or postcode the distance is measured from (used with radiusKm)' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  nearLocation?: string;

  @ApiPropertyOptional({ description: 'Start the distance from this candidate (instead of nearLocation)' })
  @IsOptional()
  @IsString()
  nearCandidateId?: string;

  @ApiPropertyOptional({ description: 'Only jobs within this many km (straight line) of nearLocation' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  @Max(2000)
  radiusKm?: number;

  @ApiPropertyOptional({ description: 'Years of experience: jobs whose asked-for range covers this many years' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(60)
  experience?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  companyId?: string;

  @ApiPropertyOptional({ description: 'Only the records this user owns (added)' })
  @IsOptional()
  @IsString()
  ownerId?: string;

  @ApiPropertyOptional({ enum: AVAILABILITIES, description: 'AVAILABLE = open; NOT_AVAILABLE = on hold; DO_NOT_USE = closed' })
  @IsOptional()
  @IsIn(AVAILABILITIES)
  availability?: (typeof AVAILABILITIES)[number];

  @ApiPropertyOptional({ enum: EMPLOYMENT_GROUPS, description: 'PERMANENT = permanent jobs; TEMPORARY = every other kind (temporary, contract, part-time)' })
  @IsOptional()
  @IsIn(EMPLOYMENT_GROUPS)
  employmentGroup?: (typeof EMPLOYMENT_GROUPS)[number];

  @ApiPropertyOptional({ enum: COMPLETIONS, description: 'COMPLETED = every place of the job is filled (Completed Jobs); OPEN = jobs that still have places to fill' })
  @IsOptional()
  @IsIn(COMPLETIONS)
  completion?: (typeof COMPLETIONS)[number];

  @ApiPropertyOptional({ enum: JOB_STATUSES })
  @IsOptional()
  @IsIn(JOB_STATUSES)
  status?: (typeof JOB_STATUSES)[number];
}
