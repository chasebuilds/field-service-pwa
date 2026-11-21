import { useRef, useState } from 'preact/hooks';
import { BackupError, buildBackup, restoreBackup } from '../lib/backup';
import { clearAll, saveSettings, setFlag } from '../lib/db';
import { seedDemo } from '../lib/demo';
import { formatMoney, parseMoney } from '../lib/money';
import type { Settings } from '../lib/types';

interface Props { settings: Settings; onChange: () => Promise<void>; install: (() => void) | null }

export function SettingsView({ settings, onChange, install }: Props) {
  const [s, setS] = useState(settings);
  const [rate, setRate] = useState((settings.hourlyRateCents / 100).toFixed(2));
  const [tax, setTax] = useState((settings.taxRateBp / 100).toString());
  const [msg, setMsg] = useState('');
  const file = useRef<HTMLInputElement>(null);

  const save = async (e: Event) => {
    e.preventDefault();
    const cents = parseMoney(rate);
    const taxPct = Number(tax);
    if (cents === null) return setMsg('Hourly rate must look like 95.00.');
    if (!Number.isFinite(taxPct) || taxPct < 0 || taxPct > 30) return setMsg('Tax rate must be between 0 and 30.');
    await saveSettings({ ...s, hourlyRateCents: cents, taxRateBp: Math.round(taxPct * 100) });
    await onChange();
    setMsg('Saved.');
  };

  const exportBackup = async () => {
    const backup = await buildBackup();
    const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `field-service-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    setMsg(`Exported ${backup.jobs.length} tickets and ${backup.photos.length} photos.`);
  };

  const importBackup = async (e: Event) => {
    const input = e.currentTarget as HTMLInputElement;
    const f = input.files?.[0];
    if (!f) return;
    try {
      const res = await restoreBackup(JSON.parse(await f.text()));
      await onChange();
      setMsg(`Imported ${res.written} tickets. ${res.skipped} already up to date.`);
    } catch (err) {
      setMsg(err instanceof BackupError ? err.message : 'That file could not be read as JSON.');
    }
    input.value = '';
  };

  return (
    <section class="view">
      <div class="head"><h1>Settings</h1></div>

      {install && (
        <div class="card pad">
          <h2>Install on this device</h2>
          <p class="muted">Adds the app to your home screen and runs it without the browser bar.</p>
          <button type="button" class="btn primary" onClick={install} data-testid="install">Install app</button>
        </div>
      )}

      <form class="card pad" onSubmit={save}>
        <h2>Business and rates</h2>
        <label>Business name<input class="field" value={s.businessName} onInput={(e) => setS({ ...s, businessName: e.currentTarget.value })} /></label>
        <label>Phone on invoices<input class="field" type="tel" value={s.businessPhone} onInput={(e) => setS({ ...s, businessPhone: e.currentTarget.value })} /></label>
        <div class="two">
          <label>Hourly rate ($)<input class="field" inputMode="decimal" value={rate} onInput={(e) => setRate(e.currentTarget.value)} /></label>
          <label>Sales tax (%)<input class="field" inputMode="decimal" value={tax} onInput={(e) => setTax(e.currentTarget.value)} /></label>
        </div>
        <div class="two">
          <label>Round time up to (min)
            <select class="field" value={s.roundUpMinutes} onChange={(e) => setS({ ...s, roundUpMinutes: Number(e.currentTarget.value) })}>
              {[0, 5, 15, 30, 60].map((n) => <option value={n}>{n === 0 ? 'Exact minutes' : `${n} minutes`}</option>)}
            </select>
          </label>
          <label>Minimum billable (min)
            <select class="field" value={s.minimumMinutes} onChange={(e) => setS({ ...s, minimumMinutes: Number(e.currentTarget.value) })}>
              {[0, 30, 60, 90, 120].map((n) => <option value={n}>{n === 0 ? 'None' : `${n} minutes`}</option>)}
            </select>
          </label>
        </div>
        <label class="check"><input type="checkbox" checked={s.taxLabor} onChange={(e) => setS({ ...s, taxLabor: e.currentTarget.checked })} /><span>Charge tax on labor too</span></label>
        <p class="muted small">Example: {formatMoney(Math.round((parseMoney(rate) ?? 0) * 1.5))} for 90 minutes before rounding and tax.</p>
        <button class="btn primary" type="submit">Save settings</button>
      </form>

      <div class="card pad">
        <h2>Backup</h2>
        <p class="muted">Your data lives only on this device. Export a file now and then, and import it on a new phone.</p>
        <div class="row wrap">
          <button type="button" class="btn ghost" onClick={exportBackup} data-testid="export">Export backup</button>
          <button type="button" class="btn ghost" onClick={() => file.current?.click()}>Import backup</button>
          <input ref={file} type="file" accept="application/json,.json" hidden onChange={importBackup} data-testid="import-input" />
        </div>
      </div>

      <div class="card pad">
        <h2>Sample data</h2>
        <p class="muted">Replaces everything on this device with invented demo tickets.</p>
        <div class="row wrap">
          <button
            type="button"
            class="btn ghost"
            onClick={async () => {
              if (!confirm('Replace all tickets on this device with demo data?')) return;
              await seedDemo();
              await setFlag('seeded', true);
              await onChange();
              setMsg('Demo data loaded.');
            }}
          >
            Load demo data
          </button>
          <button
            type="button"
            class="btn ghost danger-text"
            onClick={async () => {
              if (!confirm('Delete every ticket and photo on this device? Export a backup first. This cannot be undone.')) return;
              await clearAll();
              await setFlag('seeded', true);
              await onChange();
              setMsg('All tickets deleted.');
            }}
          >
            Delete all tickets
          </button>
        </div>
      </div>

      {msg && <p class="toast" role="status">{msg}</p>}
    </section>
  );
}
