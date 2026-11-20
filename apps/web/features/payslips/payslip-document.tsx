'use client';

import { Button, Dialog } from '@crm/ui';
import { Printer } from '@crm/ui/icons';
import { useRef } from 'react';

import { formatDate, formatMoney } from '@/features/revenue';
import type { Payslip } from '@/services/payslips.service';

export const PAYSLIP_COMPANY = { name: 'DC Solutions Services Ltd', registration: '16176150' };

export const PAYSLIP_NOTES = [
  'This payslip is provided for record-keeping purposes only.',
  'All payments are made in accordance with the Construction Industry Scheme (CIS).',
  `If you have any queries regarding this payslip, please contact ${PAYSLIP_COMPANY.name}.`,
];

/** Self-contained styles: the same ones are used on screen and in the print window. Laid out like the paper payslip. */
const PAYSLIP_CSS = `
.ps{font-family:Calibri,Arial,Helvetica,sans-serif;color:#000;background:#fff;padding:32px 40px;max-width:800px;margin:0 auto;font-size:13px;line-height:1.35;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.ps-logo{display:block;margin:0 auto 18px;width:130px;height:auto}
.ps-company{font-size:13px;font-weight:700}
.ps-reg{margin-top:2px}
.ps-title{margin:16px 0 8px;font-size:13px;font-weight:700}
.ps table{width:92%;border-collapse:collapse;table-layout:fixed}
.ps th,.ps td{border:1px solid #000;padding:6px 3px;text-align:left;vertical-align:top;height:34px;font-size:13px}
.ps th{font-weight:700}
.ps .n{text-align:left}
.ps .b{font-weight:700}
.ps .gap{height:20px;border:0;padding:0}
.ps-label{font-weight:700}
.ps-notes{margin-top:24px}
.ps-notes h5{margin:0 0 10px;font-size:13px;font-weight:700}
.ps-notes ul{margin:0;padding-left:42px}
.ps-notes li{margin-bottom:9px}
.ps-extra{margin-top:8px;font-style:italic}
@media (max-width:560px){.ps{padding:12px;font-size:12px}.ps table{width:100%}.ps th,.ps td{padding:6px 4px}}
`;

const dash = (value: string | null | undefined) => (value && value.trim() ? value : '');

/**
 * The payslip itself, laid out like the paper one: employee and payment details, the pay lines, the notes.
 * With no payslip it is the empty form (all values blank, £ signs in place).
 */
