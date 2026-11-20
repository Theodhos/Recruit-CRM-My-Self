jest.mock('../../../infrastructure/database/database.service', () => ({ DatabaseService: class DatabaseService {} }));

import * as XLSX from 'xlsx';

import { AppException } from '../../../common/exceptions/app.exception';
import type { AuditLogsService } from '../../audit-logs/service/audit-logs.service';
import type { ExportRow } from '../lib/export-fields';
import type { CandidatesRepository } from '../repositories/candidates.repository';

import { CandidateExportService } from './candidate-export.service';

const person = (id: string, extra: Partial<ExportRow> = {}): ExportRow => ({
  id,
  firstName: `First${id}`,
  lastName: `Last${id}`,
  email: `${id}@example.com`,
  phone: '07911 123456',
  location: 'London',
  postalCode: 'SW1A 1AA',
  jobTitle: 'Electrician',
  trade: 'electrician',
  currentCompany: null,
  grade: 'A',
  employmentStatus: null,
  experienceYears: 5,
  skills: [],
  qualifications: [],
  lastContactedAt: null,
  status: 'ACTIVE',
  source: null,
  createdAt: new Date('2026-09-01'),
  smsConsent: 'GRANTED',
  emailConsent: 'GRANTED',
  callConsent: 'UNKNOWN',
  ...extra,
});

function setup(rows: ExportRow[]) {
  const repository = {
    selectionWhere: jest.fn().mockResolvedValue({ marker: 'where' }),
    findForExport: jest.fn().mockResolvedValue(rows),
    setConsent: jest.fn().mockResolvedValue(3),
  } as unknown as CandidatesRepository & { selectionWhere: jest.Mock; findForExport: jest.Mock; setConsent: jest.Mock };
  const audit = { record: jest.fn().mockResolvedValue(undefined) } as unknown as AuditLogsService & { record: jest.Mock };
  return { service: new CandidateExportService(repository, audit), repository, audit };
}

const ids = (...list: string[]) => ({ mode: 'IDS' as const, ids: list });

