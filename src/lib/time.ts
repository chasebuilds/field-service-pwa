import type { TimeEntry } from './types';

/** Minutes between start and end (or `now` for an open entry). Never negative. */
export function entryMinutes(e: TimeEntry, now: Date = new Date()): number {
  const start = Date.parse(e.start);
  const end = e.end ? Date.parse(e.end) : now.getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return 0;
  return Math.max(0, (end - start) / 60000);
}

/** Total tracked minutes across entries; an open entry counts up to `now`. Overlaps are not merged. */
export function trackedMinutes(entries: TimeEntry[], now: Date = new Date()): number {
  return entries.reduce((sum, e) => sum + entryMinutes(e, now), 0);
}

/** Round up to the increment, then apply the minimum. Zero tracked time stays zero. */
export function billableMinutes(tracked: number, roundUp: number, minimum: number): number {
  if (tracked <= 0) return 0;
  const step = roundUp > 1 ? roundUp : 1;
  const rounded = Math.ceil(tracked / step - 1e-9) * step;
  return Math.max(rounded, minimum);
}

export function formatDuration(minutes: number): string {
  const total = Math.floor(minutes);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h > 0 ? `${h} h ${String(m).padStart(2, '0')} min` : `${m} min`;
}

export function isRunning(entries: TimeEntry[]): boolean {
  return entries.some((e) => !e.end);
}
