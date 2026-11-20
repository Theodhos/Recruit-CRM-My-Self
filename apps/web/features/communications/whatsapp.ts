/**
 * The address that opens a WhatsApp chat with a phone number (https://wa.me/<number>). WhatsApp wants the number in international
 * form without "+" or spaces: a UK number written 07123 456789 becomes 447123456789, "+44 …" and "0044 …" are cleaned the same way.
 * A number is never turned into a call link (tel:), because WhatsApp Desktop would then offer a voice call. Returns null when there is no usable number. Only writing: it opens the chat, it never places a call.
 */
export function whatsappLink(phone: string | null | undefined, text?: string): string | null {
  let digits = (phone ?? '').replace(/\(0\)/g, '').replace(/[^\d+]/g, '');
  if (!digits) return null;
  if (digits.startsWith('+')) digits = digits.slice(1);
  else if (digits.startsWith('00')) digits = digits.slice(2);
  else if (digits.startsWith('0')) digits = `44${digits.slice(1)}`; // the CRM's numbers are UK: 07… is +44 7…
  digits = digits.replace(/\D/g, '');
  // a UK mobile written without its leading 0 (7700 900123): 10 digits starting with 7
  if (/^7\d{9}$/.test(digits)) digits = `44${digits}`;
  if (digits.length < 8 || digits.length > 15) return null;
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}
