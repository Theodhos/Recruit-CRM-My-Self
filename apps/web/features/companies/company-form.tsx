'use client';

import {
  Button,
  Input,
  QuickField,
  Select,
  quickFieldControlClass,
  quickFieldSelectClass,
} from '@crm/ui';
import { createCompanyWithContactsSchema, type CompanyContactDraft, type CreateCompanyInput } from '@crm/validation';
import { zodResolver } from '@hookform/resolvers/zod';
import { Building2, Globe, Mail, MapPin, Phone, Plus, Tag, Trash2, UserRound } from '@crm/ui/icons';
import { useEffect, useState } from 'react';

import { alertDialog } from '@/components/dialogs/confirm-dialog';
import { AddedByField } from '@/features/users';
import { useFieldArray, useForm } from 'react-hook-form';

const STATUS_OPTIONS = ['PROSPECT', 'ACTIVE_CLIENT', 'FORMER_CLIENT', 'INACTIVE'] as const;
/** Where a company can have come from. */
/** Suggested roles for a contact person; any other can be typed. */
const CONTACT_ROLES = ['HR', 'Manager', 'CEO', 'Director', 'Owner', 'Operations Manager', 'Site Manager', 'Accounts', 'Recruiter'] as const;
type CompanyFormValues = CreateCompanyInput & { contacts?: CompanyContactDraft[] };

export const COMPANY_SOURCES = ['Referral', 'LinkedIn', 'Website', 'Cold call', 'Email campaign', 'Event', 'Existing client', 'Other'] as const;

export interface CompanyFormProps {
  /** The invoicing percentages may arrive as text (the API sends decimals as text). */
  defaultValues?: Partial<Omit<CreateCompanyInput, 'cisDeductionRate' | 'vatRate'>> & { cisDeductionRate?: number | string; vatRate?: number | string };
  /** `contacts`: the people written in the form (Add Company only), created together with the company. */
  onSubmit: (values: CreateCompanyInput, contacts?: CompanyContactDraft[]) => Promise<void>;
  submitLabel: string;
}

