import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { extractRawText } from 'mammoth';
import { PDFParse } from 'pdf-parse';
import * as XLSX from 'xlsx';

/** The fields of Add Candidate that a document can fill. */
export interface ParsedResumeFields {
  firstName?: string;
  lastName?: string;
  phone?: string;
  location?: string;
  jobTitle?: string;
  trade?: string;
}

const EMAIL_PATTERN = /[\w.+-]+@[\w-]+\.[a-zA-Z]{2,}/;
const PHONE_PATTERN = /\+?\d[\d\s().-]{6,16}\d/;
const SKIP_HEADING = /^(curriculum vitae|resume|résumé|cv|profile|summary|objective|contact|personal details|personal information|name)$/i;
/** A short, capitalised line near the top of most documents — the person's name. */
const NAME_LINE = /^[A-ZÀ-Ý][a-zà-ÿ'’-]+(?:\s+[A-ZÀ-Ý][a-zà-ÿ'’-]+){0,3}$/;
const NAME_LINE_CAPS = /^[A-ZÀ-Ý][A-ZÀ-Ý'’-]+(?:\s+[A-ZÀ-Ý][A-ZÀ-Ý'’-]+){1,3}$/;
/** "City, Country" / "City, Region" with no digits — a location line. */
const LOCATION_LINE = /^[A-Za-zÀ-ÿ.'\s-]{2,40},\s*[A-Za-zÀ-ÿ.'\s-]{2,40}$/;
/** A UK post code anywhere in a line. */
const UK_POSTCODE = /\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/i;
/** "Senior Engineer at Acme" / "Senior Engineer @ Acme" / "Senior Engineer - Acme". */
const ROLE_AT_COMPANY = /^(.{2,80}?)\s+(?:at|@|-|\|)\s+(.{2,80})$/i;

/** "Label: value" lines, as forms and many CVs write them. */
const LABELLED = {
  fullName: /^(?:full\s*name|name|candidate(?:\s*name)?)\s*[:\-–]\s*(.+)$/i,
  firstName: /^first\s*name\s*[:\-–]\s*(.+)$/i,
  lastName: /^(?:last\s*name|surname|family\s*name)\s*[:\-–]\s*(.+)$/i,
  phone: /^(?:phone|tel(?:ephone)?|mobile|mob|cell)(?:\s*(?:no\.?|number))?\s*[:\-–]\s*(.+)$/i,
  location: /^(?:location|address|city|town|based\s*in|residence|home\s*address)\s*[:\-–]\s*(.+)$/i,
  jobTitle: /^(?:job\s*title|position|role|current\s*role|profession|desired\s*(?:position|role)|applying\s*for)\s*[:\-–]\s*(.+)$/i,
  trade: /^(?:trade|occupation|craft|discipline)\s*[:\-–]\s*(.+)$/i,
} as const;

/** The trades the agency places: a word found in the document names the candidate's trade when no line says it. */
const TRADES = [
  'electrician', 'plumber', 'carpenter', 'joiner', 'bricklayer', 'plasterer', 'painter', 'decorator', 'roofer', 'welder',
  'pipefitter', 'fitter', 'labourer', 'laborer', 'scaffolder', 'tiler', 'groundworker', 'steel fixer', 'shuttering carpenter',
  'engineer', 'technician', 'mechanic', 'heating engineer', 'gas engineer', 'hvac engineer', 'site manager', 'foreman', 'surveyor', 'banksman',
  'plant operator', 'crane operator', 'forklift driver', 'driver', 'cleaner', 'chef', 'cook', 'waiter', 'warehouse operative',
  'security guard', 'caretaker', 'handyman', 'glazier', 'floorer', 'dryliner', 'demolition operative', 'mason', 'stonemason',
];

