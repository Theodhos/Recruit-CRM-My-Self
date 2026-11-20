import { isAcceptableCv } from './cv-file';

const file = (name: string, mimetype: string, bytes: Buffer) => ({ originalname: name, mimetype, buffer: bytes });
const PDF = Buffer.from('%PDF-1.7\n...');
const ZIP = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0]);
const OLE = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0]);
const EXE = Buffer.from('MZ\x90\x00\x03');
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

describe('isAcceptableCv', () => {
  it('accepts a real PDF, DOC and DOCX', () => {
    expect(isAcceptableCv(file('cv.pdf', 'application/pdf', PDF))).toBe(true);
    expect(isAcceptableCv(file('cv.doc', 'application/msword', OLE))).toBe(true);
    expect(isAcceptableCv(file('CV Ana.DOCX', DOCX, ZIP))).toBe(true);
  });

  it('rejects an executable that claims to be a PDF (type and name say PDF, the bytes do not)', () => {
    expect(isAcceptableCv(file('cv.pdf', 'application/pdf', EXE))).toBe(false);
  });

  it('rejects a PDF whose extension or declared type disagree', () => {
    expect(isAcceptableCv(file('cv.exe', 'application/pdf', PDF))).toBe(false);
    expect(isAcceptableCv(file('cv.pdf', 'text/html', PDF))).toBe(false);
    expect(isAcceptableCv(file('cv.docx', 'application/pdf', PDF))).toBe(false);
  });

  it('rejects a DOCX that is not a zip container, and an empty file', () => {
    expect(isAcceptableCv(file('cv.docx', DOCX, PDF))).toBe(false);
    expect(isAcceptableCv(file('cv.pdf', 'application/pdf', Buffer.alloc(0)))).toBe(false);
  });
});