export function CompanyForm({ defaultValues, onSubmit, submitLabel }: CompanyFormProps) {
  // Adding a company (no company loaded into the form yet) asks for Company name, Status, Email, Phone, Website, City, Added by and Source
  const isAdd = !defaultValues?.name;
  const mark = (label: string) => (isAdd ? `${label} *` : label);
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting, submitCount },
  } = useForm<CompanyFormValues>({
    // the shape check first, then — when adding — every required field still empty is marked "Required" in the same pass
    resolver: async (values, context, options) => {
      const checked = await zodResolver(createCompanyWithContactsSchema)(values, context, options);
      if (!isAdd) return checked;
      const v = values as Partial<CompanyFormValues>;
      const required: Record<string, { type: string; message: string }> = {};
      for (const name of ['name', 'status', 'email', 'phone', 'website', 'city', 'ownerId', 'source'] as const) {
        if (!String(v[name] ?? '').trim()) required[name] = { type: 'required', message: 'Required' };
      }
      // a contact person that was started needs a first and a last name
      const contactErrors: Record<number, Record<string, { type: string; message: string }>> = {};
      (v.contacts ?? []).forEach((contact, index) => {
        const started = Object.values(contact ?? {}).some((value) => String(value ?? '').trim());
        if (!started) return;
        for (const name of ['firstName', 'lastName'] as const) {
          if (!String(contact?.[name] ?? '').trim()) (contactErrors[index] ??= {})[name] = { type: 'required', message: 'Required' };
        }
      });
      if (Object.keys(contactErrors).length > 0) (required as Record<string, unknown>).contacts = contactErrors;
      if (Object.keys(required).length === 0) return checked;
      return { values: {}, errors: { ...checked.errors, ...required } } as typeof checked;
    },
    defaultValues: defaultValues && {
      ...defaultValues,
      // the API sends decimals as text
      cisDeductionRate: defaultValues.cisDeductionRate === undefined ? undefined : Number(defaultValues.cisDeductionRate),
      vatRate: defaultValues.vatRate === undefined ? undefined : Number(defaultValues.vatRate),
    },
  });
  const { fields: contactFields, append: addContact, remove: removeContact } = useFieldArray({ control, name: 'contacts' });
  // after a refused Create, the first red field is brought into view
  useEffect(() => {
    if (submitCount > 0) document.querySelector('[data-field-error]')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [submitCount]);
  // what the server said when it refused the save — shown here, never thrown as an unhandled error
  const [saveError, setSaveError] = useState<string | null>(null);

  async function submit({ contacts, ...values }: CompanyFormValues) {
    setSaveError(null);
    try {
      // only the people with something written count
      const people = (contacts ?? []).filter((contact) => Object.values(contact ?? {}).some((value) => String(value ?? '').trim()));
      await onSubmit(values, people);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The company could not be saved.';
      setSaveError(message);
      if (/already in the system/i.test(message)) void alertDialog(message, { title: 'Already in the system' });
    }
  }

  return (
    <form className="flex flex-col" onSubmit={handleSubmit(submit)} noValidate>
      <div className="flex flex-col">
        <QuickField icon={Building2} label={mark("Company name")} htmlFor="name" error={errors.name?.message}>
          <Input id="name" className={quickFieldControlClass} {...register('name')} />
        </QuickField>

        <QuickField icon={Tag} label="Industry" htmlFor="industry">
          <Input id="industry" className={quickFieldControlClass} {...register('industry')} />
        </QuickField>

        <QuickField icon={Tag} label={mark("Status")} htmlFor="status" error={errors.status?.message}>
          <Select id="status" className={quickFieldSelectClass} {...register('status')}>
            {isAdd ? <option value="">Choose a status</option> : null}
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {status.replaceAll('_', ' ')}
              </option>
            ))}
          </Select>
        </QuickField>

        <QuickField icon={Mail} label={mark("Email")} htmlFor="email" error={errors.email?.message}>
          <Input id="email" type="email" className={quickFieldControlClass} {...register('email')} />
        </QuickField>

        <QuickField icon={Phone} label={mark("Phone")} htmlFor="phone" error={errors.phone?.message}>
          <Input id="phone" className={quickFieldControlClass} {...register('phone')} />
        </QuickField>

        {isAdd ? (
          <div className="border-b border-border py-3">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-foreground/60">
                <UserRound className="h-3.5 w-3.5 text-foreground/40" /> Contact people (optional)
              </span>
              <Button type="button" variant="outline" size="sm" onClick={() => addContact({ firstName: '', lastName: '', jobTitle: '', email: '', phone: '' })}>
                <Plus className="mr-1 h-3.5 w-3.5" /> Add a contact person
              </Button>
            </div>
            <p className="mt-1 text-xs text-foreground/50">As many people as needed at this company: HR, Manager, CEO... Each one is saved as a contact of the company.</p>
            <datalist id="contact-roles">
              {CONTACT_ROLES.map((role) => (
                <option key={role} value={role} />
              ))}
            </datalist>
            <div className="mt-2 flex flex-col gap-3">
              {contactFields.map((field, index) => {
                const rowErrors = errors.contacts?.[index];
                return (
                  <div key={field.id} className="rounded-md border border-border p-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Input aria-label="Contact first name" placeholder="First name *" {...register(`contacts.${index}.firstName`)} />
                        {rowErrors?.firstName ? <p className="mt-1 text-xs text-destructive">Required</p> : null}
                      </div>
                      <div>
                        <Input aria-label="Contact last name" placeholder="Last name *" {...register(`contacts.${index}.lastName`)} />
                        {rowErrors?.lastName ? <p className="mt-1 text-xs text-destructive">Required</p> : null}
                      </div>
                      <Input aria-label="Contact role" list="contact-roles" placeholder="Role: HR, Manager, CEO..." {...register(`contacts.${index}.jobTitle`)} />
                      <Input aria-label="Contact phone" placeholder="Phone" {...register(`contacts.${index}.phone`)} />
                      <div className="col-span-2">
                        <Input aria-label="Contact email" type="email" placeholder="Email" {...register(`contacts.${index}.email`)} />
                        {rowErrors?.email?.message ? <p className="mt-1 text-xs text-destructive">{String(rowErrors.email.message)}</p> : null}
                      </div>
                    </div>
                    <div className="mt-2 flex justify-end">
                      <Button type="button" variant="ghost" size="sm" onClick={() => removeContact(index)}>
                        <Trash2 className="mr-1 h-3.5 w-3.5" /> Remove
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        <QuickField icon={Globe} label={mark("Website")} htmlFor="website" error={errors.website?.message}>
          <Input id="website" placeholder="https://" className={quickFieldControlClass} {...register('website')} />
        </QuickField>

        <QuickField icon={MapPin} label={mark("City")} htmlFor="city" error={errors.city?.message}>
          <Input id="city" className={quickFieldControlClass} {...register('city')} />
        </QuickField>

        <QuickField icon={MapPin} label="Country" htmlFor="country">
          <Input id="country" className={quickFieldControlClass} {...register('country')} />
        </QuickField>

        <QuickField icon={MapPin} label="Address" htmlFor="address">
          <Input id="address" className={quickFieldControlClass} {...register('address')} />
        </QuickField>
        <AddedByField registration={register('ownerId')} required={isAdd} error={errors.ownerId?.message} />

        <QuickField icon={Tag} label={mark("Source")} htmlFor="source" error={errors.source?.message}>
          <Select id="source" className={quickFieldSelectClass} {...register('source')}>
            <option value="">Where did the company come from?</option>
            {COMPANY_SOURCES.map((source) => (
              <option key={source} value={source}>
                {source}
              </option>
            ))}
          </Select>
        </QuickField>

      </div>

      {saveError ? (
        <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert" data-testid="company-save-error">
          {saveError}
        </p>
      ) : null}

      <div className="sticky bottom-0 -mx-5 mt-2 flex items-center justify-end gap-2 border-t border-border bg-primary px-5 py-3">
        <Button
          type="submit"
          disabled={isSubmitting}
          className="bg-background text-foreground hover:bg-background/90"
        >
          {isSubmitting ? 'Saving…' : submitLabel}
        </Button>
      </div>
    </form>
  );
}
