import { extname } from 'node:path';

const PDF = Buffer.from('%PDF-');
const OLE = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]); // .doc
const ZIP = Buffer.from([0x50, 0x4b, 0x03, 0x04]); // .docx

export const CV_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);
const CV_EXTENSIONS = new Set(['.pdf', '.doc', '.docx']);

const startsWith = (buffer: Buffer, signature: Buffer) => buffer.length >= signature.length && buffer.subarray(0, signature.length).equals(signature);

/**
 * A CV upload is accepted only when its declared type, its extension AND the first bytes of the file agree.
 * The browser's declared type is whatever the sender typed, so on its own it proves nothing.
 */
export function isAcceptableCv(file: { buffer: Buffer; originalname: string; mimetype: string }): boolean {
  if (!CV_MIME_TYPES.has(file.mimetype)) return false;
  const extension = extname(file.originalname).toLowerCase();
  if (!CV_EXTENSIONS.has(extension)) return false;
  if (file.mimetype === 'application/pdf') return extension === '.pdf' && startsWith(file.buffer, PDF);
  if (file.mimetype === 'application/msword') return extension === '.doc' && (startsWith(file.buffer, OLE) || startsWith(file.buffer, ZIP));
  return extension === '.docx' && startsWith(file.buffer, ZIP);
}
