import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

const CANDIDATE_STATUSES = ['ACTIVE', 'PASSIVE', 'DO_NOT_CONTACT', 'PLACED', 'ARCHIVED'] as const;

/** Where an applicant stands: no application yet (PENDING), one in progress or placed (ACTIVE), or only rejected/withdrawn ones (REJECTED). */
/**
 * PENDING / ACTIVE / REJECTED = where they stand on the pipeline. REAPPLIED = rejected once and now live on another
 * job. SUGGESTED = rejected people for whom an OPEN job similar to the one they were turned down for exists now.
 */
export const REVIEW_STATUSES = ['PENDING', 'ACTIVE', 'REJECTED', 'REAPPLIED', 'SUGGESTED'] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

const RECRUITMENT_STAGE_VALUES = ['NEW', 'CV_SENT', 'INTERVIEW_1', 'PLACEMENT'] as const;

export class ListCandidatesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: RECRUITMENT_STAGE_VALUES, description: 'Only the candidates in this recruiting stage' })
  @IsOptional()
  @IsIn(RECRUITMENT_STAGE_VALUES)
  recruitmentStage?: (typeof RECRUITMENT_STAGE_VALUES)[number];

  @ApiPropertyOptional({
    description: 'Matches against first/last name, email, phone, job title, current company',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional({ enum: CANDIDATE_STATUSES })
  @IsOptional()
  @IsIn(CANDIDATE_STATUSES)
  status?: (typeof CANDIDATE_STATUSES)[number];

  @ApiPropertyOptional({ description: 'Only the records this user owns (added)' })
  @IsOptional()
  @IsString()
  ownerId?: string;

  @ApiPropertyOptional({ description: 'Filter to candidates whose current employer is this Company' })
  @IsOptional()
  @IsString()
  companyId?: string;

  @ApiPropertyOptional({
    description:
      'Filter to candidates interested in this specific Job — used to rank multiple people competing for the same opening against each other',
  })
  @IsOptional()
  @IsString()
  interestedJobId?: string;

  @ApiPropertyOptional({ description: "Words of the name (first or last)" })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({ description: "Part of the location or post code" })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string;

  @ApiPropertyOptional({ description: 'Start the distance from this place (street, city or post code); used with radiusKm' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  nearLocation?: string;

  @ApiPropertyOptional({ description: 'Start the distance from this job (its place on the map); used with radiusKm' })
  @IsOptional()
  @IsString()
  nearJobId?: string;

  @ApiPropertyOptional({ description: 'Only candidates within this many km (straight line) of the start point' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  @Max(2000)
  radiusKm?: number;

  @ApiPropertyOptional({ description: "Part of the phone number" })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @ApiPropertyOptional({ description: "Part of the job title" })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  jobTitle?: string;

  @ApiPropertyOptional({ enum: ['AVAILABLE', 'ON_HOLD', 'NOT_AVAILABLE', 'DO_NOT_USE'], description: 'The Status column: AVAILABLE; ON_HOLD = at an Interview stage; NOT_AVAILABLE = placed or archived; DO_NOT_USE = do-not-contact. A status set by hand wins.' })
  @IsOptional()
  @IsIn(['AVAILABLE', 'ON_HOLD', 'NOT_AVAILABLE', 'DO_NOT_USE'])
  availability?: 'AVAILABLE' | 'ON_HOLD' | 'NOT_AVAILABLE' | 'DO_NOT_USE';

  @ApiPropertyOptional({ description: 'Post code starts with this (SW1, M1 4...)' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  postcode?: string;

  @ApiPropertyOptional({ description: 'Part of the trade' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  trade?: string;

  @ApiPropertyOptional({ description: 'Grades A, B or C, comma separated (A,B)' })
  @IsOptional()
  @IsString()
  @Matches(/^[ABC](,[ABC]){0,2}$/, { message: 'grade must be A, B or C (comma separated)' })
  grade?: string;

  @ApiPropertyOptional({ enum: ['EMPLOYED', 'SELF_EMPLOYED', 'UNEMPLOYED'] })
  @IsOptional()
  @IsIn(['EMPLOYED', 'SELF_EMPLOYED', 'UNEMPLOYED'])
  employmentStatus?: 'EMPLOYED' | 'SELF_EMPLOYED' | 'UNEMPLOYED';

  @ApiPropertyOptional({ description: 'At least this many years of experience' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(70)
  experienceMin?: number;

  @ApiPropertyOptional({ description: 'Words found in the experience notes, job title or trade (every word must match)' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  experience?: string;

  @ApiPropertyOptional({ description: 'Has ALL of these skills (comma separated)' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  skills?: string;

  @ApiPropertyOptional({ description: 'Has ALL of these qualifications (comma separated)' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  qualifications?: string;

  @ApiPropertyOptional({ description: 'Last contacted on or after this date (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  contactedFrom?: string;

  @ApiPropertyOptional({ description: 'Last contacted on or before this date (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  contactedTo?: string;

  @ApiPropertyOptional({ description: 'Never contacted, or not since this date (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  notContactedSince?: string;

  @ApiPropertyOptional({ enum: ['WEBSITE', 'MANUAL'], description: 'WEBSITE = the person filled in the application form on the public website; MANUAL = added by someone in the CRM (typed in or imported)' })
  @IsOptional()
  @IsIn(['WEBSITE', 'MANUAL'])
  origin?: 'WEBSITE' | 'MANUAL';

  @ApiPropertyOptional({ enum: REVIEW_STATUSES, description: 'Where the applicant stands: PENDING (no application yet), ACTIVE (application in progress or placed), REJECTED (only rejected/withdrawn applications)' })
  @IsOptional()
  @IsIn(REVIEW_STATUSES)
  reviewStatus?: ReviewStatus;

  @ApiPropertyOptional({
    description: 'Filter to candidates with no Application yet — the unassigned applicant pool',
  })
  @IsOptional()
  // ValidationPipe's enableImplicitConversion already coerces "true"/"false"
  // query strings to real booleans before this runs — comparing against the
  // string 'true' alone silently drops the filter, so both forms are handled.
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  unassigned?: boolean;

  @ApiPropertyOptional({
    description:
      'Filter to candidates with at least one Application — the pipeline board\'s "Applicant" filter uses this so it only lists people actually on a board, not the whole candidate pool',
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  hasApplications?: boolean;
}
