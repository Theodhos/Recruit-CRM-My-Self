import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';

import { PAYSLIP_LOGO_BASE64 } from './payslip-logo';

export const PAYSLIP_COMPANY = { name: 'DC Solutions Services Ltd', registration: '16176150' };

export interface PayslipPdfData {
  employeeName: string;
  nino: string | null;
  utr: string | null;
  weekStart: Date;
  weekEnd: Date;
  paymentDate: Date;
  rateType: 'DAY' | 'HOUR';
  rate: number;
  quantity: number;
  gross: number;
  cisRate: number;
  cisDeduction: number;
  payrollFee: number;
  netPay: number;
  currency: string;
  notes: string | null;
  /** What the work was, e.g. the job title and the client. */
  description?: string | null;
  /** Bonuses, deductions, fees: effect on the net pay; `beforeCis` ones are part of the gross pay. */
  extraLines?: { label: string; amount: number; beforeCis: boolean }[];
  /** When and how it was paid, once it has been. */
  paymentInfo?: string | null;
}

const NOTES = [
  'This payslip is provided for record-keeping purposes only.',
  'All payments are made in accordance with the Construction Industry Scheme (CIS).',
  `If you have any queries regarding this payslip, please contact ${PAYSLIP_COMPANY.name}.`,
];

const date = (d: Date) => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });

/** Characters the built-in PDF font cannot draw are replaced, so a name with an unusual letter never breaks the file. */
const safe = (text: string) => text.replace(/[^ -~\xa0-ÿ€•–—‘’“”]/g, '?');

/**
 * The PDF payslip, laid out like the paper one the company already uses: logo, company, employee and payment
 * details, the pay lines (rate × days, CIS deduction, payroll fee, net pay) and the notes. Ready to send to the worker.
 */
