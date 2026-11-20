import { z } from 'zod';

import { optionalId } from './optional-id';

export const companyStatusEnum = z.enum([
  'PROSPECT',
  'ACTIVE_CLIENT',
  'FORMER_CLIENT',
  'INACTIVE',
]);

export const companyPipelineStageEnum = z.enum(['NEW', 'IN_CONVERSATION', 'WIN', 'LOST']);

/** "acme.com" and "https://acme.com" are both fine — the server adds the scheme when it is missing. */
const website = z
  .string()
  .max(300)
  .optional()
  .refine(
    (value) => {
      const text = (value ?? '').trim();
      if (text === '') return true;
      try {
        const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `https://${text}`);
        return url.hostname.includes('.');
      } catch {
        return false;
      }
    },
    { message: 'Enter a website like acme.com or https://acme.com' },
  );

export const createCompanySchema = z.object({
  // every field is optional: a company with only some of the details is still created (a missing name reads "Untitled company")
  name: z.string().max(200).optional(),
  industry: z.string().max(150).optional(),
  website,
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().max(30).optional(),
  address: z.string().max(300).optional(),
  city: z.string().max(150).optional(),
  source: z.string().max(100).optional(),
  country: z.string().max(150).optional(),
  status: companyStatusEnum.optional(),
  pipelineStage: companyPipelineStageEnum.optional(),
  doNotContact: z.boolean().optional(),
  cisDeductionRate: z.number().min(0).max(100).optional(),
  vatRate: z.number().min(0).max(100).optional(),
  vatReverseCharge: z.boolean().optional(),
  about: z.string().max(10000).optional(),
  ownerId: optionalId,
});

/** A person at the company, written while the company is added (HR, Manager, CEO…). */
export const companyContactDraftSchema = z.object({
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
  jobTitle: z.string().max(150).optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().max(30).optional(),
});
export type CompanyContactDraft = z.infer<typeof companyContactDraftSchema>;

/** The Add Company form: the company, and any number of people at it. */
export const createCompanyWithContactsSchema = createCompanySchema.extend({ contacts: z.array(companyContactDraftSchema).optional() });

export const updateCompanySchema = createCompanySchema.partial();

export type CreateCompanyInput = z.infer<typeof createCompanySchema>;
export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>;