const CV_SYSTEM_PROMPT = `You read a CV, résumé, application or any document about a person looking for work, in any language and any layout, and return the person's details as one JSON object with exactly these keys: firstName, lastName, phone, location, jobTitle, trade.
- firstName / lastName: the candidate's own name (not a referee's or an employer's). A surname made of several words stays in lastName.
- phone: the candidate's main phone number, as written, with the country code if given.
- location: where the candidate lives: the town or city (and country or post code if given), not an employer's address.
- jobTitle: the job the candidate does now, or is looking for (their headline), e.g. "Site Electrician".
- trade: the candidate's trade or craft in one or two words, e.g. "Electrician", "Plumber", "Bricklayer"; empty if they have none.
Use an empty string for anything the document does not say. Never invent. Reply with the JSON object only, no other text.`;

const titleCase = (value: string) => value.toLowerCase().replace(/(^|[\s'’-])([a-zà-ÿ])/g, (_, before: string, letter: string) => `${before}${letter.toUpperCase()}`);
const clean = (value: string) => value.replace(/\s+/g, ' ').replace(/^[-–:•*\s]+|[-–:•*\s]+$/g, '').trim();

const ROLE_WORDS = /\b(?:engineer|electrician|plumber|carpenter|joiner|builder|bricklayer|plasterer|painter|decorator|roofer|welder|fitter|labourer|laborer|operator|driver|technician|mechanic|manager|supervisor|foreman|surveyor|assistant|officer|worker|specialist|consultant|developer|designer|accountant|administrator|chef|cook|cleaner|guard|scaffolder|tiler|installer|inspector|coordinator|architect|analyst|teacher|nurse|carer)\b/i;

/** Words that head a section of a CV: such a line is never a name, a job title or a trade. */
const HEADING_WORDS = new Set(['about', 'me', 'myself', 'skills', 'skill', 'education', 'experience', 'work', 'professional', 'employment', 'history', 'languages', 'language', 'references', 'reference', 'interests', 'hobbies', 'certificates', 'certifications', 'certification', 'projects', 'project', 'qualifications', 'qualification', 'achievements', 'personal', 'details', 'information', 'profile', 'statement', 'summary', 'objective', 'career', 'contact', 'declaration', 'address', 'curriculum', 'vitae', 'resume', 'résumé', 'cv', 'key', 'technical', 'engineering', 'training', 'courses', 'awards', 'strengths', 'responsibilities', 'duties', 'phone', 'email', 'mobile', 'name', 'date', 'birth', 'nationality', 'gender', 'marital', 'status', 'driving', 'licence', 'license', 'country', 'city', 'page', 'of', 'and', 'the']);
const isHeading = (line: string) => {
  const words = line.toLowerCase().replace(/[^a-zà-ÿ\s]/g, ' ').split(/\s+/).filter(Boolean);
  return words.length > 0 && words.every((word) => HEADING_WORDS.has(word));
};

/** "Korce | Country: Albania" → "Korce, Albania". */
const cleanLocation = (value: string) =>
  clean(value.replace(/\b(?:city|town|country|location|address)\s*:\s*/gi, '').replace(/\s*[|•·;]\s*/g, ', ').replace(/,\s*,/g, ',').replace(/^,\s*|,\s*$/g, ''));

/** The person named in a file name: "Theodhos Lupe CV.pdf", "John_Smith_Resume.docx", "CV - Maria Gjoni.pdf". */
function nameFromFileName(fileName: string): { firstName: string; lastName?: string } | null {
  const words = fileName
    .replace(/\.[^.]+$/, '')
    .replace(/([a-zà-ÿ])([A-ZÀ-Ý])/g, '$1 $2')
    .split(/[\s_\-.()+]+/)
    .filter((word) => /^[A-Za-zÀ-ÿ'’]{2,}$/.test(word) && !/^(cv|resume|résumé|curriculum|vitae|final|new|copy|doc|document|updated|version|latest|my|pdf|docx|word)$/i.test(word));
  if (words.length === 0 || words.length > 4) return null;
  return { firstName: titleCase(words[0]!), lastName: words.length > 1 ? titleCase(words.slice(1).join(' ')) : undefined };
}

/**
 * A phone number as it should be written: international, with the country code and the usual spacing
 * ("(+355) 697883395" → "+355 69 788 3395", "07700 900123" → "+44 7700 900123"). A national number with no country
 * is read as UK. What cannot be read as a number is kept with only its digits, spaces and a leading +.
 */
function formatPhone(raw: string): string {
  const cleaned = raw.replace(/^[^\d+]+/, '').replace(/[()\-.]/g, ' ').replace(/^00/, '+').replace(/\s+/g, ' ').trim();
  const parsed = parsePhoneNumberFromString(cleaned, 'GB');
  if (parsed && parsed.isPossible()) return parsed.formatInternational();
  return cleaned.replace(/[^\d+\s]/g, '').trim();
}

@Injectable()
export class ResumeParserService {
  private readonly logger = new Logger(ResumeParserService.name);

  constructor(@Optional() private readonly config?: ConfigService) {}

  /** Whether Claude reads the documents (ANTHROPIC_API_KEY is set on the server); otherwise the built-in reader is used. */
  aiEnabled(): boolean {
    return Boolean(this.config?.get<string>('ANTHROPIC_API_KEY'));
  }

  /**
   * Reads a document into the form's fields. With ANTHROPIC_API_KEY set, Claude reads it — whatever its layout, language
   * or type, also a scanned PDF or a photo of a CV — and the built-in reader fills whatever Claude left empty. Without
   * the key, or if Claude cannot be reached, only the built-in reader runs.
   */
  async read(file: { buffer: Buffer; originalname: string; mimetype: string }): Promise<ParsedResumeFields> {
    const text = await this.extractText(file);
    const own = this.parse(text, file.originalname);
    if (!this.aiEnabled()) return own;
    try {
      const smart = await this.askClaude(file, text);
      return { ...own, ...smart };
    } catch (error) {
      this.logger.warn(`Claude could not read the document, the built-in reader was used: ${(error as Error).message}`);
      return own;
    }
  }

  private async askClaude(file: { buffer: Buffer; originalname: string; mimetype: string }, text: string): Promise<ParsedResumeFields> {
    const key = this.config!.get<string>('ANTHROPIC_API_KEY')!;
    const model = this.config!.get<string>('CV_READER_MODEL', 'claude-haiku-5-5');
    const type = file.mimetype.toLowerCase();
    const isImage = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(type);
    const isPdf = type === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf');
    const readable = text.trim().length >= 40;

    // a picture, or a PDF with no text in it (a scan), is shown to Claude as it is; anything with text is sent as text
    const content: unknown[] = [];
    if (!readable && isImage) content.push({ type: 'image', source: { type: 'base64', media_type: type, data: file.buffer.toString('base64') } });
    else if (!readable && isPdf) content.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: file.buffer.toString('base64') } });
    else if (readable) content.push({ type: 'text', text: `Document (file name: ${file.originalname}):\n\n${text.slice(0, 15000)}` });
    else return {};
    content.push({ type: 'text', text: 'Reply with the JSON object only.' });

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model, max_tokens: 400, system: CV_SYSTEM_PROMPT, messages: [{ role: 'user', content }] }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!response.ok) throw new Error(`Anthropic answered ${response.status}`);
    const body = (await response.json()) as { content?: { type: string; text?: string }[] };
    const answer = body.content?.find((block) => block.type === 'text')?.text ?? '';
    const json = answer.match(/\{[\s\S]*\}/)?.[0];
    if (!json) return {};
    const data = JSON.parse(json) as Record<string, unknown>;
    const out: ParsedResumeFields = {};
    for (const field of ['firstName', 'lastName', 'phone', 'location', 'jobTitle', 'trade'] as const) {
      const value = data[field];
      if (typeof value === 'string' && value.trim() && !/^(null|n\/a|unknown|none)$/i.test(value.trim())) out[field] = (field === 'phone' ? formatPhone(value) : clean(value)).slice(0, 150);
    }
    return out;
  }

  /**
   * The text of any document. PDF, Word (docx), spreadsheets (xlsx, xls, csv, ods), rich text and plain text/markup
   * are read properly; anything else (an old .doc, a picture, a presentation…) is read for whatever text it carries.
   * It never refuses a file: when nothing can be read the result is empty and the person fills the fields in.
   */
  async extractText(file: { buffer: Buffer; originalname: string; mimetype: string }): Promise<string> {
    const name = file.originalname.toLowerCase();
    const type = file.mimetype.toLowerCase();
    const ends = (...extensions: string[]) => extensions.some((extension) => name.endsWith(extension));

    try {
      if (ends('.pdf') || type === 'application/pdf') {
        const parser = new PDFParse({ data: file.buffer });
        try {
          return (await parser.getText()).text;
        } finally {
          await parser.destroy();
        }
      }
      if (ends('.docx', '.docm', '.dotx') || type.includes('wordprocessingml')) {
        return (await extractRawText({ buffer: file.buffer })).value;
      }
      if (ends('.xlsx', '.xlsm', '.xls', '.ods', '.csv', '.tsv') || type.includes('spreadsheet') || type.includes('excel') || type === 'text/csv') {
        return this.spreadsheetText(file.buffer);
      }
      if (ends('.rtf') || type === 'application/rtf' || type === 'text/rtf') {
        return this.rtfText(file.buffer.toString('latin1'));
      }
      if (ends('.html', '.htm', '.xml', '.xhtml') || type.includes('html') || type.includes('xml')) {
        return this.markupText(file.buffer.toString('utf-8'));
      }
      if (ends('.txt', '.md', '.text', '.json', '.log') || type.startsWith('text/')) {
        return file.buffer.toString('utf-8');
      }
    } catch {
      // a file that claims a type it is not (or is damaged) is read like any other file, below
    }
    return this.readableText(file.buffer);
  }

  private spreadsheetText(buffer: Buffer): string {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const lines: string[] = [];
    for (const sheetName of workbook.SheetNames) {
      const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName]!, { header: 1, blankrows: false });
      for (const row of rows) {
        const cells = (row as unknown[]).map((cell) => String(cell ?? '').trim()).filter(Boolean);
        // "Label | value" in two cells reads like "Label: value"
        if (cells.length === 2 && cells[0]!.length < 30) lines.push(`${cells[0]}: ${cells[1]}`);
        else lines.push(...cells);
      }
    }
    return lines.join('\n');
  }

  private rtfText(rtf: string): string {
    return rtf
      .replace(/\\par[d]?/g, '\n')
      .replace(/\\'([0-9a-f]{2})/gi, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
      .replace(/\{\\\*[^{}]*\}/g, '')
      .replace(/\\[a-z]+-?\d* ?/gi, '')
      .replace(/[{}]/g, '');
  }

  private markupText(markup: string): string {
    return markup
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
      .replace(/<\/(p|div|li|tr|h\d|br)>|<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&');
  }

  /** The runs of readable characters in a binary file: old Word (.doc, 8-bit and UTF-16), and any other file that keeps its text in the clear. */
  private readableText(buffer: Buffer): string {
    const eightBit = buffer.toString('latin1').match(/[\x20-\x7e\xa0-\xff]{4,}/g) ?? [];
    const sixteenBit = buffer.toString('utf16le').match(/[\x20-\x7e\xa0-ɏ]{4,}/g) ?? [];
    const runs = [...eightBit, ...sixteenBit].filter((run) => /[A-Za-zÀ-ÿ]{3}/.test(run));
    return runs.join('\n');
  }

  /**
   * Regex/heuristic extraction — no AI. Documents vary wildly in layout, so this is a prefill the recruiter still
   * reviews. It looks for "Label: value" lines first (Name, Phone, Location, Job title, Trade), then for the shape of
   * a CV (name at the top, phone and location lines), and checks the name against the file's own name
   * ("Theodhos Lupe CV.pdf"), which is usually the most reliable sign of who the CV belongs to. A section heading
   * ("About Me", "Skills", "Engineering") is never taken for a name or a job title.
   */
  parse(text: string, fileName?: string): ParsedResumeFields {
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 400);

    const fields: ParsedResumeFields = {};
    let nameLabelled = false;

    // 1. lines that name what they hold
    for (const line of lines) {
      const field = (pattern: RegExp) => clean(line.match(pattern)?.[1] ?? '');
      if (!fields.phone) {
        const value = field(LABELLED.phone);
        const found = value.match(PHONE_PATTERN);
        if (found) fields.phone = found[0].trim();
      }
      if (!fields.location) fields.location = cleanLocation(field(LABELLED.location)) || undefined;
      if (!fields.jobTitle) {
        const title = field(LABELLED.jobTitle);
        if (title && !isHeading(title)) fields.jobTitle = title;
      }
      if (!fields.trade) fields.trade = field(LABELLED.trade) || undefined;
      if (!fields.firstName) fields.firstName = field(LABELLED.firstName) || undefined;
      if (!fields.lastName) fields.lastName = field(LABELLED.lastName) || undefined;
      if (!fields.firstName && !fields.lastName) {
        const full = field(LABELLED.fullName);
        if (full && full.split(/\s+/).length <= 4 && !EMAIL_PATTERN.test(full) && !isHeading(full)) {
          const parts = full.split(/\s+/);
          fields.firstName = parts[0];
          fields.lastName = parts.slice(1).join(' ') || undefined;
        }
      }
    }
    nameLabelled = Boolean(fields.firstName);

    // 2. the shape of a CV. Matched per line (not against the whole text) so a phone match can never bleed across a
    // line break into unrelated text.
    if (!fields.phone) {
      for (const line of lines) {
        const found = line.replace(EMAIL_PATTERN, '').match(PHONE_PATTERN);
        if (found) {
          fields.phone = found[0].trim();
          break;
        }
      }
    }

    // the name at the top: a line of two to four capitalised words that is not a heading
    let nameIndex = -1;
    const looksLikeName = (line: string) => (NAME_LINE.test(line) || NAME_LINE_CAPS.test(line)) && !isHeading(line) && line.split(/\s+/).length >= 2 && line.split(/\s+/).length <= 4;
    if (!fields.firstName) {
      nameIndex = lines.slice(0, 40).findIndex(looksLikeName);
      if (nameIndex !== -1) {
        const parts = (NAME_LINE_CAPS.test(lines[nameIndex]!) ? titleCase(lines[nameIndex]!) : lines[nameIndex]!).split(/\s+/);
        fields.firstName = parts[0];
        fields.lastName = parts.slice(1).join(' ') || undefined;
      }
    }

    // the file's own name ("Theodhos Lupe CV.pdf") wins when the document confirms it, or when nothing better was found
    const fromFile = fileName ? nameFromFileName(fileName) : null;
    if (fromFile && !nameLabelled) {
      const lower = text.toLowerCase();
      const confirmed = lower.includes(fromFile.firstName.toLowerCase()) && (!fromFile.lastName || lower.includes(fromFile.lastName.toLowerCase()));
      const sameAsText = fields.firstName?.toLowerCase() === fromFile.firstName.toLowerCase();
      if (!fields.firstName || (confirmed && !sameAsText) || (fields.firstName && isHeading(`${fields.firstName} ${fields.lastName ?? ''}`.trim()))) {
        fields.firstName = fromFile.firstName;
        fields.lastName = fromFile.lastName;
        nameIndex = -1;
      }
    }

    const searchStart = nameIndex === -1 ? 0 : nameIndex + 1;
    const nearbyLines = lines.slice(searchStart, searchStart + 10);
    let inSection = false; // once a heading (Skills, Education…) is passed, what follows is the body of the CV, not its top
    nearbyLines.forEach((line) => {
      if (EMAIL_PATTERN.test(line) || PHONE_PATTERN.test(line)) return;
      if (isHeading(line)) {
        inSection = true;
        return;
      }

      if (!fields.location && (LOCATION_LINE.test(line) || (UK_POSTCODE.test(line) && line.length < 80) || /\b(country|city|town)\s*:/i.test(line))) {
        fields.location = cleanLocation(line);
        return;
      }
      if (!fields.jobTitle) {
        const roleMatch = line.match(ROLE_AT_COMPANY);
        if (roleMatch && !isHeading(roleMatch[1]!)) {
          fields.jobTitle = roleMatch[1]!.trim();
          return;
        }
      }
      // a short line right under the name is most likely the job title (it must read like a job, not a heading or a sentence)
      if (!fields.jobTitle && !inSection && !/licen[cs]e/i.test(line) && line.split(/\s+/).length <= 5 && !/[:@/\d.|]/.test(line) && /\b(?:engineer|electrician|plumber|carpenter|joiner|builder|bricklayer|plasterer|painter|decorator|roofer|welder|fitter|labourer|laborer|operator|driver|technician|mechanic|manager|supervisor|foreman|surveyor|assistant|officer|worker|specialist|consultant|developer|designer|accountant|administrator|chef|cook|cleaner|guard|scaffolder|tiler|installer|inspector|coordinator|architect|analyst|teacher|nurse|carer)\b/i.test(line)) {
        fields.jobTitle = line;
      }
    });

    // the job title, when no line right under the name gave it: the first role in the Experience section, else the
    // first line anywhere that reads like a short job title
    if (!fields.jobTitle) {
      const isRole = (line: string) => line.split(/\s+/).length <= 6 && !/[:@/\d.|,]/.test(line) && !/licen[cs]e|driving|student|degree|university|college|school/i.test(line) && ROLE_WORDS.test(line) && !isHeading(line);
      const experienceAt = lines.findIndex((line) => /^(work|professional|employment|relevant)?\s*(experience|history|employment)$/i.test(line.replace(/[^A-Za-z\s]/g, '').trim()));
      const inExperience = experienceAt === -1 ? undefined : lines.slice(experienceAt + 1, experienceAt + 10).find(isRole);
      fields.jobTitle = inExperience ?? lines.slice(0, 80).find(isRole);
    }

    // 3. the trade: a line said it; else the trade the document speaks of most (electrician, or electrical work…), counted over
    // the whole text, so one stray word cannot decide it; "driver" needs to be a job, not a licence
    if (!fields.trade) {
      const body = text.toLowerCase().replace(/driving\s+licen[cs]e|driver'?s?\s+licen[cs]e|licen[cs]e/g, ' ');
      const forms: [string, RegExp][] = [
        ...TRADES.map((trade): [string, RegExp] => [trade, new RegExp(`\\b${trade}s?\\b`, 'g')]),
        ['welder', /\bwelding\b/g],
        ['plumber', /\bplumbing\b/g],
        ['electrician', /\belectrical (?:installation|work|wiring)s?\b/g],
        ['carpenter', /\bcarpentry\b/g],
        ['bricklayer', /\bbricklaying\b/g],
        ['plasterer', /\bplastering\b/g],
        ['painter', /\bpainting and decorating\b/g],
        ['tiler', /\btiling\b/g],
        ['roofer', /\broofing\b/g],
        ['scaffolder', /\bscaffolding\b/g],
      ];
      const counted = forms.map(([trade, pattern]) => ({ trade, count: body.match(pattern)?.length ?? 0 })).filter((entry) => entry.count > 0 && !(entry.trade === 'driver' && entry.count < 2));
      const merged = new Map<string, number>();
      for (const entry of counted) merged.set(entry.trade, (merged.get(entry.trade) ?? 0) + entry.count);
      const top = [...merged.entries()].sort((a, b) => b[1] - a[1])[0];
      const inTitle = fields.jobTitle ? TRADES.find((trade) => new RegExp(`\\b${trade}s?\\b`, 'i').test(fields.jobTitle!)) : undefined;
      const chosen = inTitle ?? top?.[0];
      if (chosen) fields.trade = titleCase(chosen);
    }
    if (!fields.jobTitle && fields.trade) fields.jobTitle = fields.trade;

    // the name from the file, when the text gave none at all
    if (!fields.firstName && fromFile) {
      fields.firstName = fromFile.firstName;
      fields.lastName = fromFile.lastName;
    }

    for (const key of Object.keys(fields) as (keyof ParsedResumeFields)[]) {
      const value = fields[key];
      if (!value) delete fields[key];
      else fields[key] = (key === 'phone' ? formatPhone(value) : clean(value)).slice(0, 150);
    }
    return fields;
  }
}
