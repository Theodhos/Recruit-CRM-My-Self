import { Global, Module } from '@nestjs/common';

import { GeocodingService } from './geocoding.service';
import { PlaceSuggestController } from './place-suggest.controller';
import { PlaceSuggestService } from './place-suggest.service';

@Global()
@Module({ controllers: [PlaceSuggestController], providers: [GeocodingService, PlaceSuggestService], exports: [GeocodingService] })
export class GeocodingModule {}
