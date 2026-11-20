import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

const COMPANY_STATUSES = ['PROSPECT', 'ACTIVE_CLIENT', 'FORMER_CLIENT', 'INACTIVE'] as const;
const AVAILABILITIES = ['AVAILABLE', 'NOT_AVAILABLE', 'DO_NOT_USE'] as const;

const TEAM_FILTERS = ['WITH', 'WITHOUT'] as const;

export class ListCompaniesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Matches any column: name, industry, email, city, status, added by' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional({ description: 'Name contains' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({ description: 'Industry contains' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  industry?: string;

  @ApiPropertyOptional({ description: 'City contains' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  city?: string;

  @ApiPropertyOptional({ enum: TEAM_FILTERS, description: 'WITH = has employees placed with it; WITHOUT = none' })
  @IsOptional()
  @IsIn(TEAM_FILTERS)
  team?: (typeof TEAM_FILTERS)[number];

  @ApiPropertyOptional({ description: 'Only the records this user owns (added)' })
  @IsOptional()
  @IsString()
  ownerId?: string;

  @ApiPropertyOptional({ enum: AVAILABILITIES, description: 'AVAILABLE = prospect or active client; NOT_AVAILABLE = former client; DO_NOT_USE = inactive' })
  @IsOptional()
  @IsIn(AVAILABILITIES)
  availability?: (typeof AVAILABILITIES)[number];

  @ApiPropertyOptional({ enum: COMPANY_STATUSES })
  @IsOptional()
  @IsIn(COMPANY_STATUSES)
  status?: (typeof COMPANY_STATUSES)[number];
}
