'use client';

import { Building2 as BannerIcon } from '@crm/ui/icons';
import { PageBanner } from '@/components/tables/page-banner';
import { PageSkeleton } from '@/components/layout/page-skeleton';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Dialog } from '@crm/ui';
import type { CreatePlacementInput } from '@crm/validation';
import { ArrowLeft, Briefcase, Building2, FolderOpen, GitBranch, Globe, Info, LayoutGrid, Mail, MapPin, Network, Pencil, Phone, Plus, Trophy, UserCog, Users, UsersRound } from '@crm/ui/icons';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { EditableTextCard } from '@/components/editable-text-card';
import { AgreedFeeCard, CompanyContacts, CompanyForm } from '@/features/companies';
import { PersonDialog } from '@/features/companies/person-dialog';
import { STRUCTURE_GROUPS, rankTitle } from '@/features/companies/structure';
import { DocumentsCard } from '@/features/documents';
import { JobForm } from '@/features/jobs';
import { StageStatusBadge } from '@/features/pipelines';
import { PlacementForm } from '@/features/placements';
import { useApplications } from '@/hooks/use-applications';
import { useCompany, useUpdateCompany } from '@/hooks/use-companies';
import { useContacts } from '@/hooks/use-contacts';
import { useUploadDocument } from '@/hooks/use-documents';
import { useCreateJob, useJobs } from '@/hooks/use-jobs';
import { usePhones } from '@/hooks/use-phones';
import { useCreatePlacement, usePlacements } from '@/hooks/use-placements';
import { toFormDefaults } from '@/lib/form-defaults';
import { COMPANY_STATUS_COLOUR, JOB_STATUS_COLOUR, PLACEMENT_STATUS_COLOUR, employmentTypeColour } from '@/lib/status-colors';
import type { ContactWithCompany } from '@/services/contacts.service';

