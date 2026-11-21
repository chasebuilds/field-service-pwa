import { useCallback, useEffect, useState } from 'preact/hooks';
import { getFlag, getSettings, listJobs, nextJobNumber, saveJob, setFlag } from '../lib/db';
import { seedDemo } from '../lib/demo';
import { checklistProgress, formatWhen, STATUS_LABEL, uid } from '../lib/format';
import { computeTotals, formatMoney } from '../lib/money';
import { DEFAULT_SETTINGS, type Job, type JobStatus, type Settings } from '../lib/types';
import { go, useHash, useInstall, useOnline } from './hooks';
import { InvoiceView } from './InvoiceView';
import { JobView } from './JobView';
import { SettingsView } from './SettingsView';

const AUTO_DEMO = import.meta.env.VITE_DEMO === '1';

type Filter = 'open' | 'done' | 'all';

export function App() {
  const hash = useHash();
  const online = useOnline();
  const install = useInstall();
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  const reload = useCallback(async () => {
    const [j, s] = await Promise.all([listJobs(), getSettings()]);
    setJobs(j);
    setSettings(s);
  }, []);

  useEffect(() => {
    void (async () => {
      if (AUTO_DEMO && !(await getFlag('seeded'))) {
        await seedDemo();
        await setFlag('seeded', true);
      }
      await reload();
    })();
  }, [reload]);

  const [, route, id] = hash.split('/');
  const job = jobs?.find((j) => j.id === id);

  let view;
  if (jobs === null) view = <p class="muted pad">Loading...</p>;
  else if (route === 'job' && job) view = <JobView key={job.id} job={job} settings={settings} onChange={reload} />;
  else if (route === 'invoice' && job) view = <InvoiceView job={job} settings={settings} onChange={reload} />;
  else if (route === 'settings') view = <SettingsView settings={settings} onChange={reload} install={install} />;
  else if (route === 'new') view = <NewJob onCreated={reload} />;
  else view = <JobList jobs={jobs} settings={settings} onChange={reload} />;

  return (
    <div class="app">
      <header class="bar glass noprint">
        <a class="who" href="#/">
          <b>FS</b>
          <span>{settings.businessName}</span>
        </a>
        <span class={`chip ${online ? '' : 'warn'}`} data-testid="net-chip">{online ? 'Online' : 'Offline, saving locally'}</span>
      </header>
      <main class="stage glass">{view}</main>
      <nav class="dock glass noprint" aria-label="Main">
        <a href="#/" class={!route || route === 'job' || route === 'invoice' ? 'on' : ''}>Jobs</a>
        <a href="#/new" class={route === 'new' ? 'on' : ''}>New ticket</a>
        <a href="#/settings" class={route === 'settings' ? 'on' : ''}>Settings</a>
      </nav>
    </div>
  );
}

function JobList({ jobs, settings, onChange }: { jobs: Job[]; settings: Settings; onChange: () => Promise<void> }) {
  const [filter, setFilter] = useState<Filter>('open');
  const [q, setQ] = useState('');
  const shown = jobs
    .filter((j) => (filter === 'all' ? true : filter === 'open' ? j.status === 'scheduled' || j.status === 'in_progress' : j.status === 'done' || j.status === 'invoiced'))
    .filter((j) => `${j.customerName} ${j.title} ${j.address} ${j.number}`.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => (filter === 'done' ? b.scheduledFor.localeCompare(a.scheduledFor) : a.scheduledFor.localeCompare(b.scheduledFor)));

  const unbilled = jobs.filter((j) => j.status === 'done').reduce((s, j) => s + computeTotals(j, settings).totalCents, 0);

  if (jobs.length === 0) {
    return (
      <section class="view empty">
        <h1>No tickets yet</h1>
        <p class="sub">Create a ticket for your next job, or load sample data to look around. Everything stays on this device.</p>
        <div class="row">
          <a class="btn primary" href="#/new">New ticket</a>
          <button
            type="button"
            class="btn ghost"
            data-testid="load-demo"
            onClick={async () => {
              await seedDemo();
              await setFlag('seeded', true);
              await onChange();
            }}
          >
            Load demo data
          </button>
        </div>
      </section>
    );
  }

  return (
    <section class="view">
      <div class="head">
        <div>
          <h1>Jobs</h1>
          <p class="sub">{jobs.filter((j) => j.status === 'scheduled' || j.status === 'in_progress').length} open{unbilled > 0 ? `, ${formatMoney(unbilled)} done but not invoiced` : ''}</p>
        </div>
      </div>
      <div class="row wrap">
        <div class="seg" role="tablist">
          {(['open', 'done', 'all'] as const).map((f) => (
            <button type="button" role="tab" aria-selected={filter === f} class={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>
              {f === 'open' ? 'Open' : f === 'done' ? 'Finished' : 'All'}
            </button>
          ))}
        </div>
        <input class="field grow" type="search" placeholder="Search customer, address, job" value={q} onInput={(e) => setQ(e.currentTarget.value)} aria-label="Search jobs" />
      </div>
      {shown.length === 0 && <p class="muted">Nothing matches.</p>}
      <ul class="cards">
        {shown.map((j) => {
          const p = checklistProgress(j);
          return (
            <li key={j.id}>
              <a class="card lift jobcard" href={`#/job/${j.id}`} data-testid="job-card">
                <div class="jc-top">
                  <span class="num muted">#{j.number}</span>
                  <span class={`pill s-${j.status}`}>{STATUS_LABEL[j.status]}</span>
                </div>
                <strong>{j.customerName || 'No name'}</strong>
                <span>{j.title}</span>
                <span class="muted small">{j.address}</span>
                <div class="jc-foot muted small">
                  <span>{formatWhen(j.scheduledFor)}</span>
                  {p.total > 0 && <span>{p.done}/{p.total} checked</span>}
                </div>
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function NewJob({ onCreated }: { onCreated: () => Promise<void> }) {
  const [customer, setCustomer] = useState('');
  const [title, setTitle] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);

  const create = async (e: Event) => {
    e.preventDefault();
    setBusy(true);
    const now = new Date().toISOString();
    const status: JobStatus = 'scheduled';
    const job: Job = {
      id: uid(), number: await nextJobNumber(), status, title: title.trim(), customerName: customer.trim(), phone: phone.trim(), email: '',
      address: address.trim(), scheduledFor: now, notes: '', checklist: [], parts: [], time: [], photos: [], createdAt: now, updatedAt: now,
    };
    await saveJob(job);
    await onCreated();
    go(`/job/${job.id}`);
  };

  return (
    <form class="view" onSubmit={create}>
      <div class="head"><h1>New ticket</h1></div>
      <label>Customer<input class="field" required value={customer} onInput={(e) => setCustomer(e.currentTarget.value)} autocomplete="name" /></label>
      <label>What is the job?<input class="field" required value={title} onInput={(e) => setTitle(e.currentTarget.value)} placeholder="Water heater not heating" /></label>
      <label>Address<input class="field" value={address} onInput={(e) => setAddress(e.currentTarget.value)} autocomplete="street-address" /></label>
      <label>Phone<input class="field" type="tel" value={phone} onInput={(e) => setPhone(e.currentTarget.value)} autocomplete="tel" /></label>
      <button class="btn primary" type="submit" disabled={busy}>Create ticket</button>
    </form>
  );
}
