import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../../../infrastructure/database/database.service';
import type { ListDocumentsQueryDto } from '../dto/list-documents-query.dto';

export interface CreateDocumentRecord {
  name: string;
  type: 'CV' | 'RESUME' | 'COVER_LETTER' | 'CONTRACT' | 'OFFER_LETTER' | 'WIN_PROOF' | 'OTHER';
  fileUrl: string;
  fileSize: number;
  companyId?: string;
  contactId?: string;
  jobId?: string;
  applicationId?: string;
  candidateId?: string;
  placementId?: string;
}

const RELATION_INCLUDE = {
  company: { select: { id: true, name: true } },
  contact: { select: { id: true, firstName: true, lastName: true } },
  job: { select: { id: true, title: true } },
  candidate: { select: { id: true, firstName: true, lastName: true } },
  placement: { select: { id: true, status: true } },
  uploadedBy: { select: { id: true, firstName: true, lastName: true } },
} as const;

/**
 * Tenant-scoped data access for 'documents'. Always resolve the client via
 * `this.db.forTenant(organisationId)` (packages/database scopedPrisma) —
 * never query the raw PrismaClient for tenant-scoped models. See
 * docs/architecture/multi-tenancy.md.
 */
@Injectable()
export class DocumentsRepository {
  constructor(private readonly db: DatabaseService) {}

  /** The names a document's Drive folder is made of: who or what it belongs to. Missing records give null. */
  async ownerLabels(
    organisationId: string,
    ids: { placementId?: string; candidateId?: string; applicationId?: string; jobId?: string; companyId?: string; contactId?: string },
  ) {
    const db = this.db.forTenant(organisationId);
    const person = (c: { firstName: string; lastName: string } | null | undefined) => (c ? `${c.firstName} ${c.lastName}`.trim() : null);
    const [placement, candidate, application, job, company, contact] = await Promise.all([
      ids.placementId ? db.placement.findFirst({ where: { id: ids.placementId }, select: { candidate: { select: { firstName: true, lastName: true } }, job: { select: { title: true } } } }) : null,
      ids.candidateId ? db.candidate.findFirst({ where: { id: ids.candidateId }, select: { firstName: true, lastName: true } }) : null,
      ids.applicationId ? db.application.findFirst({ where: { id: ids.applicationId }, select: { candidate: { select: { firstName: true, lastName: true } }, job: { select: { title: true } } } }) : null,
      ids.jobId ? db.job.findFirst({ where: { id: ids.jobId }, select: { title: true, company: { select: { name: true } } } }) : null,
      ids.companyId ? db.company.findFirst({ where: { id: ids.companyId }, select: { name: true } }) : null,
      ids.contactId ? db.contact.findFirst({ where: { id: ids.contactId }, select: { firstName: true, lastName: true } }) : null,
    ]);
    return {
      placement: placement ? `${person(placement.candidate)} – ${placement.job.title}` : null,
      candidate: person(candidate),
      application: application ? `${person(application.candidate)}${application.job ? ` – ${application.job.title}` : ''}` : null,
      job: job ? `${job.title}${job.company ? ` – ${job.company.name}` : ''}` : null,
      company: company?.name ?? null,
      contact: person(contact),
    };
  }

  async findMany(organisationId: string, query: ListDocumentsQueryDto) {
    const db = this.db.forTenant(organisationId);
    const where = {
      ...(query.type ? { type: query.type } : {}),
      ...(query.companyId ? { companyId: query.companyId } : {}),
      ...(query.contactId ? { contactId: query.contactId } : {}),
      ...(query.jobId ? { jobId: query.jobId } : {}),
      ...(query.applicationId ? { applicationId: query.applicationId } : {}),
      ...(query.candidateId ? { candidateId: query.candidateId } : {}),
      ...(query.placementId ? { placementId: query.placementId } : {}),
      ...(query.search ? { name: { contains: query.search, mode: 'insensitive' as const } } : {}),
    };

    const [items, totalItems] = await Promise.all([
      db.document.findMany({
        where,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        orderBy: { createdAt: 'desc' },
        include: RELATION_INCLUDE,
      }),
      db.document.count({ where }),
    ]);

    return { items, totalItems };
  }

  findById(organisationId: string, id: string) {
    return this.db.forTenant(organisationId).document.findFirst({
      where: { id },
      include: RELATION_INCLUDE,
    });
  }

  create(organisationId: string, uploadedById: string, record: CreateDocumentRecord) {
    return this.db.forTenant(organisationId).document.create({
      data: { ...record, organisationId, uploadedById },
      include: RELATION_INCLUDE,
    });
  }

  delete(organisationId: string, id: string) {
    return this.db.forTenant(organisationId).document.delete({ where: { id } });
  }
}