const label = (value: string) => value.replaceAll('_', ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

const COMPANY_STATUS_VARIANT = COMPANY_STATUS_COLOUR;

/** The sections of the page, each for one purpose; the open one is kept in the address (#people). */
const COMPANY_TABS = [
  { key: 'overview', label: 'Overview', hint: 'Who the company is, how to reach it, what we agreed with it', icon: LayoutGrid },
  { key: 'people', label: 'People', hint: 'The organisation structure and every contact', icon: UsersRound },
  { key: 'work', label: 'Jobs & employees', hint: 'What it is hiring for and who is placed there', icon: Briefcase },
  { key: 'activity', label: 'Pipeline & files', hint: 'The pipeline, documents and the numbers on the calling list', icon: FolderOpen },
] as const;
type CompanyTab = (typeof COMPANY_TABS)[number]['key'];

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

const JOB_STATUS_VARIANT = JOB_STATUS_COLOUR;

const PLACEMENT_STATUS_VARIANT = PLACEMENT_STATUS_COLOUR;

/**
 * Everything about one company, on one page: its details, EVERY contact we have there (CEO, co-founders, HR, ... each
 * with all their details — contacts are managed here, there is no separate Contacts page), the jobs it is hiring for,
 * and the people actually accepted and placed there (Placement — the end of a pipeline), not a loose "current employer"
 * text match.
 */
export default function CompanyDetailPage() {
  const params = useParams<{ id: string }>();
  const companyId = params.id;

  const { data: company, isLoading } = useCompany(companyId);
  const { data: jobs } = useJobs({ companyId, pageSize: 50 });
  const { data: employees } = usePlacements({ companyId, pageSize: 50 });
  const { data: contacts } = useContacts({ companyId, pageSize: 100 });
  const { data: applications } = useApplications({ companyId, pageSize: 100 });
  const { data: phones } = usePhones({ companyId, pageSize: 20 });
  const [person, setPerson] = useState<ContactWithCompany | null>(null);

  // the company's structure from the people we know there: CEO / founders first, then C-level, directors, heads, HR, managers, team
  const structure = useMemo(() => {
    const groups = new Map<string, ContactWithCompany[]>();
    for (const c of [...(contacts?.items ?? [])].sort((a, b) => rankTitle(a.jobTitle).rank - rankTitle(b.jobTitle).rank || a.lastName.localeCompare(b.lastName))) {
      const g = rankTitle(c.jobTitle).group;
      groups.set(g, [...(groups.get(g) ?? []), c]);
    }
    return STRUCTURE_GROUPS.filter((g) => groups.has(g)).map((g) => ({ group: g, people: groups.get(g)! }));
  }, [contacts]);
  // who is where on the pipeline, across every job of this company
  const pipelineSummary = useMemo(() => {
    const byStage = new Map<string, { stage: { name: string; type: string; order: number }; count: number }>();
    for (const a of applications?.items ?? []) {
      const key = `${a.pipelineStage.order}:${a.pipelineStage.name}`;
      byStage.set(key, { stage: a.pipelineStage, count: (byStage.get(key)?.count ?? 0) + 1 });
    }
    return [...byStage.values()].sort((x, y) => x.stage.order - y.stage.order);
  }, [applications]);

  const updateCompany = useUpdateCompany();
  const createJob = useCreateJob();
  const createPlacement = useCreatePlacement();
  const uploadDocument = useUploadDocument();

  const [editOpen, setEditOpen] = useState(false);
  const [tab, setTab] = useState<CompanyTab>('overview');
  useEffect(() => {
    const fromAddress = window.location.hash.replace('#', '') as CompanyTab;
    if (COMPANY_TABS.some((item) => item.key === fromAddress)) setTab(fromAddress);
  }, []);
  const openTab = (next: CompanyTab) => {
    setTab(next);
    window.history.replaceState(null, '', `#${next}`);
  };
  const permanentPlaced = (employees?.items ?? []).filter((e) => e.employmentType === 'PERMANENT').length;
  const temporaryPlaced = (employees?.items ?? []).filter((e) => e.employmentType === 'TEMPORARY').length;
  const [addJobOpen, setAddJobOpen] = useState(false);
  const [addEmployeeOpen, setAddEmployeeOpen] = useState(false);

  async function handleAddEmployee(values: CreatePlacementInput, file: File | null) {
    const placement = await createPlacement.mutateAsync(values);
    if (file) {
      await uploadDocument.mutateAsync({
        file,
        type: 'CONTRACT',
        placementId: placement.id,
        candidateId: values.candidateId,
        companyId: values.companyId,
      });
    }
    setAddEmployeeOpen(false);
  }

  if (isLoading || !company) {
    return <PageSkeleton />;
  }

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/companies"
        className="inline-flex w-fit items-center gap-1 text-sm text-foreground/60 hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to companies
      </Link>

      <PageBanner tone="indigo" icon={BannerIcon} title={<>
          {company.name}
          <Badge variant={COMPANY_STATUS_VARIANT[company.status]}>{company.status.replaceAll('_', ' ')}</Badge>
        </>} description={<>{company.industry ?? 'Industry not set'}</>}>
        <Button type="button" variant="outline" onClick={() => setEditOpen(true)}>
          <Pencil className="mr-1.5 h-4 w-4" /> Edit
        </Button>
      </PageBanner>

      {/* the company in four figures */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="company-figures">
        {[
          { label: 'Contacts', value: contacts?.totalItems ?? 0, note: 'people we know there', icon: Users, line: 'border-t-indigo-500', tab: 'people' as const },
          { label: 'Jobs', value: jobs?.totalItems ?? 0, note: 'it is hiring for', icon: Briefcase, line: 'border-t-sky-500', tab: 'work' as const },
          { label: 'Placed', value: employees?.totalItems ?? 0, note: `${permanentPlaced} permanent · ${temporaryPlaced} temporary`, icon: Trophy, line: 'border-t-violet-500', tab: 'work' as const },
          { label: 'On the pipeline', value: applications?.totalItems ?? 0, note: 'applicants right now', icon: GitBranch, line: 'border-t-teal-500', tab: 'activity' as const },
        ].map(({ label: name, value, note, icon: Icon, line, tab: target }) => (
          <button key={name} type="button" onClick={() => openTab(target)} className={`group flex items-center gap-3 rounded-xl border border-border border-t-2 ${line} bg-background p-3.5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md`}>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent">
              <Icon className="h-5 w-5 text-foreground/70" />
            </span>
            <span className="min-w-0">
              <span className="block text-[11px] font-semibold uppercase tracking-wide text-foreground/50">{name}</span>
              <span className="block text-2xl font-bold leading-none tabular-nums">{value.toLocaleString()}</span>
              <span className="mt-1 block truncate text-xs text-foreground/55">{note}</span>
            </span>
          </button>
        ))}
      </div>

      {/* the page in sections, by what each is for */}
      <nav className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-background p-1 shadow-sm" role="tablist" aria-label="Sections of the company">
        {COMPANY_TABS.map(({ key, label: tabLabel, hint, icon: Icon }) => {
          const count = key === 'people' ? contacts?.totalItems : key === 'work' ? (jobs?.totalItems ?? 0) + (employees?.totalItems ?? 0) : key === 'activity' ? (applications?.totalItems ?? 0) + (phones?.totalItems ?? 0) : undefined;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              title={hint}
              onClick={() => openTab(key)}
              className={`flex shrink-0 items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${tab === key ? 'bg-primary text-primary-foreground shadow-sm' : 'text-foreground/70 hover:bg-accent'}`}
            >
              <Icon className="h-4 w-4" />
              {tabLabel}
              {count ? <span className={`rounded-full px-1.5 text-[11px] font-semibold ${tab === key ? 'bg-primary-foreground/20' : 'bg-accent'}`}>{count}</span> : null}
            </button>
          );
        })}
      </nav>

      {/* 1. Overview: who the company is, how to reach it, what we agreed with it */}
      {tab === 'overview' ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]" data-testid="company-overview">
          <div className="flex flex-col gap-6">
      <EditableTextCard
        testId="company-about"
        title="About the company"
        icon={Info}
        value={company.about}
        placeholder="Where the company operates, the services it offers, how it works with us — anything worth knowing."
        emptyText="Nothing written about this company yet."
        onSave={(about) => updateCompany.mutateAsync({ id: company.id, input: { about } })}
      />

            <AgreedFeeCard company={company} />
          </div>

          <div className="flex flex-col gap-6">
            <Card className="border-t-2 border-t-indigo-500">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Phone className="h-4 w-4 text-foreground/50" /> How to reach them
                </CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="flex flex-col gap-3.5">
                  <div className="flex items-start gap-2.5">
                    <Globe className="mt-0.5 h-4 w-4 shrink-0 text-foreground/40" />
                    <div className="min-w-0">
                      <dt className="text-xs text-foreground/50">Website</dt>
                      <dd className="truncate text-sm">
                        {company.website ? (
                          <a href={company.website} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                            {company.website}
                          </a>
                        ) : (
                          '—'
                        )}
                      </dd>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <Mail className="mt-0.5 h-4 w-4 shrink-0 text-foreground/40" />
                    <div className="min-w-0">
                      <dt className="text-xs text-foreground/50">Email</dt>
                      <dd className="truncate text-sm">
                        {company.email ? (
                          <a href={`mailto:${company.email}`} className="text-primary hover:underline">
                            {company.email}
                          </a>
                        ) : (
                          '—'
                        )}
                      </dd>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <Phone className="mt-0.5 h-4 w-4 shrink-0 text-foreground/40" />
                    <div>
                      <dt className="text-xs text-foreground/50">Phone</dt>
                      <dd className="text-sm">
                        {company.phone ? (
                          <a href={`tel:${company.phone}`} className="text-primary hover:underline">
                            {company.phone}
                          </a>
                        ) : (
                          '—'
                        )}
                      </dd>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-foreground/40" />
                    <div>
                      <dt className="text-xs text-foreground/50">Address</dt>
                      <dd className="text-sm">{[company.address, company.city, company.country].filter(Boolean).join(', ') || '—'}</dd>
                    </div>
                  </div>
                </dl>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <UserCog className="h-4 w-4 text-foreground/50" /> Account
                </CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3.5">
                  <div className="col-span-2">
                    <dt className="text-xs text-foreground/50">Account owner</dt>
                    <dd className="text-sm font-medium">{company.owner ? `${company.owner.firstName} ${company.owner.lastName}` : 'Unassigned'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-foreground/50">Industry</dt>
                    <dd className="text-sm">{company.industry ?? '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-foreground/50">Status</dt>
                    <dd className="text-sm">{company.status.replaceAll('_', ' ')}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-foreground/50">Client since</dt>
                    <dd className="text-sm">{new Date(company.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-foreground/50">Last updated</dt>
                    <dd className="text-sm">{new Date(company.updatedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : null}

      {/* 2. People: the structure, then every contact with all their details */}
      {tab === 'people' ? (
        <div className="flex flex-col gap-6" data-testid="company-people">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Network className="h-4 w-4 text-foreground/50" /> Organisation structure
          </CardTitle>
        </CardHeader>
        <CardContent>
          {structure.length > 0 ? (
            <div className="flex flex-col gap-3" data-testid="company-structure">
              {structure.map(({ group, people }) => (
                <div key={group}>
                  <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-foreground/50">{group}</p>
                  <ul className="flex flex-wrap gap-2">
                    {people.map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => setPerson(c)}
                          className="rounded-md border border-border px-2.5 py-1.5 text-left text-xs hover:border-primary/60 hover:bg-accent"
                          title="Click for details"
                        >
                          <span className="block font-medium">
                            {c.firstName} {c.lastName}
                          </span>
                          <span className="text-foreground/50">{c.jobTitle ?? '—'}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-foreground/50">Add the people you know here (CEO, HR, hiring managers…) in Contacts below — they appear here by seniority.</p>
          )}
        </CardContent>
      </Card>

          <CompanyContacts companyId={company.id} companyName={company.name} />
        </div>
      ) : null}

      {/* 3. Work: the jobs it is hiring for and the people placed there */}
      {tab === 'work' ? <div data-testid="company-work">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <Briefcase className="h-4 w-4 text-foreground/50" />
              Jobs ({jobs?.totalItems ?? 0})
            </CardTitle>
            <Button type="button" size="sm" onClick={() => setAddJobOpen(true)}>
              <Plus className="mr-1 h-3.5 w-3.5" /> Add
            </Button>
          </CardHeader>
          <CardContent>
            {jobs && jobs.items.length > 0 ? (
              <ul className="flex flex-col divide-y divide-border">
                {jobs.items.map((job) => {
                  const applicants = (applications?.items ?? []).filter((a) => a.job.id === job.id).length;
                  const placed = (employees?.items ?? []).filter((e) => e.job.id === job.id).length;
                  return (
                    <li key={job.id} className="flex items-center justify-between py-2 text-sm">
                      <div>
                        <Link href={`/jobs/${job.id}`} className="font-medium hover:underline">
                          {job.title}
                        </Link>
                        <p className="text-xs text-foreground/50">
                          {[job.location ?? 'Location not set', label(job.employmentType), `${applicants} on the pipeline`, `${placed} placed`].join(' · ')}
                        </p>
                      </div>
                      <Badge variant={JOB_STATUS_VARIANT[job.status]}>
                        {job.status.replaceAll('_', ' ')}
                      </Badge>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="py-6 text-center text-sm text-foreground/50">No jobs posted yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <Trophy className="h-4 w-4 text-foreground/50" />
              Employees ({employees?.totalItems ?? 0})
            </CardTitle>
            <Button type="button" size="sm" onClick={() => setAddEmployeeOpen(true)}>
              <Plus className="mr-1 h-3.5 w-3.5" /> Add
            </Button>
          </CardHeader>
          <CardContent>
            {employees && employees.items.length > 0 ? (
              <ul className="flex flex-col divide-y divide-border">
                {employees.items.map((placement) => (
                  <li key={placement.id} className="flex items-center justify-between py-2 text-sm">
                    <div>
                      <Link href={`/candidates/${placement.candidate.id}`} className="font-medium hover:underline">
                        {placement.candidate.firstName} {placement.candidate.lastName}
                      </Link>
                      <p className="text-xs text-foreground/50">
                        <Link href={`/jobs/${placement.job.id}`} className="hover:underline">
                          {placement.job.title}
                        </Link>
                        {' · '}since {new Date(placement.startDate).toLocaleDateString()}
                        {placement.endDate ? ` · until ${new Date(placement.endDate).toLocaleDateString()}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={employmentTypeColour(placement.employmentType)}>{placement.employmentType === 'TEMPORARY' ? 'Temporary' : 'Permanent'}</Badge>
                      <Badge variant={PLACEMENT_STATUS_VARIANT[placement.status]}>{placement.status}</Badge>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-6 text-center text-sm text-foreground/50">
                No one placed here yet — accepted candidates land here automatically once their
                application reaches a &quot;Placed&quot; pipeline stage.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      </div> : null}

      {/* 4. Activity and files: the pipeline, the documents, the numbers on the calling list */}
      {tab === 'activity' ? <div data-testid="company-activity">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <GitBranch className="h-4 w-4 text-foreground/50" /> Pipeline activity ({applications?.totalItems ?? 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pipelineSummary.length > 0 ? (
              <ul className="flex flex-col gap-2 text-sm" data-testid="company-pipeline">
                {pipelineSummary.map(({ stage, count }) => (
                  <li key={`${stage.order}-${stage.name}`} className="flex items-center justify-between">
                    <span>
                      {stage.order}. {stage.name}
                    </span>
                    <Badge variant={stage.type === 'PLACED' ? 'success' : stage.type === 'REJECTED' ? 'destructive' : 'outline'}>{count}</Badge>
                  </li>
                ))}
                <li className="mt-1 border-t border-border pt-2 text-xs text-foreground/50">
                  Latest:{' '}
                  {(applications?.items ?? []).slice(0, 3).map((a, i) => (
                    <span key={a.id}>
                      {i > 0 ? ', ' : ''}
                      <Link href={`/candidates/${a.candidate.id}`} className="hover:underline">
                        {a.candidate.firstName} {a.candidate.lastName}
                      </Link>{' '}
                      <StageStatusBadge application={a} stage={a.pipelineStage} />
                    </span>
                  ))}
                </li>
              </ul>
            ) : (
              <p className="text-sm text-foreground/50">No applicants on this company’s jobs yet.</p>
            )}
          </CardContent>
        </Card>

        <DocumentsCard owner={{ companyId }} />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Phone className="h-4 w-4 text-foreground/50" /> Numbers on the calling list ({phones?.totalItems ?? 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {phones && phones.items.length > 0 ? (
              <ul className="flex flex-col divide-y divide-border text-sm">
                {phones.items.map((p) => (
                  <li key={p.id} className="flex items-center justify-between py-2">
                    <div>
                      <Link href="/phones" className="font-medium tabular-nums hover:underline">
                        {p.normalizedPhone}
                      </Link>
                      <p className="text-xs text-foreground/50">
                        {p.name ?? '—'} · {p.callCount} call{p.callCount === 1 ? '' : 's'}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-foreground/50">No imported numbers matched this company (matched by company name on import).</p>
            )}
          </CardContent>
        </Card>
      </div>

      </div> : null}

      {person ? <PersonDialog person={person} onClose={() => setPerson(null)} /> : null}

      {editOpen ? (
        <Dialog open onOpenChange={setEditOpen} title="Edit company">
          <CompanyForm
            defaultValues={toFormDefaults(company)}
            submitLabel="Save changes"
            onSubmit={async (values) => {
              await updateCompany.mutateAsync({ id: company.id, input: values });
              setEditOpen(false);
            }}
          />
        </Dialog>
      ) : null}

      {addJobOpen ? (
        <Dialog open onOpenChange={setAddJobOpen} title="Add job">
          <JobForm
            defaultValues={{ companyId: company.id }}
            submitLabel="Create job"
            onSubmit={async (values) => {
              await createJob.mutateAsync(values);
              setAddJobOpen(false);
            }}
          />
        </Dialog>
      ) : null}

      {addEmployeeOpen ? (
        <Dialog open onOpenChange={setAddEmployeeOpen} title="Add employee">
          <PlacementForm
            defaultValues={{ companyId: company.id }}
            submitLabel="Record placement"
            onSubmit={handleAddEmployee}
          />
        </Dialog>
      ) : null}
    </div>
  );
}
