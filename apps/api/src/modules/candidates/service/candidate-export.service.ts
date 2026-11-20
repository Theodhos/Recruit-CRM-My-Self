import { HttpStatus, Injectable } from '@nestjs/common';

import { AppException } from '../../../common/exceptions/app.exception';
import { AuditLogsService } from '../../audit-logs/service/audit-logs.service';
import { MAX_EXPORT_ROWS, type CandidateSelectionDto, type ExportCandidatesDto, type PreviewExportDto, type SetConsentDto } from '../dto';
import { checkContactPolicy, type ContactPurpose, type ExclusionReason } from '../lib/contact-policy';
import { type ExportFieldKey, type ExportRow } from '../lib/export-fields';
import { buildExportFile, DIALPAD_MAX_CONTACTS, type BuiltFile } from '../lib/export-files';
import { CandidatesRepository } from '../repositories/candidates.repository';

export interface ExportPreview {
  /** People the selection stands for. */
  matching: number;
  /** People who may be contacted for this purpose — the only ones that go into a file. */
  included: number;
  excluded: Record<ExclusionReason, number>;
  /** Dialpad takes 500 contacts per file. */
  dialpadParts: number;
}

type Resolved = { all: ExportRow[]; included: ExportRow[]; preview: ExportPreview };

/**
 * Contact lists. A list is built in one place and one order: resolve the selection on the server, drop everyone the
 * contact policy does not allow for the purpose, and only then write the file — so there is no way to export (or
 * count) a person who opted out, however the selection was made.
 */
@Injectable()
export class CandidateExportService {
  constructor(
    private readonly repository: CandidatesRepository,
    private readonly auditLogs: AuditLogsService,
  ) {}

  private assertSelectable(selection: CandidateSelectionDto) {
    const filters = selection.filters;
    if (selection.mode === 'FILTER' && (filters?.unassigned || filters?.reviewStatus === 'SUGGESTED')) {
      throw new AppException('SELECTION_NOT_SUPPORTED', 'This view is ranked by the system and cannot be exported as a whole. Tick the people you want instead.', HttpStatus.BAD_REQUEST);
    }
  }

  private async resolve(organisationId: string, purpose: ContactPurpose, selection: CandidateSelectionDto): Promise<Resolved> {
    this.assertSelectable(selection);
    const where = await this.repository.selectionWhere(organisationId, selection);
    const rows = (await this.repository.findForExport(organisationId, where, MAX_EXPORT_ROWS + 1)) as ExportRow[];
    if (rows.length > MAX_EXPORT_ROWS) {
      throw new AppException('TOO_MANY_ROWS', `More than ${MAX_EXPORT_ROWS.toLocaleString('en-GB')} people match. Narrow the filters first.`, HttpStatus.BAD_REQUEST);
    }

    const excluded: Record<ExclusionReason, number> = { DO_NOT_CONTACT: 0, OPTED_OUT: 0, NO_CONSENT: 0, NO_PHONE: 0, NO_EMAIL: 0 };
    const included: ExportRow[] = [];
    for (const row of rows) {
      const reason = checkContactPolicy(row as never, purpose, { requireConsent: false });
      if (reason) excluded[reason] += 1;
      else included.push(row);
    }
    return {
      all: rows,
      included,
      preview: { matching: rows.length, included: included.length, excluded, dialpadParts: Math.max(1, Math.ceil(included.length / DIALPAD_MAX_CONTACTS)) },
    };
  }

  /** The numbers behind the "Export" dialog: how many go in, and exactly why the rest do not. No personal data. */
  async preview(organisationId: string, dto: PreviewExportDto): Promise<ExportPreview> {
    return (await this.resolve(organisationId, dto.purpose, dto.selection)).preview;
  }

  async export(organisationId: string, userId: string, dto: ExportCandidatesDto): Promise<BuiltFile & { preview: ExportPreview; part: number; parts: number }> {
    const { included, preview } = await this.resolve(organisationId, dto.purpose, dto.selection);
    if (included.length === 0) {
      throw new AppException('NOTHING_TO_EXPORT', 'No one in this selection may be contacted this way, so there is nothing to export.', HttpStatus.UNPROCESSABLE_ENTITY, preview);
    }

    let rows = included;
    const parts = dto.format === 'DIALPAD' ? preview.dialpadParts : 1;
    const part = Math.min(dto.part ?? 1, parts);
    if (dto.format === 'DIALPAD') rows = included.slice((part - 1) * DIALPAD_MAX_CONTACTS, part * DIALPAD_MAX_CONTACTS);

    const file = buildExportFile(dto.format, rows, dto.fields as ExportFieldKey[]);
    // who exported what, for which purpose and how many — never the contents
    await this.auditLogs.record({
      organisationId,
      userId,
      action: 'EXPORT_CANDIDATES',
      entityType: 'Candidate',
      entityId: 'export',
      newValues: {
        purpose: dto.purpose,
        format: dto.format,
        fields: dto.format === 'DIALPAD' ? 'dialpad' : dto.fields,
        selection: dto.selection.mode,
        matching: preview.matching,
        exported: rows.length,
        excluded: preview.excluded,
        part: dto.format === 'DIALPAD' ? `${part}/${parts}` : undefined,
      },
    });
    return { ...file, preview, part, parts };
  }

  /** Admin: records what people agreed to (or opted out of) for the whole selection. */
  async setConsent(organisationId: string, userId: string, dto: SetConsentDto) {
    if (dto.status === 'GRANTED' && !dto.evidence?.trim()) {
      throw new AppException('EVIDENCE_REQUIRED', 'Say where the consent comes from (for example a signed form and its date).', HttpStatus.BAD_REQUEST);
    }
    this.assertSelectable(dto.selection);
    const where = await this.repository.selectionWhere(organisationId, dto.selection);
    const data: Record<string, 'UNKNOWN' | 'GRANTED' | 'OPTED_OUT'> = {};
    if (dto.channels.includes('SMS')) data.smsConsent = dto.status;
    if (dto.channels.includes('EMAIL')) data.emailConsent = dto.status;
    if (dto.channels.includes('CALL')) data.callConsent = dto.status;
    const updated = await this.repository.setConsent(organisationId, where, data);
    await this.auditLogs.record({
      organisationId,
      userId,
      action: 'SET_CANDIDATE_CONSENT',
      entityType: 'Candidate',
      entityId: 'bulk',
      newValues: { channels: dto.channels, status: dto.status, evidence: dto.evidence?.trim() ?? null, selection: dto.selection.mode, updated },
    });
    return { updated };
  }
}
