import type { Job } from './types';

export function mapsUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

export function telUrl(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}

export function invoiceNumber(prefix: string, n: number): string {
  return `${prefix}${n}`;
}

export function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function toLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function fromLocalInput(value: string): string {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

export const STATUS_LABEL: Record<Job['status'], string> = {
  scheduled: 'Scheduled',
  in_progress: 'In progress',
  done: 'Done',
  invoiced: 'Invoiced',
};

export function uid(): string {
  return crypto.randomUUID();
}

export function checklistProgress(job: Pick<Job, 'checklist'>): { done: number; total: number } {
  return { done: job.checklist.filter((c) => c.done).length, total: job.checklist.length };
}