export async function buildPayslipPdf(data: PayslipPdfData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Payslip - ${data.employeeName} - ${date(data.weekStart)}`);
  pdf.setProducer(PAYSLIP_COMPANY.name);
  const page = pdf.addPage([595.28, 841.89]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const italic = await pdf.embedFont(StandardFonts.HelveticaOblique);
  const symbol = data.currency === 'GBP' ? '£' : data.currency === 'EUR' ? '€' : data.currency === 'USD' ? '$' : `${data.currency} `;
  const money = (value: number, brackets = false) => {
    const text = `${symbol}${Math.abs(value).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const signed = value < 0 && !brackets ? `-${text}` : text;
    return brackets ? `(${text})` : signed;
  };

  const left = 50;
  const width = 495;
  let y = 800;

  const logo = await pdf.embedPng(Buffer.from(PAYSLIP_LOGO_BASE64, 'base64'));
  const logoWidth = 100;
  const logoHeight = (logo.height / logo.width) * logoWidth;
  page.drawImage(logo, { x: left + (width - logoWidth) / 2, y: y - logoHeight, width: logoWidth, height: logoHeight });
  y -= logoHeight + 22;

  const text = (value: string, x: number, yy: number, font: PDFFont, size = 10.5) => page.drawText(safe(value), { x, y: yy, size, font, color: rgb(0, 0, 0) });
  text(PAYSLIP_COMPANY.name, left, y, bold);
  y -= 14;
  text(`Company Registration Number: ${PAYSLIP_COMPANY.registration}`, left, y, regular);
  y -= 26;
  text('PAYSLIP', left, y, bold, 12);
  y -= 12;

  const line = { thickness: 0.8, color: rgb(0, 0, 0) };
  /** A table row: boxes with a label (bold) and a value, text clipped to its cell. */
  function row(cells: { x: number; w: number; label?: string; value?: string; bold?: boolean; head?: boolean; align?: 'right' }[], height: number) {
    for (const cell of cells) {
      page.drawRectangle({ x: cell.x, y: y - height, width: cell.w, height, borderColor: rgb(0, 0, 0), borderWidth: line.thickness });
      const font = cell.head || cell.bold ? bold : regular;
      let cx = cell.x + 6;
      const baseline = y - height / 2 - 3.5;
      if (cell.label) {
        text(cell.label, cx, baseline, bold);
        cx += bold.widthOfTextAtSize(safe(cell.label), 10.5) + 5;
      }
      if (cell.value) {
        const value = safe(cell.value);
        const w = font.widthOfTextAtSize(value, 10.5);
        text(value, cell.align === 'right' ? cell.x + cell.w - 6 - w : cx, baseline, cell.label ? regular : font);
      }
    }
    y -= height;
  }

  const col2 = [width * 0.56, width * 0.44];
  const x1 = left;
  const x2 = left + col2[0]!;
  row([{ x: x1, w: col2[0]!, value: 'Employee Details', head: true }, { x: x2, w: col2[1]!, value: 'Payment Details', head: true }], 26);
  row([{ x: x1, w: col2[0]!, label: 'Full Name:', value: data.employeeName }, { x: x2, w: col2[1]!, label: 'Week Covered:', value: `${date(data.weekStart)} - ${date(data.weekEnd)}` }], 26);
  row([{ x: x1, w: col2[0]!, label: 'National Insurance Number (NINO):', value: data.nino ?? '' }, { x: x2, w: col2[1]!, label: 'Date of Payment:', value: date(data.paymentDate) }], 26);
  row([{ x: x1, w: col2[0]!, label: 'Unique Taxpayer Reference (UTR):', value: data.utr ?? '' }, { x: x2, w: col2[1]! }], 26);
  y -= 16;

  const widths = [0.28, 0.2, 0.26, 0.26].map((p) => p * width);
  const xs = widths.map((_, i) => left + widths.slice(0, i).reduce((a, b) => a + b, 0));
  const unit = data.rateType === 'DAY' ? 'Day' : 'Hour';
  const cells = (values: string[], opts: { head?: boolean; bold?: boolean } = {}) =>
    row(values.map((value, i) => ({ x: xs[i]!, w: widths[i]!, value, head: opts.head, bold: opts.bold })), 26);
  const extra = data.extraLines ?? [];
  const bonusTotal = extra.filter((l) => l.beforeCis).reduce((sum, l) => sum + l.amount, 0);
  cells(['Description', 'Rate', `Total ${unit}s`, 'Amount'], { head: true });
  // the rate row, with what the work was underneath (hours and rate × units, before any bonus)
  cells([`${unit} Rate`, money(data.rate), String(data.quantity), money(Math.round((data.gross - bonusTotal) * 100) / 100)]);
  for (const line of extra.filter((l) => l.beforeCis)) cells([line.label, '', '', money(line.amount)]);
  // the work done: one wide row, so a long job title and client never run into the next column
  row([{ x: xs[0]!, w: width, value: data.description ? `Work: ${data.description}` : '' }], 26);
  cells([`CIS Deduction (${data.cisRate}%)`, '', '', money(data.cisDeduction, true)]);
  cells([`Payroll Fee (${money(data.payrollFee)})`, '', '', money(data.payrollFee, true)]);
  for (const line of extra.filter((l) => !l.beforeCis)) cells([line.label, '', '', line.amount < 0 ? money(-line.amount, true) : money(line.amount)]);
  cells(['Net Pay', '', '', money(data.netPay)], { bold: true });
  y -= 28;

  text('Notes:', left, y, bold);
  y -= 18;
  for (const note of NOTES) {
    drawWrapped(page, `•  ${note}`, left + 14, y, width - 14, regular, 10.5);
    y -= 17;
  }
  if (data.paymentInfo) {
    y -= 6;
    y -= drawWrapped(page, data.paymentInfo, left, y, width, bold, 10.5) + 14;
  }
  if (data.notes) {
    y -= 6;
    const used = drawWrapped(page, data.notes, left, y, width, italic, 10.5);
    y -= used;
  }
  return pdf.save();
}

/** Draws text wrapped to a width; returns the height it used (below the first line). */
function drawWrapped(page: PDFPage, value: string, x: number, y: number, maxWidth: number, font: PDFFont, size: number): number {
  const words = safe(value).split(/\s+/);
  let line = '';
  let yy = y;
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && line) {
      page.drawText(line, { x, y: yy, size, font });
      yy -= size + 3;
      line = word;
    } else line = candidate;
  }
  if (line) page.drawText(line, { x, y: yy, size, font });
  return y - yy;
}
