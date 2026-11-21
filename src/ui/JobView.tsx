import { useEffect, useRef, useState } from 'preact/hooks';
import { deleteJob, deletePhoto, listPhotos, saveJob, savePhoto, type PhotoRecord } from '../lib/db';
import { checklistProgress, formatWhen, fromLocalInput, mapsUrl, STATUS_LABEL, telUrl, toLocalInput, uid } from '../lib/format';
import { computeTotals, formatMoney, lineCents, parseMoney } from '../lib/money';
import { shrinkPhoto } from '../lib/photo';
import { entryMinutes, formatDuration, isRunning, trackedMinutes } from '../lib/time';
import type { Job, JobStatus, Settings } from '../lib/types';
import { go, useNow } from './hooks';
import { SignaturePad } from './SignaturePad';

interface Props { job: Job; settings: Settings; onChange: () => Promise<void> }

export function JobView({ job: initial, settings, onChange }: Props) {
  const [job, setJob] = useState(initial);
  const now = useNow();
  const timer = useRef<number>(0);

  // Save immediately for taps, debounced for typing.
  const update = (patch: Partial<Job>, immediate = true) => {
    const next = { ...job, ...patch };
    setJob(next);
    clearTimeout(timer.current);
    const write = () => void saveJob(next).then(onChange);
    if (immediate) write();
    else timer.current = window.setTimeout(write, 500);
  };
  useEffect(() => () => clearTimeout(timer.current), []);

  const totals = computeTotals(job, settings, now);
  const running = isRunning(job.time);
  const progress = checklistProgress(job);

  const clockIn = () => update({ time: [...job.time, { id: uid(), start: new Date().toISOString() }], status: job.status === 'scheduled' ? 'in_progress' : job.status });
  const clockOut = () => update({ time: job.time.map((t) => (t.end ? t : { ...t, end: new Date().toISOString() })) });

  return (
    <article class="view" data-testid="job-view">
      <div class="head">
        <div>
          <span class="num muted">Ticket #{job.number}</span>
          <h1>{job.customerName || 'Customer'}</h1>
        </div>
        <select class="field status" aria-label="Status" value={job.status} onChange={(e) => update({ status: e.currentTarget.value as JobStatus })}>
          {(Object.keys(STATUS_LABEL) as JobStatus[]).map((s) => <option value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
      </div>

      <section class="card pad">
        <label>Customer<input class="field" value={job.customerName} onInput={(e) => update({ customerName: e.currentTarget.value }, false)} /></label>
        <label>Job<input class="field" value={job.title} onInput={(e) => update({ title: e.currentTarget.value }, false)} /></label>
        <label>Address
          <input class="field" value={job.address} onInput={(e) => update({ address: e.currentTarget.value }, false)} />
        </label>
        <div class="row wrap">
          {job.address && <a class="btn ghost" href={mapsUrl(job.address)} target="_blank" rel="noopener noreferrer" data-testid="maps-link">Open in Maps</a>}
          {job.phone && <a class="btn ghost" href={telUrl(job.phone)}>Call {job.phone}</a>}
        </div>
        <div class="two">
          <label>Phone<input class="field" type="tel" value={job.phone} onInput={(e) => update({ phone: e.currentTarget.value }, false)} /></label>
          <label>Email<input class="field" type="email" value={job.email} onInput={(e) => update({ email: e.currentTarget.value }, false)} /></label>
        </div>
        <label>Scheduled
          <input class="field" type="datetime-local" value={toLocalInput(job.scheduledFor)} onChange={(e) => e.currentTarget.value && update({ scheduledFor: fromLocalInput(e.currentTarget.value) })} />
        </label>
        <span class="muted small">{formatWhen(job.scheduledFor)}</span>
      </section>

      <section class="card pad">
        <h2>Notes</h2>
        <textarea class="field" rows={4} value={job.notes} placeholder="What you found, gate codes, what the customer said" onInput={(e) => update({ notes: e.currentTarget.value }, false)} />
      </section>

      <Checklist job={job} progress={progress} update={update} />

      <section class="card pad">
        <h2>Time on site</h2>
        <div class="row between">
          <div>
            <div class="big num" data-testid="tracked">{formatDuration(trackedMinutes(job.time, now))}</div>
            <span class="muted small">Billed as {formatDuration(totals.billableMinutes)}</span>
          </div>
          {running
            ? <button type="button" class="btn danger" onClick={clockOut} data-testid="clock-out">Clock out</button>
            : <button type="button" class="btn primary" onClick={clockIn} data-testid="clock-in">Clock in</button>}
        </div>
        <ul class="lines">
          {job.time.map((t) => (
            <li key={t.id}>
              <span>{formatWhen(t.start)}{t.end ? '' : ' (running)'}</span>
              <span class="num">{formatDuration(entryMinutes(t, now))}</span>
              <button type="button" class="x" aria-label="Remove time entry" onClick={() => update({ time: job.time.filter((x) => x.id !== t.id) })}>x</button>
            </li>
          ))}
        </ul>
      </section>

      <PartsCard job={job} update={update} />
      <Photos job={job} update={update} />

      <section class="card pad">
        <h2>Customer signature</h2>
        {job.signature ? (
          <div>
            <img class="sigimg" src={job.signature.dataUrl} alt="Customer signature" data-testid="signature-saved" />
            <p class="muted small">Signed {formatWhen(job.signature.signedAt)}</p>
            <button type="button" class="btn ghost" onClick={() => update({ signature: undefined })}>Redo signature</button>
          </div>
        ) : (
          <SigBlock onSave={(dataUrl, signerName) => update({ signature: { dataUrl, signedAt: new Date().toISOString(), signerName } })} defaultName={job.customerName} />
        )}
      </section>

      <section class="card pad totals">
        <h2>Totals</h2>
        <dl>
          <div><dt>Labor ({formatDuration(totals.billableMinutes)} at {formatMoney(settings.hourlyRateCents)}/h)</dt><dd class="num">{formatMoney(totals.laborCents)}</dd></div>
          <div><dt>Parts</dt><dd class="num">{formatMoney(totals.partsCents)}</dd></div>
          {settings.taxRateBp > 0 && <div><dt>Tax ({(settings.taxRateBp / 100).toFixed(2)}%{settings.taxLabor ? ' on parts and labor' : ' on parts'})</dt><dd class="num">{formatMoney(totals.taxCents)}</dd></div>}
          <div class="grand"><dt>Total</dt><dd class="num" data-testid="total">{formatMoney(totals.totalCents)}</dd></div>
        </dl>
        <div class="row wrap">
          <a class="btn primary" href={`#/invoice/${job.id}`} data-testid="open-invoice">Invoice</a>
          {job.status !== 'done' && job.status !== 'invoiced' && <button type="button" class="btn ghost" onClick={() => update({ status: 'done' })}>Mark done</button>}
          <button
            type="button"
            class="btn ghost danger-text"
            onClick={async () => {
              if (!confirm('Delete this ticket and its photos? This cannot be undone.')) return;
              await deleteJob(job.id);
              await onChange();
              go('/');
            }}
          >
            Delete ticket
          </button>
        </div>
      </section>
    </article>
  );
}

type Update = (patch: Partial<Job>, immediate?: boolean) => void;

function Checklist({ job, progress, update }: { job: Job; progress: { done: number; total: number }; update: Update }) {
  const [text, setText] = useState('');
  const add = (e: Event) => {
    e.preventDefault();
    if (!text.trim()) return;
    update({ checklist: [...job.checklist, { id: uid(), text: text.trim(), done: false }] });
    setText('');
  };
  return (
    <section class="card pad">
      <h2>Checklist {progress.total > 0 && <span class="muted small">{progress.done} of {progress.total}</span>}</h2>
      <ul class="checks">
        {job.checklist.map((c) => (
          <li key={c.id}>
            <label class="check">
              <input type="checkbox" checked={c.done} onChange={() => update({ checklist: job.checklist.map((x) => (x.id === c.id ? { ...x, done: !x.done } : x)) })} />
              <span class={c.done ? 'struck' : ''}>{c.text}</span>
            </label>
            <button type="button" class="x" aria-label={`Remove ${c.text}`} onClick={() => update({ checklist: job.checklist.filter((x) => x.id !== c.id) })}>x</button>
          </li>
        ))}
      </ul>
      <form class="row" onSubmit={add}>
        <input class="field grow" value={text} onInput={(e) => setText(e.currentTarget.value)} placeholder="Add a step" aria-label="New checklist step" />
        <button class="btn ghost" type="submit">Add</button>
      </form>
    </section>
  );
}

function PartsCard({ job, update }: { job: Job; update: Update }) {
  const [name, setName] = useState('');
  const [qty, setQty] = useState('1');
  const [price, setPrice] = useState('');
  const [err, setErr] = useState('');

  const add = (e: Event) => {
    e.preventDefault();
    const cents = parseMoney(price);
    const q = Number(qty);
    if (!name.trim()) return setErr('Enter a part name.');
    if (cents === null) return setErr('Enter the unit price like 12.50.');
    if (!Number.isFinite(q) || q <= 0) return setErr('Quantity must be more than zero.');
    setErr('');
    update({ parts: [...job.parts, { id: uid(), name: name.trim(), qty: q, unitCents: cents }] });
    setName('');
    setQty('1');
    setPrice('');
  };

  return (
    <section class="card pad">
      <h2>Parts used</h2>
      <ul class="lines">
        {job.parts.map((p) => (
          <li key={p.id} data-testid="part-row">
            <span>{p.name}<span class="muted small"> {p.qty} x {formatMoney(p.unitCents)}</span></span>
            <span class="num">{formatMoney(lineCents(p))}</span>
            <button type="button" class="x" aria-label={`Remove ${p.name}`} onClick={() => update({ parts: job.parts.filter((x) => x.id !== p.id) })}>x</button>
          </li>
        ))}
      </ul>
      <form class="partform" onSubmit={add}>
        <input class="field" value={name} onInput={(e) => setName(e.currentTarget.value)} placeholder="Part name" aria-label="Part name" />
        <input class="field" value={qty} onInput={(e) => setQty(e.currentTarget.value)} inputMode="decimal" aria-label="Quantity" />
        <input class="field" value={price} onInput={(e) => setPrice(e.currentTarget.value)} inputMode="decimal" placeholder="Price" aria-label="Unit price" />
        <button class="btn ghost" type="submit">Add</button>
      </form>
      {err && <p class="err" role="alert">{err}</p>}
    </section>
  );
}

function Photos({ job, update }: { job: Job; update: Update }) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const photoKey = job.photos.map((p) => p.id).join(',');

  useEffect(() => {
    let alive = true;
    const made: string[] = [];
    void listPhotos(job.id).then((records: PhotoRecord[]) => {
      if (!alive) return;
      const map: Record<string, string> = {};
      for (const r of records) {
        const u = URL.createObjectURL(r.blob);
        made.push(u);
        map[r.id] = u;
      }
      setUrls(map);
    });
    return () => {
      alive = false;
      made.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [job.id, photoKey]);

  const onFiles = async (e: Event) => {
    const input = e.currentTarget as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    setBusy(true);
    const added = [];
    for (const f of files) {
      const id = uid();
      await savePhoto({ id, jobId: job.id, blob: await shrinkPhoto(f) });
      added.push({ id, name: f.name || 'photo.jpg', addedAt: new Date().toISOString() });
    }
    input.value = '';
    update({ photos: [...job.photos, ...added] });
    setBusy(false);
  };

  return (
    <section class="card pad">
      <h2>Photos</h2>
      <div class="thumbs">
        {job.photos.map((p) => (
          <figure key={p.id}>
            {urls[p.id] ? <img src={urls[p.id]} alt={p.name} loading="lazy" /> : <div class="ph" />}
            <button
              type="button"
              class="x over"
              aria-label={`Remove ${p.name}`}
              onClick={async () => {
                await deletePhoto(p.id);
                update({ photos: job.photos.filter((x) => x.id !== p.id) });
              }}
            >
              x
            </button>
          </figure>
        ))}
      </div>
      <label class="btn ghost filebtn">
        {busy ? 'Saving...' : 'Add photo'}
        <input type="file" accept="image/*" capture="environment" multiple hidden onChange={onFiles} data-testid="photo-input" />
      </label>
      <p class="muted small">Photos are shrunk and kept on this device only.</p>
    </section>
  );
}

function SigBlock({ onSave, defaultName }: { onSave: (dataUrl: string, signer: string) => void; defaultName: string }) {
  const [name, setName] = useState(defaultName);
  return (
    <div>
      <label>Printed name<input class="field" value={name} onInput={(e) => setName(e.currentTarget.value)} /></label>
      <p class="muted small">By signing, the customer confirms the work described above was done.</p>
      <SignaturePad onSave={(d) => onSave(d, name)} />
    </div>
  );
}
