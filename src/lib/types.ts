export type JobStatus = 'scheduled' | 'in_progress' | 'done' | 'invoiced';

export interface ChecklistItem { id: string; text: string; done: boolean }
export interface Part { id: string; name: string; qty: number; unitCents: number }
export interface TimeEntry { id: string; start: string; end?: string }
export interface PhotoMeta { id: string; name: string; addedAt: string }
export interface Signature { dataUrl: string; signedAt: string; signerName: string }

export interface Job {
  id: string;
  number: number;
  status: JobStatus;
  title: string;
  customerName: string;
  phone: string;
  email: string;
  address: string;
  scheduledFor: string; // ISO datetime
  notes: string;
  checklist: ChecklistItem[];
  parts: Part[];
  time: TimeEntry[];
  photos: PhotoMeta[];
  signature?: Signature;
  createdAt: string;
  updatedAt: string;
}

export interface Settings {
  businessName: string;
  businessPhone: string;
  hourlyRateCents: number;
  /** Tax rate in basis points: 825 = 8.25% */
  taxRateBp: number;
  taxLabor: boolean;
  /** Billable time rounds up to this many minutes (0 or 1 = exact) */
  roundUpMinutes: number;
  /** Minimum billable minutes once any time is logged */
  minimumMinutes: number;
  invoicePrefix: string;
  nextNumber: number;
}

export const DEFAULT_SETTINGS: Settings = {
  businessName: 'Your Business Name',
  businessPhone: '',
  hourlyRateCents: 9500,
  taxRateBp: 0,
  taxLabor: false,
  roundUpMinutes: 15,
  minimumMinutes: 0,
  invoicePrefix: 'INV-',
  nextNumber: 1001,
};

export interface Totals {
  billableMinutes: number;
  laborCents: number;
  partsCents: number;
  taxCents: number;
  totalCents: number;
}
