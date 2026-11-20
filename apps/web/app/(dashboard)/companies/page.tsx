'use client';

import { Button, Drawer, Input, Label, Select } from '@crm/ui';
import type { CompanyContactDraft, CreateCompanyInput } from '@crm/validation';
import { Building2, FileSpreadsheet, Plus, Search } from '@crm/ui/icons';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ExcelImportDialog } from '@/components/import/excel-import-dialog';
import { companyImport } from '@/components/import/import-configs';
import { alertDialog, confirmDialog } from '@/components/dialogs/confirm-dialog';
import { AvailabilityFilter, type Availability } from '@/components/availability-filter';
import { DataTable } from '@/components/tables/data-table';
import { PageBanner } from '@/components/tables/page-banner';
import { SelectionBar, useRowSelection } from '@/components/tables/row-selection';
import { companyColumns, CompanyForm } from '@/features/companies';
import { AddedByFilter } from '@/features/users';
import { useAddedBy } from '@/hooks/use-added-by';
import { useCompanies, useCreateCompany, useDeleteCompany, useUpdateCompany } from '@/hooks/use-companies';
import { toFormDefaults } from '@/lib/form-defaults';
import { createContact } from '@/services/contacts.service';
import { getCompany, type CompanyWithCounts } from '@/services/companies.service';