describe('CandidateExportService', () => {
  const mixed = () => [
    person('ok1'),
    person('ok2'),
    person('optout', { smsConsent: 'OPTED_OUT' }),
    person('noconsent', { smsConsent: 'UNKNOWN' }),
    person('dnc', { status: 'DO_NOT_CONTACT' }),
    person('nophone', { phone: null }),
  ];

  it('previews who goes in and exactly why the rest do not — without any personal data', async () => {
    const { service } = setup(mixed());

    const preview = await service.preview('org1', { purpose: 'SMS', selection: ids('a') });

    expect(preview).toEqual({
      matching: 6,
      included: 3,
      excluded: { DO_NOT_CONTACT: 1, OPTED_OUT: 1, NO_CONSENT: 0, NO_PHONE: 1, NO_EMAIL: 0 },
      dialpadParts: 1,
    });
  });

  it('writes only the people who may be contacted for the purpose — opted-out people never reach the file', async () => {
    const { service } = setup(mixed());

    const file = await service.export('org1', 'user1', { purpose: 'SMS', format: 'CSV', fields: ['firstName', 'mobile'], selection: ids('a') });

    const text = file.buffer.toString('utf8');
    expect(file.rows).toBe(3);
    expect(text).toContain('Firstok1');
    expect(text).toContain('Firstok2');
    // nothing recorded is not an opt-out, so an export includes them
    expect(text).toContain('Firstnoconsent');
    for (const left of ['optout', 'dnc', 'nophone']) expect(text).not.toContain(left);
  });

  it('the same people are judged differently for e-mail: an SMS opt-out does not block e-mail', async () => {
    const { service } = setup(mixed());

    const preview = await service.preview('org1', { purpose: 'EMAIL', selection: ids('a') });

    expect(preview.included).toBe(5);
    expect(preview.excluded.DO_NOT_CONTACT).toBe(1);
    expect(preview.excluded.OPTED_OUT).toBe(0);
  });

  it('XLSX holds the same people and columns as CSV would', async () => {
    const { service } = setup(mixed());

    const file = await service.export('org1', 'user1', { purpose: 'SMS', format: 'XLSX', fields: ['lastName', 'email'], selection: ids('a') });

    const rows = XLSX.utils.sheet_to_json(XLSX.read(file.buffer, { type: 'buffer' }).Sheets.Candidates!);
    expect(rows).toEqual([
      { 'Last name': 'Lastok1', Email: 'ok1@example.com' },
      { 'Last name': 'Lastok2', Email: 'ok2@example.com' },
      { 'Last name': 'Lastnoconsent', Email: 'noconsent@example.com' },
    ]);
  });

  it('Dialpad: 500 per file, and each part holds the right slice', async () => {
    const many = Array.from({ length: 1_203 }, (_, i) => person(`p${String(i).padStart(4, '0')}`));
    const { service } = setup(many);

    const third = await service.export('org1', 'user1', { purpose: 'SMS', format: 'DIALPAD', fields: ['firstName'], selection: ids('a'), part: 3 });
    const lines = third.buffer.toString('utf8').trim().split('\r\n');

    expect(third.parts).toBe(3);
    expect(third.part).toBe(3);
    expect(lines).toHaveLength(1 + 203);
    expect(lines[1]).toContain('Firstp1000');
  });

  it('refuses to produce a file when nobody may be contacted, and says why', async () => {
    const { service, audit } = setup([person('optout', { smsConsent: 'OPTED_OUT' }), person('dnc', { status: 'DO_NOT_CONTACT' })]);

    const failure = await service.export('org1', 'user1', { purpose: 'SMS', format: 'CSV', fields: ['firstName'], selection: ids('a') }).catch((e) => e);

    expect(failure).toBeInstanceOf(AppException);
    expect(failure.code).toBe('NOTHING_TO_EXPORT');
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('records who exported what — counts and column names, never the contents', async () => {
    const { service, audit } = setup(mixed());

    await service.export('org1', 'user1', { purpose: 'SMS', format: 'CSV', fields: ['firstName', 'mobile'], selection: ids('a') });

    expect(audit.record).toHaveBeenCalledTimes(1);
    const entry = audit.record.mock.calls[0][0];
    expect(entry).toMatchObject({
      organisationId: 'org1',
      userId: 'user1',
      action: 'EXPORT_CANDIDATES',
      newValues: { purpose: 'SMS', format: 'CSV', fields: ['firstName', 'mobile'], selection: 'IDS', matching: 6, exported: 3 },
    });
    expect(JSON.stringify(entry)).not.toContain('example.com');
    expect(JSON.stringify(entry)).not.toContain('07911');
  });

  it('resolves "everyone matching the filters" on the server, minus the people taken out one by one', async () => {
    const { service, repository } = setup([person('x')]);
    const selection = { mode: 'FILTER' as const, filters: { page: 1, pageSize: 25, trade: 'electrician' } as never, excludeIds: ['c9'] };

    await service.preview('org1', { purpose: 'CALL', selection });

    expect(repository.selectionWhere).toHaveBeenCalledWith('org1', selection);
  });

  it('will not export a ranked view as a whole (unassigned pool / suggestions): the people must be ticked', async () => {
    const { service } = setup([]);
    for (const filters of [{ unassigned: true }, { reviewStatus: 'SUGGESTED' }]) {
      const failure = await service.preview('org1', { purpose: 'CALL', selection: { mode: 'FILTER', filters: { page: 1, pageSize: 25, ...filters } as never } }).catch((e) => e);
      expect(failure.code).toBe('SELECTION_NOT_SUPPORTED');
    }
  });

  it('refuses a selection larger than the limit', async () => {
    const { service } = setup(Array.from({ length: 20_001 }, (_, i) => person(`p${i}`)));
    const failure = await service.preview('org1', { purpose: 'CALL', selection: ids('a') }).catch((e) => e);
    expect(failure.code).toBe('TOO_MANY_ROWS');
  });

  it('recording consent needs evidence when granting, and is audited', async () => {
    const { service, repository, audit } = setup([]);

    const missing = await service.setConsent('org1', 'admin1', { selection: ids('a'), channels: ['SMS'], status: 'GRANTED' }).catch((e) => e);
    expect(missing.code).toBe('EVIDENCE_REQUIRED');
    expect(repository.setConsent).not.toHaveBeenCalled();

    await expect(
      service.setConsent('org1', 'admin1', { selection: ids('a'), channels: ['SMS', 'EMAIL'], status: 'GRANTED', evidence: ' Signed form, 3 Nov 2026 ' }),
    ).resolves.toEqual({ updated: 3 });
    expect(repository.setConsent).toHaveBeenCalledWith('org1', { marker: 'where' }, { smsConsent: 'GRANTED', emailConsent: 'GRANTED' });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'SET_CANDIDATE_CONSENT', userId: 'admin1', newValues: expect.objectContaining({ evidence: 'Signed form, 3 Nov 2026', updated: 3 }) }),
    );
  });

  it('opting people out needs no evidence', async () => {
    const { service, repository } = setup([]);
    await service.setConsent('org1', 'admin1', { selection: ids('a'), channels: ['SMS'], status: 'OPTED_OUT' });
    expect(repository.setConsent).toHaveBeenCalledWith('org1', { marker: 'where' }, { smsConsent: 'OPTED_OUT' });
  });
});
