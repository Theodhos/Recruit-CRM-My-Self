'use client';

import { Handshake as BannerIcon } from '@crm/ui/icons';
import { PageBanner } from '@/components/tables/page-banner';
import type { CompanyPipelineStage } from '@crm/types';
import { Button, cn, Input } from '@crm/ui';
import { GripVertical, NotebookPen, Search } from '@crm/ui/icons';
import { useState } from 'react';

import { COMPANY_PIPELINE_STAGES, CompanyStageDialog, LostReasonDialog, WinProofDialog } from '@/features/companies';
import { COMPANY_STAGE_TONE, fillForTone } from '@/features/pipelines';
import { AddedByFilter } from '@/features/users';
import { useCompanyBoard, useUpdateCompany } from '@/hooks/use-companies';
import { ApiClientError } from '@/lib/api-client';
import type { CompanyWithCounts } from '@/services/companies.service';

/**
 * The sales board: every company as a card in the column of its
 * `pipelineStage` (New → In conversation / Follow-up → Win | Lost). Drag a
 * card to another column, or use its "Move to" select, to change the stage; a
 * click on a card opens its pop-up (History, pay calculation, stage buttons).
 * The stages are fixed — unlike Pipeline Candidates there are no schemes.
 */
export default function PipelineCompaniesPage() {
  const [search, setSearch] = useState('');
  const [ownerId, setOwnerId] = useState('');
  // the card whose pop-up is open — kept by id, so the pop-up always shows the company as the board has it now
  const [openCompanyId, setOpenCompanyId] = useState<string | null>(null);

  const { data: companies, isLoading } = useCompanyBoard(search || undefined, ownerId || undefined);
  const updateCompany = useUpdateCompany();

  // Native HTML5 drag-and-drop, same interaction as Pipeline Candidates.
  const [draggedCompanyId, setDraggedCompanyId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<CompanyPipelineStage | null>(null);

  // a company dragged to Win waits here for its proof document
  const [proofFor, setProofFor] = useState<CompanyWithCounts | null>(null);
  // a company dragged to Lost waits here for its reason
  const [lostFor, setLostFor] = useState<CompanyWithCounts | null>(null);

  function moveCompany(company: CompanyWithCounts | undefined, stage: CompanyPipelineStage, proven = false) {
    if (!company || company.pipelineStage === stage) return;
    if (stage === 'LOST') {
      setLostFor(company);
      return;
    }
    if (stage === 'WIN' && !proven) {
      setProofFor(company);
      return;
    }
    updateCompany.mutate(
      { id: company.id, input: { pipelineStage: stage } },
      {
        onError: (error) =>
          window.alert(error instanceof ApiClientError ? error.message : 'Could not move this company.'),
      },
    );
  }


  const companiesByStage = new Map<CompanyPipelineStage, CompanyWithCounts[]>();
  for (const company of companies ?? []) {
    const list = companiesByStage.get(company.pipelineStage) ?? [];
    list.push(company);
    companiesByStage.set(company.pipelineStage, list);
  }

  return (
    <div className="flex flex-col gap-6">
      <PageBanner tone="fuchsia" icon={BannerIcon} title="Pipeline Companies" description={<>Every company, grouped by stage — drag a card to another column to move it.</>} />

      <div className="flex flex-wrap items-end gap-3">
        <div className="relative max-w-xs flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />
          <Input
            placeholder="Search companies…"
            className="pl-8"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <AddedByFilter value={ownerId} onChange={setOwnerId} />
      </div>

      {isLoading ? (
        <p className="py-10 text-center text-sm text-foreground/50">Loading…</p>
      ) : (
        <div className="-mx-4 overflow-x-auto px-4 pb-3 sm:mx-0 sm:px-0" data-testid="company-pipeline-board">
          <div className="flex gap-4">
            {COMPANY_PIPELINE_STAGES.map((stage) => {
              const cards = companiesByStage.get(stage.value) ?? [];
              const isDragTarget = dragOverStage === stage.value;
              // the same design as Pipeline Candidates: a white column, the stage's colour only as the bar on top
              const fill = fillForTone(COMPANY_STAGE_TONE[stage.value]);
              return (
                <div
                  key={stage.value}
                  data-stage={stage.value}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (dragOverStage !== stage.value) setDragOverStage(stage.value);
                  }}
                  onDragLeave={() => setDragOverStage((current) => (current === stage.value ? null : current))}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOverStage(null);
                    moveCompany(
                      companies?.find((c) => c.id === draggedCompanyId),
                      stage.value,
                    );
                    setDraggedCompanyId(null);
                  }}
                  className={cn(
                    'flex w-[80vw] shrink-0 flex-col overflow-hidden rounded-lg border bg-accent/20 transition-colors sm:w-72',
                    isDragTarget ? 'border-primary bg-accent/50 ring-2 ring-primary/30' : fill.box,
                  )}
                >
                  <div className={cn('h-1.5', fill.bar)} />
                  <div className={cn('border-b px-3 py-2.5', fill.header)}>
                    <p className="flex items-center gap-2 text-sm font-semibold">
                      {stage.label}
                      <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums', fill.chip)}>{cards.length}</span>
                    </p>
                    <p className="text-xs text-foreground/60">{cards.length === 1 ? 'company' : 'companies'}</p>
                  </div>

                  <div className="flex max-h-[65vh] flex-col gap-2 overflow-y-auto p-2">
                    {cards.length === 0 ? (
                      <p
                        className={cn(
                          'rounded-md border border-dashed px-2 py-6 text-center text-xs',
                          isDragTarget ? 'border-primary text-primary' : 'border-transparent text-foreground/40',
                        )}
                      >
                        {isDragTarget ? 'Drop here' : 'No companies here'}
                      </p>
                    ) : (
                      cards.map((company) => (
                        <div
                          key={company.id}
                          draggable
                          onDragStart={(e) => {
                            setDraggedCompanyId(company.id);
                            e.dataTransfer.effectAllowed = 'move';
                          }}
                          onDragEnd={() => {
                            setDraggedCompanyId(null);
                            setDragOverStage(null);
                          }}
                          onClick={(e) => {
                            if ((e.target as HTMLElement).closest('a,button,input,select,textarea,label')) return;
                            setOpenCompanyId(company.id);
                          }}
                          title="Open history, pay calculation and stage buttons"
                          data-testid="company-card"
                          className={cn(
                            'flex cursor-grab flex-col gap-1.5 rounded-md border border-l-4 border-border bg-background p-2.5 text-sm shadow-sm hover:shadow-md active:cursor-grabbing',
                            // white, with the stage's colour only on its left edge — like the cards of Pipeline Candidates
                            fill.edge,
                            draggedCompanyId === company.id ? 'opacity-40' : '',
                          )}
                        >
                          <span className="inline-flex items-start gap-1">
                            <GripVertical className="mt-0.5 h-3.5 w-3.5 shrink-0 text-foreground/30" />
                            {/* plain text, not a link: a click anywhere on the card opens the pop-up (which links to the company page) */}
                            <span className="font-medium" data-testid="company-card-name">
                              {company.name}
                            </span>
                          </span>
                          {company.industry || company.city ? (
                            <p className="pl-4.5 text-xs text-foreground/50">
                              {[company.industry, company.city].filter(Boolean).join(' · ')}
                            </p>
                          ) : null}
                          <p className="pl-4.5 text-xs text-foreground/50">
                            {company._count.jobs} {company._count.jobs === 1 ? 'job' : 'jobs'} ·{' '}
                            {company._count.contacts} {company._count.contacts === 1 ? 'contact' : 'contacts'}
                          </p>
                          {/* no Move to: the company moves with the stage buttons in its pop-up, or by dragging */}
                          <Button type="button" variant="outline" size="sm" className={cn('h-8 justify-start text-xs', fill.cardButton)} onClick={() => setOpenCompanyId(company.id)}>
                            <NotebookPen className="mr-1 h-3.5 w-3.5" /> Stage notes &amp; pay
                          </Button>
                          {company.doNotContact ? (
                            <span className="w-fit rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700" data-testid="do-not-contact-tag">
                              Do not contact
                            </span>
                          ) : null}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {lostFor ? <LostReasonDialog company={lostFor} onCancel={() => setLostFor(null)} onDone={() => setLostFor(null)} /> : null}

      {proofFor ? (
        <WinProofDialog
          company={proofFor}
          onCancel={() => setProofFor(null)}
          onUploaded={() => {
            moveCompany(proofFor, 'WIN', true);
            setProofFor(null);
          }}
        />
      ) : null}

      {openCompanyId && companies?.some((c) => c.id === openCompanyId) ? (
        <CompanyStageDialog
          key={openCompanyId}
          company={companies.find((c) => c.id === openCompanyId)!}
          onClose={() => setOpenCompanyId(null)}
        />
      ) : null}

    </div>
  );
}
