import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { GeocodingService } from '../../../infrastructure/geocoding/geocoding.service';
import { SchedulerLockService } from '../../../infrastructure/scheduler/scheduler-lock.service';
import { CandidatesRepository } from '../repositories/candidates.repository';

/** Gives every candidate a place on the map (latitude / longitude) from their street, city, post code or location — see JobGeocodeService. */
@Injectable()
export class CandidateGeocodeService {
  private readonly logger = new Logger(CandidateGeocodeService.name);

  constructor(
    private readonly candidates: CandidatesRepository,
    private readonly geocoding: GeocodingService,
    private readonly lock: SchedulerLockService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async tick(): Promise<void> {
    await this.lock.runExclusive('candidate-geocode', 55_000, () => this.sweep().then(() => undefined));
  }

  private running = false;

  async sweep(limit = 40): Promise<number> {
    if (this.running) return 0; // the last sweep is still going
    this.running = true;
    try {
      return await this.sweepOnce(limit);
    } finally {
      this.running = false;
    }
  }

  private async sweepOnce(limit: number): Promise<number> {
    const deadline = Date.now() + 45_000; // leave room before the next minute
    const pending = await this.candidates.findUngeocoded(limit);
    let done = 0;
    for (const person of pending) {
      if (Date.now() > deadline) break;
      const point = await this.geocoding.locateAddress({ street: person.street, city: person.city, postcode: person.postalCode, location: person.location });
      if (point === undefined) continue;
      await this.candidates.saveGeocode(person.id, point);
      done += 1;
    }
    if (pending.length) this.logger.log(`Map sweep (candidates): ${pending.length} waiting, ${done} put on the map`);
    return done;
  }
}
