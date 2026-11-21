import { saveJob } from '../lib/db';
import { formatWhen, invoiceNumber } from '../lib/format';
import { computeTotals, formatMoney, lineCents } from '../lib/money';
import { formatDuration } from '../lib/time';
import type { Job, Settings } from '../lib/types';

interface Props { job: Job; settings: Settings; onChange: () => Promise<void> }

/** Printable invoice. "Print or save PDF" uses the browser's own print dialog, which offers Save as PDF. */
export function InvoiceView({ job, settings, onChange }: Props) {
  const t = computeTotals(job, settings);
  const number = invoiceNumber(settings.invoicePrefix, job.number);
  const date = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <section class="view">
      <div class="row wrap noprint">
        <a class="btn ghost" href={`#/job/${job.id}`}>Back to ticket</a>
        <button type="button" class="btn primary" onClick={() => window.print()} data-testid="print">Print or save PDF</button>
        {job.status !== 'invoiced' && (
          <button
            type="button"
            class="btn ghost"
            onClick={async () => {
              await saveJob({ ...job, status: 'invoiced' });
              await onChange();
            }}
          >
            Mark invoiced
          </button>
        )}
      </div>

      <div class="invoice" data-testid="invoice">
        <div class="inv-head">
          <div>
            <h1>{settings.businessName}</h1>
            {settings.businessPhone && <p>{settings.businessPhone}</p>}
          </div>
          <div class="inv-meta">
            <strong>INVOICE</strong>
            <span class="num">{number}</span>
            <span>{date}</span>
          </div>
        </div>

        <div class="inv-bill">
          <div>
            <span class="lbl">Bill to</span>
            <p>{job.customerName}</p>
            {job.email && <p>{job.email}</p>}
            {job.phone && <p>{job.phone}</p>}
          </div>
          <div>
            <span class="lbl">Service address</span>
            <p>{job.address}</p>
            <span class="lbl">Service date</span>
            <p>{formatWhen(job.scheduledFor)}</p>
          </div>
        </div>

        <p class="inv-job"><strong>{job.title}</strong></p>

        <table>
          <thead>
            <tr><th>Description</th><th class="r">Qty</th><th class="r">Price</th><th class="r">Amount</th></tr>
          </thead>
          <tbody>
            {t.billableMinutes > 0 && (
              <tr>
                <td>Labor</td>
                <td class="r">{formatDuration(t.billableMinutes)}</td>
                <td class="r num">{formatMoney(settings.hourlyRateCents)}/h</td>
                <td class="r num">{formatMoney(t.laborCents)}</td>
              </tr>
            )}
            {job.parts.map((p) => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td class="r">{p.qty}</td>
                <td class="r num">{formatMoney(p.unitCents)}</td>
                <td class="r num">{formatMoney(lineCents(p))}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr><td colSpan={3} class="r">Subtotal</td><td class="r num">{formatMoney(t.laborCents + t.partsCents)}</td></tr>
            {settings.taxRateBp > 0 && <tr><td colSpan={3} class="r">Tax ({(settings.taxRateBp / 100).toFixed(2)}%)</td><td class="r num">{formatMoney(t.taxCents)}</td></tr>}
            <tr class="grand"><td colSpan={3} class="r">Total due</td><td class="r num" data-testid="invoice-total">{formatMoney(t.totalCents)}</td></tr>
          </tfoot>
        </table>

        {job.notes && (
          <div class="inv-notes">
            <span class="lbl">Work notes</span>
            <p>{job.notes}</p>
          </div>
        )}

        <div class="inv-sign">
          {job.signature ? (
            <>
              <img src={job.signature.dataUrl} alt="Customer signature" />
              <span>{job.signature.signerName} signed {formatWhen(job.signature.signedAt)}</span>
            </>
          ) : (
            <span class="muted">Not signed yet</span>
          )}
        </div>
      </div>
    </section>
  );
}
