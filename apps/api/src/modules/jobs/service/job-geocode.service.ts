import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { GeocodingService } from '../../../infrastructure/geocoding/geocoding.service';
import { SchedulerLockService } from '../../../infrastructure/scheduler/scheduler-lock.service';
import { JobsRepository } from '../repositories/jobs.repository';

/**
 * Gives every job its place on the map (latitude / longitude, kept as plain numbers) for the "within x km" filters.
 * Done in the background within a minute of the job being saved — saving never waits for it. The address in parts
 * (street, city, post code) is used when there is one, the free-text location otherwise.
 */
@Injectable()
export class JobGeocodeService {
  private readonly logger = new Logger(JobGeocodeService.name);

  constructor(
    private readonly jobs: JobsRepository,
    private readonly geocoding: GeocodingService,
    private readonly lock: SchedulerLockService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async tick(): Promise<void> {
    await this.lock.runExclusive('job-geocode', 55_000, () => this.sweep().then(() => undefined));
  }

  private running = false;

  /** Puts up to `limit` jobs on the map; returns how many were done. */

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
    const pending = await this.jobs.findUngeocoded(limit);
    let done = 0;
    for (const job of pending) {
      if (Date.now() > deadline) break;
      const point = await this.geocoding.locateAddress({ street: job.street, city: job.city, postcode: job.postcode, location: job.location });
      // the service could not be asked: try again on the next sweep instead of marking the place "not found"
      if (point === undefined) continue;
      await this.jobs.saveGeocode(job.id, point);
      done += 1;
    }
    if (pending.length) this.logger.log(`Map sweep (jobs): ${pending.length} waiting, ${done} put on the map`);
    return done;
  }
}