export function PayslipDocument({ payslip }: { payslip?: Payslip | null }) {
  const currency = payslip?.currency ?? 'GBP';
  const symbol = currency === 'GBP' ? '£' : currency === 'EUR' ? '€' : currency === 'USD' ? '$' : `${currency} `;
  const money = (value: number | undefined, brackets = false) => {
    if (value === undefined) return brackets ? `(${symbol})` : symbol;
    const text = formatMoney(value, currency);
    return brackets ? `(${text})` : text;
  };
  const unit = payslip?.rateType === 'DAY' ? 'Day' : payslip?.rateType === 'HOUR' ? 'Hour' : 'Day/Hour';
  return (
    <div className="ps" data-testid="payslip-document">
      <style>{PAYSLIP_CSS}</style>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="ps-logo" src="/dc-logo.png" alt="DC Solutions Services" width={130} />
      <div className="ps-company">{PAYSLIP_COMPANY.name}</div>
      <div className="ps-reg">Company Registration Number: {PAYSLIP_COMPANY.registration}</div>
      <div className="ps-title">PAYSLIP</div>

      <table>
        <colgroup>
          <col style={{ width: '56%' }} />
          <col style={{ width: '44%' }} />
        </colgroup>
        <tbody>
          <tr>
            <th>Employee Details</th>
            <th>Payment Details</th>
          </tr>
          <tr>
            <td>
              <span className="ps-label">Full Name: </span>
              {payslip?.employeeName}
            </td>
            <td>
              <span className="ps-label">Week Covered: </span>
              {payslip ? `${formatDate(payslip.weekStart)} – ${formatDate(payslip.weekEnd)}` : ''}
            </td>
          </tr>
          <tr>
            <td>
              <span className="ps-label">National Insurance Number (NINO): </span>
              {dash(payslip?.nino)}
            </td>
            <td>
              <span className="ps-label">Date of Payment: </span>
              {payslip ? formatDate(payslip.paymentDate) : ''}
            </td>
          </tr>
          <tr>
            <td>
              <span className="ps-label">Unique Taxpayer Reference (UTR): </span>
              {dash(payslip?.utr)}
            </td>
            <td />
          </tr>
        </tbody>
      </table>

      <div className="gap" />

      <table>
        <colgroup>
          <col style={{ width: '23%' }} />
          <col style={{ width: '21%' }} />
          <col style={{ width: '28%' }} />
          <col style={{ width: '28%' }} />
        </colgroup>
        <tbody>
          <tr>
            <th>Description</th>
            <th>Rate</th>
            <th>Total {payslip ? (payslip.rateType === 'DAY' ? 'Days' : 'Hours') : 'Days/Hours'}</th>
            <th>Amount</th>
          </tr>
          <tr>
            <td>{unit} Rate</td>
            <td>{money(payslip?.rate)}</td>
            <td>{payslip?.quantity}</td>
            <td>{money(payslip?.gross)}</td>
          </tr>
          <tr>
            <td />
            <td />
            <td />
            <td />
          </tr>
          <tr>
            <td>CIS Deduction ({payslip?.cisRate ?? 20}%)</td>
            <td />
            <td />
            <td>{money(payslip?.cisDeduction, true)}</td>
          </tr>
          <tr>
            <td>Payroll Fee</td>
            <td />
            <td />
            <td>{money(payslip?.payrollFee ?? 15, true)}</td>
          </tr>
          <tr>
            <td className="b">Net Pay</td>
            <td />
            <td />
            <td className="b">{money(payslip?.netPay)}</td>
          </tr>
        </tbody>
      </table>

      <div className="ps-notes">
        <h5>Notes:</h5>
        <ul>
          {PAYSLIP_NOTES.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
        {payslip?.notes ? <p className="ps-extra">{payslip.notes}</p> : null}
      </div>
    </div>
  );
}

/** Opens the payslip alone in a window and starts the print dialog (which also offers “Save as PDF”). */
export function printPayslip(node: HTMLElement | null, title: string) {
  if (!node) return;
  const win = window.open('', '_blank', 'width=900,height=1000');
  if (!win) {
    window.alert('Allow pop-ups for this site to print the payslip.');
    return;
  }
  win.document.open();
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${title.replace(/[<>&]/g, '')}</title><style>body{margin:0}@page{margin:14mm}</style></head><body>${node.outerHTML.replace('src="/dc-logo.png"', `src="${window.location.origin}/dc-logo.png"`)}</body></html>`);
  win.document.close();
  win.focus();
  // wait for the logo before the print dialog opens
  const logo = win.document.querySelector('img');
  const start = () => win.print();
  if (logo && !logo.complete) {
    logo.onload = start;
    logo.onerror = start;
  } else {
    window.setTimeout(start, 200);
  }
}

/** The payslip (or the empty form) with the button that prints it or saves it as a PDF. */
export function PayslipViewer({ payslip, onEdit }: { payslip?: Payslip | null; onEdit?: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-foreground/60">{payslip ? `${payslip.employeeName} · ${formatDate(payslip.weekStart)} – ${formatDate(payslip.weekEnd)}` : 'Empty payslip — add one with “New payslip”.'}</p>
        <div className="flex gap-2">
          {payslip && onEdit ? (
            <Button type="button" size="sm" variant="outline" onClick={onEdit}>
              Edit
            </Button>
          ) : null}
          <Button type="button" size="sm" onClick={() => printPayslip(ref.current?.querySelector<HTMLElement>('.ps') ?? null, `Payslip - ${payslip?.employeeName ?? 'blank'}`)}>
            <Printer className="mr-1.5 h-4 w-4" />
            Print / Save PDF
          </Button>
        </div>
      </div>
      <div className="overflow-auto rounded-md border border-border bg-white" ref={ref}>
        <PayslipDocument payslip={payslip} />
      </div>
    </div>
  );
}

/** The payslip in a window. */
export function PayslipPreviewDialog({ payslip, onClose }: { payslip: Payslip; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()} title="Payslip" className="max-w-3xl">
      <PayslipViewer payslip={payslip} />
    </Dialog>
  );
}
