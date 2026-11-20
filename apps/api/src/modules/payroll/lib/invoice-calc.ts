/**
 * What a client is invoiced for the temporary workers, in whole pence.
 *
 *   net invoice   = the client charges of the week (before VAT)
 *   VAT           = net × VAT rate, or nothing when the domestic reverse charge applies
 *   invoice total = net + VAT
 *   client CIS    = net × the CIS rate the client deducts (it applies to the labour, not to the VAT)
 *   to receive    = invoice total − client CIS
 *
 * An invoice is one client for one week, so the figures are worked out on the client's total, not line by line
 * (that is how the real invoice adds up).
 */
export interface ClientTerms {
  cisDeductionRate: number;
  vatRate: number;
  vatReverseCharge: boolean;
}

export interface InvoiceFigures {
  net: number;
  vat: number;
  total: number;
  clientCis: number;
  receivable: number;
}

const pence = (pounds: number) => Math.round((pounds + Number.EPSILON) * 100);

export function invoiceFor(netCharge: number, terms: ClientTerms): InvoiceFigures {
  const net = pence(netCharge);
  const vat = terms.vatReverseCharge ? 0 : Math.round((net * Math.round(terms.vatRate * 100)) / 10_000);
  const clientCis = Math.round((net * Math.round(terms.cisDeductionRate * 100)) / 10_000);
  return { net: net / 100, vat: vat / 100, total: (net + vat) / 100, clientCis: clientCis / 100, receivable: (net + vat - clientCis) / 100 };
}
