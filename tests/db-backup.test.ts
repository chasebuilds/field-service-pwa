import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { clearAll, deleteJob, getJob, getSettings, listJobs, listPhotos, nextJobNumber, resetDbConnection, saveJob, savePhoto, saveSettings } from '../src/lib/db';
import { BackupError, buildBackup, planMerge, restoreBackup, validateBackup } from '../src/lib/backup';
import { demoJobs } from '../src/lib/demo';
import type { Job } from '../src/lib/types';

const job = (over: Partial<Job> = {}): Job => ({ ...(demoJobs()[1] as Job), ...over });

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  resetDbConnection();
});

describe('db', () => {
  it('saves, reads and deletes a job with its photos', async () => {
    const j = job({ id: 'x1' });
    await saveJob(j);
    await savePhoto({ id: 'ph1', jobId: 'x1', blob: new Blob(['abc'], { type: 'image/jpeg' }) });
    expect((await getJob('x1'))?.customerName).toBe(j.customerName);
    expect(await listPhotos('x1')).toHaveLength(1);
    await deleteJob('x1');
    expect(await getJob('x1')).toBeUndefined();
    expect(await listPhotos('x1')).toHaveLength(0);
  });
  it('updates updatedAt on save', async () => {
    await saveJob(job({ id: 'x2', updatedAt: '2020-01-01T00:00:00.000Z' }));
    expect((await getJob('x2'))?.updatedAt).not.toBe('2020-01-01T00:00:00.000Z');
  });
  it('hands out increasing ticket numbers', async () => {
    const a = await nextJobNumber();
    const b = await nextJobNumber();
    expect(b).toBe(a + 1);
    expect((await getSettings()).nextNumber).toBe(b + 1);
  });
  it('falls back to default settings', async () => {
    expect((await getSettings()).roundUpMinutes).toBe(15);
    await saveSettings({ ...(await getSettings()), businessName: 'Acme Plumbing' });
    expect((await getSettings()).businessName).toBe('Acme Plumbing');
  });
});

describe('validateBackup', () => {
  const good = { format: 'field-service-backup', version: 1, exportedAt: '', settings: {}, jobs: [job()], photos: [] };
  it('accepts a good backup and fills default settings', () => {
    expect(validateBackup(good).settings.roundUpMinutes).toBe(15);
  });
  it('rejects wrong files', () => {
    expect(() => validateBackup({ hello: 1 })).toThrow(BackupError);
    expect(() => validateBackup(null)).toThrow(BackupError);
    expect(() => validateBackup({ ...good, version: 99 })).toThrow(/newer version/);
    expect(() => validateBackup({ ...good, jobs: [{ id: 1 }] })).toThrow(/damaged/);
    const evil = job({ signature: { dataUrl: 'javascript:alert(1)', signedAt: '', signerName: '' } });
    expect(() => validateBackup({ ...good, jobs: [evil] })).toThrow(/damaged/);
    expect(() => validateBackup({ ...good, photos: [{ id: 'a', jobId: 'b', dataUrl: 'http://evil' }] })).toThrow(/photo/);
  });
});

describe('merge and round trip', () => {
  it('keeps the newer copy of a job', () => {
    const older = job({ id: 'a', updatedAt: '2026-01-01T00:00:00.000Z' });
    const newer = job({ id: 'a', updatedAt: '2026-02-01T00:00:00.000Z' });
    expect(planMerge([older], [newer]).toWrite).toHaveLength(1);
    expect(planMerge([newer], [older])).toEqual({ toWrite: [], skipped: 1 });
    expect(planMerge([], [older]).toWrite).toHaveLength(1);
  });
  it('exports then restores into an empty database, photos included', async () => {
    await saveJob(job({ id: 'r1', number: 1500 }));
    await savePhoto({ id: 'rp1', jobId: 'r1', blob: new Blob(['jpegbytes'], { type: 'image/jpeg' }) });
    const backup = JSON.parse(JSON.stringify(await buildBackup()));
    expect(backup.photos[0].dataUrl.startsWith('data:image/jpeg')).toBe(true);
    await clearAll();
    expect(await listJobs()).toHaveLength(0);
    const res = await restoreBackup(backup);
    expect(res.written).toBe(1);
    const restored = await getJob('r1');
    expect(restored?.number).toBe(1500);
    const photos = await listPhotos('r1');
    expect(await photos[0]?.blob.text()).toBe('jpegbytes');
    expect((await getSettings()).nextNumber).toBeGreaterThan(1500);
  });
});
