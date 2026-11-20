import { CurrentTenant } from '@crm/auth';
import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

import { PlaceSuggestService } from './place-suggest.service';

class PlaceSuggestQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}

/** The suggestions under the distance filters' start-point box. No @Permissions() gate, like the header search: it only names places already visible in the lists. */
@ApiTags('geo')
@ApiBearerAuth()
@Controller('geo')
export class PlaceSuggestController {
  constructor(private readonly suggestions: PlaceSuggestService) {}

  @Get('suggest')
  suggest(@CurrentTenant() organisationId: string, @Query() query: PlaceSuggestQueryDto) {
    return this.suggestions.suggest(organisationId, query.q ?? '');
  }
}
