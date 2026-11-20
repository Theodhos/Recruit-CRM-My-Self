import * as XLSX from 'xlsx';

import { ResumeParserService } from './resume-parser.service';

describe('ResumeParserService', () => {
  const parser = new ResumeParserService();

  it('reads "Label: value" lines', () => {
    const text = 'Name: Arben Hoxha\nPhone: +44 7700 900123\nLocation: Leeds, UK\nJob title: Site Electrician\nTrade: Electrician\n';
    expect(parser.parse(text)).toEqual({ firstName: 'Arben', lastName: 'Hoxha', phone: '+44 7700 900123', location: 'Leeds, UK', jobTitle: 'Site Electrician', trade: 'Electrician' });
  });

  it('reads the shape of a CV: name, phone, location, trade word', () => {
    const text = 'JOHN SMITH\nPlumber\nManchester, United Kingdom\nmobile 07700 900456\nExperienced plumber with ten years on site.';
    const result = parser.parse(text);
    expect(result).toMatchObject({ firstName: 'John', lastName: 'Smith', location: 'Manchester, United Kingdom', trade: 'Plumber' });
    expect(result.phone).toBe('+44 7700 900456');
  });

  it('falls back to the file name for the person', () => {
    expect(parser.parse('nothing useful here', 'Maria_Gjoni_CV.pdf')).toMatchObject({ firstName: 'Maria', lastName: 'Gjoni' });
  });

  it('reads text from a spreadsheet, plain text, and never refuses an unknown file', async () => {
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([['Name', 'Ana Dodaj'], ['Phone', '07700 900789']]), 'CV');
    const xlsx = Buffer.from(XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }));
    const fromSheet = await parser.extractText({ buffer: xlsx, originalname: 'cv.xlsx', mimetype: 'application/octet-stream' });
    expect(parser.parse(fromSheet)).toMatchObject({ firstName: 'Ana', lastName: 'Dodaj' });
    expect(await parser.extractText({ buffer: Buffer.from('Name: Li Wei'), originalname: 'cv.txt', mimetype: 'text/plain' })).toContain('Li Wei');
    await expect(parser.extractText({ buffer: Buffer.from([0, 1, 2, 3]), originalname: 'photo.jpg', mimetype: 'image/jpeg' })).resolves.toBe('');
  });

  it('never takes a section heading for a name, and trusts the file name that the document confirms', () => {
    const text = 'About Me\nEngineering student, driving licence category B, looking for site work.\nTheodhos Lupe\n+355 69 788 3395\nKorce | Country: Albania\nSkills\nTeamwork\nDriver licence B';
    const result = parser.parse(text, 'Theodhos Lupe CV.pdf');
    expect(result).toMatchObject({ firstName: 'Theodhos', lastName: 'Lupe', location: 'Korce, Albania' });
    expect(result.jobTitle).toBeUndefined();
    expect(result.trade).toBeUndefined();
    expect(result.phone).toBe('+355 69 788 3395');
  });

  it('without a file name, still skips the headings and finds the name line', () => {
    const result = parser.parse('About Me\nSkills\nTheodhos Lupe\nSite Engineer\nKorce, Albania\n+355 69 788 3395');
    expect(result).toMatchObject({ firstName: 'Theodhos', lastName: 'Lupe', jobTitle: 'Site Engineer', location: 'Korce, Albania' });
  });

  it('writes the phone number the way it should be written', () => {
    expect(parser.parse('Theodhos Lupe\nTel: (+355) 697883395').phone).toBe('+355 69 788 3395');
    expect(parser.parse('Ana Dodaj\nMobile 0044 7700 900111').phone).toBe('+44 7700 900111');
    expect(parser.parse('Ana Dodaj\nPhone: 07700-900.222').phone).toBe('+44 7700 900222');
  });

  it('finds the job title in the experience section and the trade the document speaks of most', () => {
    const text = 'Maria Gjoni\nExperience\nSite Electrician\nAcme Building Ltd 2019 - 2024\nInstalled electrical wiring on housing sites. Electrician on large projects.\nDriving licence B';
    const result = parser.parse(text);
    expect(result).toMatchObject({ firstName: 'Maria', lastName: 'Gjoni', jobTitle: 'Site Electrician', trade: 'Electrician' });
  });

  describe('with Claude (ANTHROPIC_API_KEY set)', () => {
    const config = { get: (key: string, fallback?: string) => (key === 'ANTHROPIC_API_KEY' ? 'sk-test' : fallback) } as never;
    const original = global.fetch;
    afterEach(() => {
      global.fetch = original;
    });

    it('uses what Claude read and lets the built-in reader fill the rest', async () => {
      let sent: { model: string } | undefined;
      const answer = '{"firstName":"Besnik","lastName":"Krasniqi","phone":"","location":"Bristol, UK","jobTitle":"Site Foreman","trade":""}';
      global.fetch = jest.fn(async (_url: unknown, init?: { body?: string }) => {
        sent = JSON.parse(init!.body!);
        return { ok: true, json: async () => ({ content: [{ type: 'text', text: answer }] }) };
      }) as never;
      const smart = new ResumeParserService(config);
      const result = await smart.read({
        buffer: Buffer.from('Besnik Krasniqi, foreman. Based in Bristol. Tel 07700 900321. Ten years on large building sites.'),
        originalname: 'cv.txt',
        mimetype: 'text/plain',
      });
      expect(result).toMatchObject({ firstName: 'Besnik', lastName: 'Krasniqi', location: 'Bristol, UK', jobTitle: 'Site Foreman' });
      expect(result.phone).toBe('+44 7700 900321');
      expect(sent?.model).toBe('claude-haiku-5-5');
    });

    it('falls back to the built-in reader when Claude cannot be reached', async () => {
      global.fetch = jest.fn(async () => ({ ok: false, status: 500 })) as never;
      const smart = new ResumeParserService(config);
      const result = await smart.read({ buffer: Buffer.from('Name: Eda Berisha\nPhone: 07700 900654'), originalname: 'cv.txt', mimetype: 'text/plain' });
      expect(result).toMatchObject({ firstName: 'Eda', lastName: 'Berisha' });
    });
  });
});
