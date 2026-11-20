import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsArray, IsDateString, IsEmail, IsIn, IsInt, IsObject, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

import { parseList } from '../lib/list-values';

const CANDIDATE_STATUSES = ['ACTIVE', 'PASSIVE', 'DO_NOT_CONTACT', 'PLACED', 'ARCHIVED'] as const;

export const MANUAL_STATUSES = ['AVAILABLE', 'ON_HOLD', 'NOT_AVAILABLE', 'DO_NOT_USE'] as const;

export const CANDIDATE_GRADES = ['A', 'B', 'C'] as const;
export const EMPLOYMENT_STATUSES = ['EMPLOYED', 'SELF_EMPLOYED', 'UNEMPLOYED'] as const;
export const CONSENT_STATUSES = ['UNKNOWN', 'GRANTED', 'OPTED_OUT'] as const;

export const RECRUITMENT_STAGES = ['NEW', 'CV_SENT', 'INTERVIEW_1', 'PLACEMENT'] as const;

export class CreateCandidateDto {
  @ApiPropertyOptional({ enum: RECRUITMENT_STAGES, description: 'Recruiting stage used to complete the candidate data' })
  @IsOptional()
  @IsIn(RECRUITMENT_STAGES)
  recruitmentStage?: (typeof RECRUITMENT_STAGES)[number];

  @ApiPropertyOptional({ description: 'What was written in each recruiting stage: { STAGE: { field: text } }' })
  @IsOptional()
  @IsObject()
  stageData?: Record<string, Record<string, string>>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(150)
  location?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(150)
  street?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  postalCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(150)
  jobTitle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(150)
  currentCompany?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  source?: string;

  @ApiPropertyOptional({ description: 'Trade, e.g. electrician; several trades are separated by commas' })
  @IsOptional()
  @IsString()
  @MaxLength(400)
  trade?: string;

  @ApiPropertyOptional({ enum: CANDIDATE_GRADES })
  @IsOptional()
  @IsIn(CANDIDATE_GRADES)
  grade?: (typeof CANDIDATE_GRADES)[number];

  @ApiPropertyOptional({ enum: EMPLOYMENT_STATUSES })
  @IsOptional()
  @IsIn(EMPLOYMENT_STATUSES)
  employmentStatus?: (typeof EMPLOYMENT_STATUSES)[number];

  @ApiPropertyOptional({ description: 'Years of experience' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(70)
  experienceYears?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  experienceNotes?: string;

  @ApiPropertyOptional({ description: 'Comma- or line-separated; stored one by one, lower-case', type: [String] })
  @IsOptional()
  @Transform(({ value }) => parseList(value))
  @IsArray()
  @IsString({ each: true })
  skills?: string[];

  @ApiPropertyOptional({ description: 'Comma- or line-separated; stored one by one, lower-case', type: [String] })
  @IsOptional()
  @Transform(({ value }) => parseList(value))
  @IsArray()
  @IsString({ each: true })
  qualifications?: string[];

  @ApiPropertyOptional({ description: 'When the candidate was last spoken to' })
  @IsOptional()
  @IsDateString()
  lastContactedAt?: string;

  @ApiPropertyOptional({ enum: CONSENT_STATUSES })
  @IsOptional()
  @IsIn(CONSENT_STATUSES)
  smsConsent?: (typeof CONSENT_STATUSES)[number];

  @ApiPropertyOptional({ enum: CONSENT_STATUSES })
  @IsOptional()
  @IsIn(CONSENT_STATUSES)
  emailConsent?: (typeof CONSENT_STATUSES)[number];

  @ApiPropertyOptional({ enum: CONSENT_STATUSES })
  @IsOptional()
  @IsIn(CONSENT_STATUSES)
  callConsent?: (typeof CONSENT_STATUSES)[number];

  @ApiPropertyOptional({ enum: CANDIDATE_STATUSES })
  @IsOptional()
  @IsIn(CANDIDATE_STATUSES)
  status?: (typeof CANDIDATE_STATUSES)[number];

  /** The status chosen by hand; null puts the candidate back on the automatic one (from the pipeline). */
  @ApiPropertyOptional({ enum: MANUAL_STATUSES, nullable: true })
  @IsOptional()
  @IsIn(MANUAL_STATUSES)
  manualStatus?: (typeof MANUAL_STATUSES)[number] | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ownerId?: string;

  @ApiPropertyOptional({
    description: 'The specific open Job this candidate is being considered for while still unassigned',
  })
  @IsOptional()
  @IsString()
  interestedJobId?: string;
}
