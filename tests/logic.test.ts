import { describe, expect, it } from 'vitest';
import { computeTotals, formatMoney, lineCents, parseMoney, taxCents } from '../src/lib/money';
import { billableMinutes, entryMinutes, formatDuration, trackedMinutes } from '../src/lib/time';
import { fitWithin } from '../src/lib/photo';
import { mapsUrl, telUrl } from '../src/lib/format';
import { DEFAULT_SETTINGS, type Settings } from '../src/lib/types';

const settings = (over: Partial<Settings> = {}): Settings => ({ ...DEFAULT_SETTINGS, hourlyRateCents: 10000, ...over });
const T0 = '2026-03-02T09:00:00.000Z';
const at = (min: number) => new Date(Date.parse(T0) + min * 60000).toISOString();

describe('money', () => {
  it('parses typed amounts into cents', () => {
    expect(parseMoney('12.5')).toBe(1250);
    expect(parseMoney('$1,200')).toBe(120000);
    expect(parseMoney('.99')).toBe(99);
    expect(parseMoney('0')).toBe(0);
  });
  it('rejects bad amounts', () => {
    for (const bad of ['', '.', 'abc', '1.234', '-5', '1..2']) expect(parseMoney(bad)).toBeNull();
  });
  it('formats cents with separators', () => {
    expect(formatMoney(0)).toBe('$0.00');
    expect(formatMoney(123456789)).toBe('$1,234,567.89');
    expect(formatMoney(-250)).toBe('-$2.50');
  });
  it('prices fractional quantities and rounds to a cent', () => {
    expect(lineCents({ qty: 2.5, unitCents: 399 })).toBe(998);
    expect(lineCents({ qty: 3, unitCents: 1895 })).toBe(5685);
  });
  it('computes tax in basis points, half up', () => {
    expect(taxCents(10000, 825)).toBe(825);
    expect(taxCents(1999, 825)).toBe(165); // 164.9175
    expect(taxCents(100, 50)).toBe(1); // 0.5 rounds up
    expect(taxCents(5000, 0)).toBe(0);
  });
});

describe('time', () => {
  it('measures closed and open entries', () => {
    expect(entryMinutes({ id: 'a', start: T0, end: at(90) })).toBe(90);
    expect(entryMinutes({ id: 'b', start: T0 }, new Date(at(25)))).toBe(25);
  });
  it('never returns negative or NaN minutes', () => {
    expect(entryMinutes({ id: 'a', start: at(10), end: T0 })).toBe(0);
    expect(entryMinutes({ id: 'a', start: 'garbage', end: T0 })).toBe(0);
  });
  it('sums several visits', () => {
    const entries = [{ id: '1', start: T0, end: at(30) }, { id: '2', start: at(120), end: at(165) }];
    expect(trackedMinutes(entries)).toBe(75);
  });
  it('rounds up to the increment and applies the minimum', () => {
    expect(billableMinutes(0, 15, 60)).toBe(0);
    expect(billableMinutes(1, 15, 0)).toBe(15);
    expect(billableMinutes(15, 15, 0)).toBe(15);
    expect(billableMinutes(16, 15, 0)).toBe(30);
    expect(billableMinutes(20, 15, 60)).toBe(60);
    expect(billableMinutes(61.2, 0, 0)).toBe(62);
  });
  it('formats durations', () => {
    expect(formatDuration(45)).toBe('45 min');
    expect(formatDuration(125)).toBe('2 h 05 min');
  });
});

describe('computeTotals', () => {
  const job = {
    parts: [
      { id: 'a', name: 'Capacitor', qty: 1, unitCents: 3800 },
      { id: 'b', name: 'Contactor', qty: 2, unitCents: 2450 },
    ],
    time: [{ id: 't', start: T0, end: at(100) }],
  };
  it('adds labor, parts and tax on parts only by default', () => {
    const t = computeTotals(job, settings({ taxRateBp: 825 }));
    expect(t.billableMinutes).toBe(105); // 100 rounds up to 105
    expect(t.laborCents).toBe(17500); // 105 min at $100/h
    expect(t.partsCents).toBe(8700);
    expect(t.taxCents).toBe(718); // 8700 * 8.25% = 717.75
    expect(t.totalCents).toBe(17500 + 8700 + 718);
  });
  it('can tax labor too', () => {
    const t = computeTotals(job, settings({ taxRateBp: 1000, taxLabor: true }));
    expect(t.taxCents).toBe(2620);
  });
  it('charges nothing for labor when no time was logged', () => {
    const t = computeTotals({ ...job, time: [] }, settings({ minimumMinutes: 60 }));
    expect(t.laborCents).toBe(0);
    expect(t.totalCents).toBe(8700);
  });
  it('counts a running timer up to now', () => {
    const t = computeTotals({ parts: [], time: [{ id: 't', start: T0 }] }, settings({ roundUpMinutes: 0 }), new Date(at(30)));
    expect(t.laborCents).toBe(5000);
  });
});

describe('helpers', () => {
  it('scales photos down but never up', () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 1280, height: 960 });
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  });
  it('builds map and phone links', () => {
    expect(mapsUrl('12 Oak St, Springfield')).toBe('https://www.google.com/maps/search/?api=1&query=12%20Oak%20St%2C%20Springfield');
    expect(telUrl('(555) 010-4420')).toBe('tel:5550104420');
  });
});
