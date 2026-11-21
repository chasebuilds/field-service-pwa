import { DEFAULT_SETTINGS, type Job, type Settings } from './types';
import { getSettings, listAllPhotos, listJobs, saveJob, savePhoto, saveSettings } from './db';

export const BACKUP_FORMAT = 'field-service-backup';
export const BACKUP_VERSION = 1;

export interface BackupPhoto { id: string; jobId: string; dataUrl: string }
export interface Backup {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  settings: Settings;
  jobs: Job[];
  photos: BackupPhoto[];
}

export class BackupError extends Error {}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function validJob(j: unknown): j is Job {
  if (!isObj(j)) return false;
  return (
    isStr(j.id) && isNum(j.number) && isStr(j.title) && isStr(j.customerName) && isStr(j.address) &&
    isStr(j.status) && ['scheduled', 'in_progress', 'done', 'invoiced'].includes(j.status) &&
    Array.isArray(j.checklist) && Array.isArray(j.parts) && Array.isArray(j.time) && Array.isArray(j.photos) &&
    j.parts.every((p) => isObj(p) && isStr(p.id) && isNum(p.qty) && isNum(p.unitCents)) &&
    j.time.every((t) => isObj(t) && isStr(t.start)) &&
    (j.signature === undefined || (isObj(j.signature) && isStr(j.signature.dataUrl) && j.signature.dataUrl.startsWith('data:image/png;base64,')))
  );
}

/** Check an untrusted parsed JSON value and return a clean Backup, or throw BackupError. */
export function validateBackup(raw: unknown): Backup {
  if (!isObj(raw) || raw.format !== BACKUP_FORMAT) throw new BackupError('This file is not a Field Service backup.');
  if (!isNum(raw.version) || raw.version > BACKUP_VERSION) throw new BackupError('This backup was made by a newer version of the app.');
  if (!Array.isArray(raw.jobs)) throw new BackupError('Backup has no jobs list.');
  const bad = raw.jobs.findIndex((j) => !validJob(j));
  if (bad >= 0) throw new BackupError(`Job ${bad + 1} in the backup is damaged.`);
  const photos = Array.isArray(raw.photos) ? raw.photos : [];
  for (const p of photos) {
    if (!isObj(p) || !isStr(p.id) || !isStr(p.jobId) || !isStr(p.dataUrl) || !p.dataUrl.startsWith('data:image/')) {
      throw new BackupError('A photo in the backup is damaged.');
    }
  }
  return {
    format: BACKUP_FORMAT,
    version: raw.version,
    exportedAt: isStr(raw.exportedAt) ? raw.exportedAt : '',
    settings: { ...DEFAULT_SETTINGS, ...(isObj(raw.settings) ? (raw.settings as Partial<Settings>) : {}) },
    jobs: raw.jobs as Job[],
    photos: photos as BackupPhoto[],
  };
}

/** Pick which jobs to write: a job from the backup wins only when it is newer than the local copy. */
export function planMerge(local: Job[], incoming: Job[]): { toWrite: Job[]; skipped: number } {
  const byId = new Map(local.map((j) => [j.id, j]));
  const toWrite: Job[] = [];
  let skipped = 0;
  for (const j of incoming) {
    const existing = byId.get(j.id);
    if (!existing || existing.updatedAt < j.updatedAt) toWrite.push(j);
    else skipped++;
  }
  return { toWrite, skipped };
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:${blob.type || 'image/jpeg'};base64,${btoa(binary)}`;
}

async function dataUrlToBlob(url: string): Promise<Blob> {
  return (await fetch(url)).blob();
}

export async function buildBackup(): Promise<Backup> {
  const [settings, jobs, photos] = await Promise.all([getSettings(), listJobs(), listAllPhotos()]);
  const outPhotos: BackupPhoto[] = [];
  for (const p of photos) outPhotos.push({ id: p.id, jobId: p.jobId, dataUrl: await blobToDataUrl(p.blob) });
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: new Date().toISOString(), settings, jobs, photos: outPhotos };
}

export async function restoreBackup(raw: unknown): Promise<{ written: number; skipped: number }> {
  const backup = validateBackup(raw);
  const local = await listJobs();
  const { toWrite, skipped } = planMerge(local, backup.jobs);
  const writeIds = new Set(toWrite.map((j) => j.id));
  for (const job of toWrite) await saveJob(job, false);
  for (const p of backup.photos.filter((x) => writeIds.has(x.jobId))) {
    await savePhoto({ id: p.id, jobId: p.jobId, blob: await dataUrlToBlob(p.dataUrl) });
  }
  const current = await getSettings();
  const maxNumber = Math.max(current.nextNumber, backup.settings.nextNumber, ...backup.jobs.map((j) => j.number + 1));
  if (local.length === 0) await saveSettings({ ...backup.settings, nextNumber: maxNumber });
  else await saveSettings({ ...current, nextNumber: maxNumber });
  return { written: toWrite.length, skipped };
}
