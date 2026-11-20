import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';

import { PAYSLIP_LOGO_BASE64 } from '../../timesheets/lib/payslip-logo';

export interface StatementPdfData {
  company: string;
  month: string;
  employee: { name: string; commissionRate: number; basis: 'PROFIT' | 'BILLING' };
  lines: { worker: string; client: string; billingTotal: number; profitTotal: number; splitPercent: number; sharedWith: string[]; attributedBilling: number; attributedProfit: number; commissionable: number; commission: number }[];
  payments: { amount: number; paidAt: Date; reference: string | null }[];
  totals: { billings: number; profit: number; commissionable: number; earned: number; paid: number; outstanding: number };
}

const safe = (text: string) => text.replace(/[^\x20-\x7E\xa0-ÿ€–—]/g, '?');
const money = (n: number) => `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const monthName = (month: string) => new Date(`${month}-01T00:00:00Z`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });

/** The monthly commission statement of one employee: what was billed, what the agency made, the share and rate, and what is still owed. */
export async function buildStatementPdf(data: StatementPdfData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Commission statement - ${data.employee.name} - ${data.month}`);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const logo = await pdf.embedPng(Buffer.from(PAYSLIP_LOGO_BASE64, 'base64'));
  let page: PDFPage = pdf.addPage([841.89, 595.28]); // landscape A4: the table is wide
  let y = 555;
  const left = 40;
  const text = (value: string, x: number, yy: number, font: PDFFont = regular, size = 9.5, align: 'left' | 'right' = 'left') => {
    const v = safe(value);
    const w = font.widthOfTextAtSize(v, size);
    page.drawText(v, { x: align === 'right' ? x - w : x, y: yy, size, font, color: rgb(0, 0, 0) });
  };
  const logoW = 56;
  page.drawImage(logo, { x: 841.89 - 40 - logoW, y: y - 36, width: logoW, height: (logo.height / logo.width) * logoW });
  text(data.company, left, y, bold, 12);
  y -= 20;
  text('COMMISSION STATEMENT', left, y, bold, 14);
  y -= 18;
  text(`${data.employee.name}  ·  ${monthName(data.month)}`, left, y, regular, 11);
  y -= 15;
  text(`Commission ${data.employee.commissionRate}% of ${data.employee.basis === 'PROFIT' ? 'the agency profit attributed to them' : 'the client billing attributed to them'}`, left, y, regular, 9.5);
  y -= 26;

  // columns: worker, client, billing, profit, share, attributed billing, attributed profit, commissionable, commission
  const cols = [
    { h: 'Worker', x: left, w: 130, r: false },
    { h: 'Client', x: left + 135, w: 140, r: false },
    { h: 'Placement billing', x: 395, w: 0, r: true },
    { h: 'Placement profit', x: 475, w: 0, r: true },
    { h: 'Share', x: 520, w: 0, r: true },
    { h: 'Attrib. billing', x: 600, w: 0, r: true },
    { h: 'Attrib. profit', x: 680, w: 0, r: true },
    { h: 'Commissionable', x: 760, w: 0, r: true },
    { h: 'Commission', x: 802, w: 0, r: true },
  ];
  // right edges, evenly spaced after the two text columns
  const edges = [380, 450, 495, 565, 635, 710, 800];
  const header = () => {
    page.drawRectangle({ x: left, y: y - 5, width: 841.89 - 2 * left, height: 17, color: rgb(0.93, 0.93, 0.93) });
    text('Worker', left + 3, y, bold, 8.5);
    text('Client', left + 135, y, bold, 8.5);
    ['Billing', 'Profit', 'Share', 'Attrib. billing', 'Attrib. profit', 'Commissionable', 'Commission'].forEach((h, i) => text(h, edges[i]!, y, bold, 8.5, 'right'));
    y -= 18;
  };
  void cols;
  header();
  for (const l of data.lines) {
    if (y < 110) {
      page = pdf.addPage([841.89, 595.28]);
      y = 555;
      header();
    }
    text(l.worker, left + 3, y, regular, 8.5);
    text(l.client, left + 135, y, regular, 8.5);
    [money(l.billingTotal), money(l.profitTotal), `${l.splitPercent}%`, money(l.attributedBilling), money(l.attributedProfit), money(l.commissionable), money(l.commission)].forEach((v, i) => text(v, edges[i]!, y, regular, 8.5, 'right'));
    if (l.sharedWith.length) text(`shared with ${l.sharedWith.join(', ')}`, left + 3, y - 9, regular, 7);
    y -= l.sharedWith.length ? 22 : 15;
  }
  if (data.lines.length === 0) {
    text('No approved temporary placements are allocated to this person this month.', left + 3, y, regular, 9);
    y -= 15;
  }
  y -= 8;
  page.drawLine({ start: { x: left, y: y + 6 }, end: { x: 841.89 - left, y: y + 6 }, thickness: 0.8, color: rgb(0, 0, 0) });
  const t = data.totals;
  const row = (label: string, value: string, strong = false) => {
    text(label, 560, y, strong ? bold : regular, 10);
    text(value, 800, y, strong ? bold : regular, 10, 'right');
    y -= 15;
  };
  row('Attributed client billing', money(t.billings));
  row('Attributed agency profit', money(t.profit));
  row(`Commissionable (${data.employee.basis === 'PROFIT' ? 'profit' : 'billing'})`, money(t.commissionable));
  row(`Commission earned (${data.employee.commissionRate}%)`, money(t.earned), true);
  row('Commission already paid', money(t.paid));
  row('Outstanding commission', money(t.outstanding), true);
  if (data.payments.length) {
    y -= 6;
    text('Payments', left, y + 15, bold, 10);
    for (const p of data.payments) {
      text(`${p.paidAt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })}  ${money(p.amount)}${p.reference ? `  ·  ${p.reference}` : ''}`, left, y, regular, 9);
      y -= 12;
    }
  }
  return pdf.save();
}