export default function CompaniesPage() {
  const router = useRouter();
  const [importOpen, setImportOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [name, setName] = useState('');
  const [industry, setIndustry] = useState('');
  const [city, setCity] = useState('');
  const [team, setTeam] = useState<'' | 'WITH' | 'WITHOUT'>('');
  const [ownerId, setOwnerId] = useState('');
  const [availability, setAvailability] = useState<Availability | ''>('');
  const [dialogState, setDialogState] = useState<{
    mode: 'create' | 'edit';
    company?: CompanyWithCounts;
  } | null>(null);

  const { data, isLoading } = useCompanies({ page, pageSize: 25, search: search || undefined, name: name || undefined, industry: industry || undefined, city: city || undefined, team: team || undefined, ownerId: ownerId || undefined, availability: availability || undefined });
  const selection = useRowSelection(data?.items ?? []);
  const addedBy = useAddedBy();
  const createCompany = useCreateCompany();
  const queryClient = useQueryClient();
  const updateCompany = useUpdateCompany();
  const deleteCompany = useDeleteCompany();

  async function handleSubmit(values: CreateCompanyInput, contacts: CompanyContactDraft[] = []) {
    if (dialogState?.mode === 'edit' && dialogState.company) {
      await updateCompany.mutateAsync({ id: dialogState.company.id, input: values });
    } else {
      const created = await createCompany.mutateAsync(values);
      // the people written in the form become contacts of the new company; one that fails does not undo the company
      const failed: string[] = [];
      for (const person of contacts) {
        try {
          await createContact({
            companyId: created.id,
            firstName: person.firstName!.trim(),
            lastName: person.lastName!.trim(),
            jobTitle: person.jobTitle?.trim() || undefined,
            email: person.email?.trim() || undefined,
            phone: person.phone?.trim() || undefined,
            ownerId: values.ownerId,
          });
        } catch (error) {
          failed.push(`${person.firstName} ${person.lastName}: ${error instanceof Error ? error.message : 'not saved'}`);
        }
      }
      if (contacts.length > 0) void queryClient.invalidateQueries({ queryKey: ['contacts'] });
      if (failed.length > 0) void alertDialog(`The company was created, but these contacts were not saved. Add them from the company page:\n${failed.join('\n')}`, { title: 'Some contacts were not saved' });
    }
    setDialogState(null);
  }

  async function handleDelete(company: CompanyWithCounts) {
    if (await confirmDialog(`Delete ${company.name}? Its jobs and their cards on the pipeline are deleted with it. This can't be undone.`)) {
      deleteCompany.mutate(company.id);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageBanner tone="indigo" icon={Building2} title="Companies" description="Manage the client companies you recruit for.">
      <div className="flex shrink-0 items-center gap-2">
        <Button type="button" variant="outline" className="whitespace-nowrap" onClick={() => setImportOpen(true)}>
          <FileSpreadsheet className="mr-1.5 h-4 w-4" />
          Import Excel
        </Button>
        <Button type="button" onClick={() => setDialogState({ mode: 'create' })}>
          <Plus className="mr-1.5 h-4 w-4" />
          Add Company
        </Button>
      </div>
      </PageBanner>

      <div className="flex flex-wrap items-end gap-3">
        <div className="relative max-w-md min-w-72 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />
          <Input
            placeholder="Search name, industry, email, city, status…"
            className="pl-8"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </div>
        {(
          [
            ['Name', name, setName],
            ['Industry', industry, setIndustry],
            ['City', city, setCity],
          ] as const
        ).map(([label, value, set]) => (
          <div key={label} className="flex flex-col gap-1.5">
            <Label htmlFor={`company-${label}`}>{label}</Label>
            <Input
              id={`company-${label}`}
              className="w-40"
              placeholder={label}
              value={value}
              onChange={(event) => {
                set(event.target.value);
                setPage(1);
              }}
            />
          </div>
        ))}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="company-team">Team</Label>
          <Select
            id="company-team"
            className="w-44"
            value={team}
            onChange={(event) => {
              setTeam(event.target.value as '' | 'WITH' | 'WITHOUT');
              setPage(1);
            }}
          >
            <option value="">All</option>
            <option value="WITH">With employees</option>
            <option value="WITHOUT">Without employees</option>
          </Select>
        </div>
        <AvailabilityFilter
          value={availability}
          onChange={(next) => {
            setAvailability(next);
            setPage(1);
          }}
        />
        <AddedByFilter
          value={ownerId}
          onChange={(next) => {
            setOwnerId(next);
            setPage(1);
          }}
        />
      </div>

      {data ? (
        <div className="rounded-lg border border-border px-4 py-2.5" data-testid="results-bar">
          <p className="text-sm" aria-live="polite">
            <strong>{data.totalItems.toLocaleString('en-GB')}</strong> {data.totalItems === 1 ? 'company' : 'companies'}{' '}
            {search || name || industry || city || team || ownerId || availability ? 'match your filters' : 'in total'}.
          </p>
        </div>
      ) : null}

      {data && data.totalItems === 0 && !search && !name && !industry && !city && !team && !ownerId && !availability ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-border bg-background px-6 py-24 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent">
            <Building2 className="h-6 w-6 text-foreground/50" />
          </div>
          <h3 className="mt-4 text-sm font-semibold">No companies yet</h3>
          <p className="mt-1 max-w-sm text-sm text-foreground/50">
            Add your first client company to start posting jobs against it.
          </p>
        </div>
      ) : (
        <DataTable
          tone="indigo"
          columns={companyColumns({
            selection,
            addedBy,
            onEdit: (company) => setDialogState({ mode: 'edit', company }),
            onDelete: handleDelete,
          })}
          data={data?.items ?? []}
          isLoading={isLoading}
          page={data?.page ?? page}
          pageSize={data?.pageSize ?? 25}
          totalItems={data?.totalItems ?? 0}
          totalPages={data?.totalPages ?? 1}
          onPageChange={setPage}
          onRowClick={(company) => router.push(`/companies/${company.id}`)}
          onRowHover={(company) => {
            router.prefetch(`/companies/${company.id}`);
            void queryClient.prefetchQuery({ queryKey: ['companies', 'detail', company.id], queryFn: () => getCompany(company.id), staleTime: 60_000 });
          }}
        />
      )}

      <SelectionBar count={selection.count} noun="companies" onClear={selection.clear} />

      {importOpen ? <ExcelImportDialog config={companyImport} onClose={() => setImportOpen(false)} /> : null}

      {dialogState ? (
        <Drawer
          open
          onOpenChange={(open) => !open && setDialogState(null)}
          title={dialogState.mode === 'edit' ? 'Edit Company' : 'Quick Add Company'}
        >
          <CompanyForm
            defaultValues={dialogState.company ? toFormDefaults(dialogState.company) : undefined}
            submitLabel={dialogState.mode === 'edit' ? 'Save changes' : 'Create company'}
            onSubmit={handleSubmit}
          />
        </Drawer>
      ) : null}
    </div>
  );
}
