import { DEFAULT_SETTINGS, type Job, type Settings } from './types';
import { clearAll, saveJob, savePhoto, saveSettings } from './db';
import { makePlaceholderPhoto } from './photo';

export const DEMO_SETTINGS: Settings = {
  ...DEFAULT_SETTINGS,
  businessName: 'Northline Heating & Air (demo)',
  businessPhone: '(555) 010-4420',
  hourlyRateCents: 9500,
  taxRateBp: 825,
  taxLabor: false,
  roundUpMinutes: 15,
  minimumMinutes: 60,
  nextNumber: 1006,
};

const at = (dayOffset: number, hour: number, minute = 0): Date => {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d;
};
const iso = (d: Date) => d.toISOString();
const item = (id: string, text: string, done = false) => ({ id, text, done });

/** Invented customers and addresses. Nothing here is a real person or business. */
export function demoJobs(): Job[] {
  const base = { photos: [], email: '', notes: '', createdAt: iso(at(-3, 9)), updatedAt: iso(at(0, 7)) };
  return [
    {
      ...base,
      id: 'demo-1005',
      number: 1005,
      status: 'in_progress',
      title: 'No cooling, outdoor unit not starting',
      customerName: 'Priya Raman',
      phone: '(555) 010-7731',
      email: 'priya@example.invalid',
      address: '418 Alder Court, Springfield',
      scheduledFor: iso(at(0, 9)),
      notes: 'Unit hums but fan does not spin. Homeowner says it started two days ago. Dog in backyard, gate latch is stiff.',
      checklist: [
        item('c1', 'Confirm thermostat set to cool', true),
        item('c2', 'Check breaker and disconnect', true),
        item('c3', 'Test run capacitor', true),
        item('c4', 'Replace capacitor'),
        item('c5', 'Clean condenser coil'),
        item('c6', 'Verify temperature split'),
      ],
      parts: [
        { id: 'p1', name: 'Dual run capacitor 45/5 uF', qty: 1, unitCents: 3800 },
        { id: 'p2', name: 'Contactor 30A', qty: 1, unitCents: 2450 },
      ],
      time: [{ id: 't1', start: iso(new Date(Date.now() - 47 * 60000)) }],
    },
    {
      ...base,
      id: 'demo-1004',
      number: 1004,
      status: 'scheduled',
      title: 'Kitchen faucet drip and slow drain',
      customerName: 'Marcus Webb',
      phone: '(555) 010-2268',
      email: '',
      address: '77 Birchwood Lane, Springfield',
      scheduledFor: iso(at(0, 13, 30)),
      notes: 'Second visit. Cartridge was backordered. Bring P-trap kit.',
      checklist: [item('c1', 'Shut off supply valves'), item('c2', 'Replace faucet cartridge'), item('c3', 'Clear and test drain'), item('c4', 'Check under-sink for leaks')],
      parts: [],
      time: [],
    },
    {
      ...base,
      id: 'demo-1003',
      number: 1003,
      status: 'done',
      title: 'Replace two outlets, add GFCI in bathroom',
      customerName: 'Dana Okafor',
      phone: '(555) 010-9054',
      email: 'dana@example.invalid',
      address: '9 Harbor View Drive, Unit 4B, Springfield',
      scheduledFor: iso(at(-1, 10)),
      notes: 'Old outlet in hall had scorch marks. Replaced and tested. Customer to call if breaker trips again.',
      checklist: [item('c1', 'Kill breaker and verify dead', true), item('c2', 'Replace hallway outlet', true), item('c3', 'Install GFCI outlet in bathroom', true), item('c4', 'Test all circuits', true)],
      parts: [
        { id: 'p1', name: 'GFCI outlet 15A', qty: 1, unitCents: 1895 },
        { id: 'p2', name: 'Tamper-resistant outlet', qty: 2, unitCents: 425 },
        { id: 'p3', name: 'Cover plates', qty: 3, unitCents: 150 },
      ],
      time: [{ id: 't1', start: iso(at(-1, 10, 10)), end: iso(at(-1, 11, 50)) }],
      signature: undefined,
    },
    {
      ...base,
      id: 'demo-1002',
      number: 1002,
      status: 'invoiced',
      title: 'Annual furnace tune-up',
      customerName: 'Hollis & Grant Dental',
      phone: '(555) 010-6612',
      email: '',
      address: '2200 Commerce Way, Suite 6, Springfield',
      scheduledFor: iso(at(-4, 8)),
      notes: 'Rooftop unit access through the back stairwell. Filters are 20x25x4.',
      checklist: [item('c1', 'Replace filters', true), item('c2', 'Inspect heat exchanger', true), item('c3', 'Check combustion', true)],
      parts: [{ id: 'p1', name: 'Pleated filter 20x25x4', qty: 4, unitCents: 2250 }],
      time: [{ id: 't1', start: iso(at(-4, 8, 0)), end: iso(at(-4, 10, 20)) }],
    },
    {
      ...base,
      id: 'demo-1001',
      number: 1001,
      status: 'scheduled',
      title: 'Water heater estimate, 40 gal electric',
      customerName: 'Elena Petrov',
      phone: '(555) 010-3345',
      email: '',
      address: '31 Cedar Hollow Road, Springfield',
      scheduledFor: iso(at(1, 11)),
      notes: 'Tank is about 12 years old. Basement access is narrow.',
      checklist: [item('c1', 'Measure space and note venting'), item('c2', 'Photo of data plate'), item('c3', 'Quote two options')],
      parts: [],
      time: [],
    },
  ];
}

export async function seedDemo(): Promise<void> {
  await clearAll();
  await saveSettings(DEMO_SETTINGS);
  const jobs = demoJobs();
  const first = jobs[0];
  if (first) {
    for (const [i, label] of ['Condenser unit', 'Burnt contactor'].entries()) {
      const blob = await makePlaceholderPhoto(label, i);
      const id = `demo-photo-${i}`;
      await savePhoto({ id, jobId: first.id, blob });
      first.photos.push({ id, name: `${label}.jpg`, addedAt: iso(at(0, 9, 12 + i)) });
    }
  }
  for (const j of jobs) await saveJob(j, false);
}
