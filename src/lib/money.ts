import type { Job, Part, Settings, Totals } from './types';
import { billableMinutes, trackedMinutes } from './time';

/** Parse "12.50", "$1,200", "3" into integer cents. Returns null when not a valid amount. */
export function parseMoney(input: string): number | null {
  const cleaned = input.trim().replace(/^\$/, '').replace(/,/g, '');
  if (!/^\d*\.?\d{0,2}$/.test(cleaned) || cleaned === '' || cleaned === '.') return null;
  const [whole = '0', frac = ''] = cleaned.split('.');
  return Number(whole || '0') * 100 + Number(frac.padEnd(2, '0'));
}

export function formatMoney(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(Math.round(cents));
  const dollars = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${sign}$${dollars}.${String(abs % 100).padStart(2, '0')}`;
}

/** Cents for qty * unit price. qty may be fractional (e.g. 2.5 ft of pipe). */
export function lineCents(part: Pick<Part, 'qty' | 'unitCents'>): number {
  return Math.round(part.qty * part.unitCents);
}

/** Tax in cents for a taxable base, rate in basis points, rounded half up. */
export function taxCents(baseCents: number, rateBp: number): number {
  return Math.round((baseCents * rateBp) / 10000);
}

export function computeTotals(job: Pick<Job, 'parts' | 'time'>, s: Settings, now: Date = new Date()): Totals {
  const minutes = billableMinutes(trackedMinutes(job.time, now), s.roundUpMinutes, s.minimumMinutes);
  const laborCents = Math.round((minutes * s.hourlyRateCents) / 60);
  const partsCents = job.parts.reduce((sum, p) => sum + lineCents(p), 0);
  const base = partsCents + (s.taxLabor ? laborCents : 0);
  const tax = taxCents(base, s.taxRateBp);
  return { billableMinutes: minutes, laborCents, partsCents, taxCents: tax, totalCents: laborCents + partsCents + tax };
}
