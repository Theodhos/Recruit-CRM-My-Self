'use client';

import { MapPin, X } from '@crm/ui/icons';
import { type ReactNode } from 'react';

import { PlaceInput } from './place-input';

export { useDebounced } from './use-debounced';

/** Distances are shown and chosen in miles; the longest the slider goes is 200 miles. */
export const RADIUS_DEFAULT_MAX = 200;
export const RADIUS_LIMIT = 200;
const STEP = 5;
const KM_PER_MILE = 1.609344;

/** What the list asks the server for: the distance in km, as exact as the miles chosen. */
export const milesToKm = (miles: number): number => Math.max(0.1, Math.round(miles * KM_PER_MILE * 1000) / 1000);

/**
 * The end of the slider, in miles: the farthest record of the list from the start point (the server gives km), plus a few
 * miles, rounded up to the step — so the whole list is within reach — but never more than 200 miles.
 */
export function sliderMax(farthestKm: number | null | undefined): number {
  if (farthestKm == null) return RADIUS_DEFAULT_MAX;
  const farthestMiles = farthestKm / KM_PER_MILE;
  return Math.min(RADIUS_LIMIT, Math.max(STEP * 2, Math.ceil((farthestMiles + STEP) / STEP) * STEP));
}

interface DistanceRangeFilterProps {
  /** What the list is: "jobs" / "candidates". */
  subject: string;
  /** The typed start point: a street, a city or a post code. */
  place: string;
  onPlace: (value: string) => void;
  /** The chosen distance in miles; 0 = off. */
  km: number;
  onKm: (value: number) => void;
  /** A start point is chosen (typed or picked): without one the slider has nothing to measure from. */
  hasStart?: boolean;
  /** How many records are not on the map, so a distance search cannot include them. */
  unlocated?: number;
  /** Clears the start point and the distance. */
  onClear?: () => void;
  /** The "or start from a job / candidate" picker. */
  children?: ReactNode;
  /** The start point comes from the picker, so the typed place is not used. */
  pickerActive?: boolean;
  /** The end of the slider (see sliderMax). */
  max?: number;
  /** The box spans the full width of the page and the slider takes the space that is left (Jobs). */
  fill?: boolean;
}

/**
 * The "Distance range" box of the Jobs and Candidates pages: a start point (a typed street / city / post code, or the place of
 * a job / candidate) and a slider for how many miles around it. The number floats above the handle; the list below follows it.
 */
export function DistanceRangeFilter({ subject, place, onPlace, km, onKm, children, pickerActive, max = RADIUS_DEFAULT_MAX, fill, hasStart = true, unlocated = 0, onClear }: DistanceRangeFilterProps) {
  const shownKm = Math.min(km, max);
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-accent/40 px-3 py-2">
      <div className="flex items-center gap-1.5 text-sm font-semibold">
        <MapPin className="h-4 w-4 text-primary" />
        Distance range
        <span className="font-normal text-foreground/60">— {subject} within x miles of a place</span>
        {(place || km > 0 || pickerActive) && onClear ? (
          <button type="button" onClick={onClear} className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium text-foreground/60 hover:bg-accent hover:text-foreground">
            <X className="h-3 w-3" /> Clear
          </button>
        ) : null}
      </div>
      <div className={fill ? 'flex flex-wrap items-end gap-6' : 'flex flex-wrap items-end gap-4'}>
        <PlaceInput value={place} onChange={onPlace} disabled={pickerActive} />
        {children}
        <div className={fill ? 'relative min-w-56 flex-1 pt-5' : 'relative w-56 pt-5'}>
          {/* the chosen distance floats above the handle and moves with it */}
          <span
            className="pointer-events-none absolute top-0 -translate-x-1/2 rounded bg-primary px-1.5 py-0.5 text-xs font-semibold tabular-nums text-primary-foreground"
            style={{ left: `calc(${(shownKm / max) * 100}% + ${(0.5 - shownKm / max) * 16}px)` }}
          >
            {shownKm === 0 ? 'Off' : `${shownKm} mi`}
          </span>
          <input
            type="range"
            aria-label="Distance in miles"
            disabled={!hasStart}
            title={hasStart ? (unlocated > 0 ? `${unlocated.toLocaleString('en-GB')} without a place on the map are not included` : undefined) : 'Choose a start point first'}
            className="h-2 w-full cursor-pointer accent-primary disabled:cursor-not-allowed disabled:opacity-40"
            min={0}
            max={max}
            step={STEP}
            value={shownKm}
            onChange={(event) => onKm(Number(event.target.value))}
          />
        </div>
      </div>
    </div>
  );
}
