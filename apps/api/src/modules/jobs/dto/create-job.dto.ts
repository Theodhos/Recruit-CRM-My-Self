import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsObject,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MaxLength,
  MinLength,
} from 'class-validator';

const JOB_STATUSES = ['DRAFT', 'OPEN', 'ON_HOLD', 'CLOSED', 'ARCHIVED'] as const;
const EMPLOYMENT_TYPES = ['PERMANENT', 'TEMPORARY'] as const;

export class CreateJobDto {
  @ApiPropertyOptional({ description: 'Link to an existing Company by id — omit if unknown yet' })
  @IsOptional()
  @IsString()
  companyId?: string;

  @ApiPropertyOptional({
    description:
      'Free-text company name, resolved the same way as Candidate.currentCompany: matched to an existing Company by name or a new one is created. Ignored if companyId is also set.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  companyName?: string;

  @ApiPropertyOptional({ description: 'Left blank, the job is still created as "Untitled job"' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' && value.trim() === '' ? undefined : typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10_000)
  description?: string;

  @ApiPropertyOptional({ description: 'What the candidate will do in the job, one duty per line' })
  @IsOptional()
  @IsString()
  @MaxLength(10_000)
  responsibilities?: string;

  @ApiPropertyOptional({ description: 'What the job asks of the candidate, one requirement per line' })
  @IsOptional()
  @IsString()
  @MaxLength(10_000)
  requirements?: string;

  @ApiPropertyOptional({ description: 'Skills the job needs, one per line (shown on the website)' })
  @IsOptional()
  @IsString()
  @MaxLength(5_000)
  skills?: string;

  @ApiPropertyOptional({ description: 'Qualifications, licences or cards the job needs, one per line (shown on the website)' })
  @IsOptional()
  @IsString()
  @MaxLength(5_000)
  qualifications?: string;

  @ApiPropertyOptional({ description: 'How to apply (shown on the website next to the apply button)' })
  @IsOptional()
  @IsString()
  @MaxLength(5_000)
  applicationInstructions?: string;

  @ApiPropertyOptional({ description: 'Years of experience asked for (null clears it)', nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(60)
  experienceYearsMin?: number | null;

  @ApiPropertyOptional({
    description: 'Upper end of the experience range; leave empty for "at least min" (null clears it)',
    nullable: true,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(60)
  experienceYearsMax?: number | null;

  @ApiPropertyOptional({
    description: 'The pay package beyond the salary range: bonus, benefits, allowances, leave — one item per line',
  })
  @IsOptional()
  @IsString()
  @MaxLength(10_000)
  compensationPackage?: string;

  @ApiProperty({ description: 'How many candidates the job needs filled — required for every job' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  candidatesNeeded!: number;

  @ApiPropertyOptional({ description: "Temporary jobs: the working hours, e.g. 8 hours a day" })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  workingHours?: string;

  @ApiPropertyOptional({ description: "Temporary jobs: the days off, e.g. Saturday, Sunday" })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  daysOff?: string;

  @ApiPropertyOptional({ description: "Temporary jobs: one shift per person, the first person first", type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  shifts?: string[];

  @ApiPropertyOptional({ description: 'The date range in which candidates have to be found: start (YYYY-MM-DD); null clears it', nullable: true })
  @IsOptional()
  @IsDateString()
  recruitStartDate?: string | null;

  @ApiPropertyOptional({ description: 'The date the candidates have to be found by (YYYY-MM-DD); when it arrives the job moves to the top and turns red; null clears it', nullable: true })
  @IsOptional()
  @IsDateString()
  recruitEndDate?: string | null;

  @ApiPropertyOptional({ description: "Temporary jobs: start/end date, timezone, recurring type (WEEKLY / PATTERN), the per-day shift grid and the working weekdays" })
  @IsOptional()
  @IsObject()
  schedule?: Record<string, unknown>;

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
  postcode?: string;

  @ApiPropertyOptional({ enum: EMPLOYMENT_TYPES })
  @IsOptional()
  @IsIn(EMPLOYMENT_TYPES)
  employmentType?: (typeof EMPLOYMENT_TYPES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  salaryMin?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  salaryMax?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @ApiPropertyOptional({ enum: JOB_STATUSES })
  @IsOptional()
  @IsIn(JOB_STATUSES)
  status?: (typeof JOB_STATUSES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ownerId?: string;

  @ApiPropertyOptional({ type: [String], description: 'The other recruiters who work the job together with the owner' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  coRecruiterIds?: string[];

  @ApiPropertyOptional({ description: 'Publish the job on the public careers website (it shows while status is OPEN and not expired)' })
  @IsOptional()
  @IsBoolean()
  publishedOnWebsite?: boolean;

  @ApiPropertyOptional({ description: 'Show the salary range on the website' })
  @IsOptional()
  @IsBoolean()
  showSalary?: boolean;

  @ApiPropertyOptional({ description: 'The vacancy leaves the website automatically on this date (YYYY-MM-DD); null clears it', nullable: true })
  @IsOptional()
  @IsDateString()
  expiresAt?: string | null;
}
