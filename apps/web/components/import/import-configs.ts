import { createCandidateSchema, createCompanySchema, createJobSchema } from '@crm/validation';

import { createCandidate } from '@/services/candidates.service';
import { createCompany } from '@/services/companies.service';
import { createJob } from '@/services/jobs.service';
import { listActiveUsers } from '@/services/users.service';

import { formatUkPhone, phoneProblem } from '@/features/candidates/uk-phone';
import { defaultShiftDays } from '@/features/jobs/shift-details';

import { parsers, type ExcelImportConfig } from './excel-import-dialog';

/** The people of the CRM, asked once per import, so a name in an "Added by" column becomes the person's id. */
let usersAsked: Promise<{ id: string; names: string[] }[]> | null = null;
async function userIdByName(name: unknown): Promise<string | undefined> {
  const wanted = String(name ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (!wanted) return undefined;
  usersAsked ??= listActiveUsers()
    .then((users) => users.map((user) => ({ id: user.id, names: [`${user.firstName} ${user.lastName}`, user.email].map((text) => text.trim().toLowerCase().replace(/\s+/g, ' ')) })))
    .catch(() => []);
  return (await usersAsked).find((user) => user.names.includes(wanted))?.id;
}

/** The headers are the ones each table shows (plus the usual alternatives), so a sheet exported from the list imports back. */

export const companyImport: ExcelImportConfig = {
  plural: 'companies',
  fields: [
    { key: 'name', label: 'Name', aliases: ['Company', 'Company name'] },
    { key: 'industry', label: 'Industry', aliases: [] },
    { key: 'email', label: 'Email', aliases: ['E-mail'] },
    { key: 'phone', label: 'Phone', aliases: ['Phone number', 'Telephone'] },
    { key: 'website', label: 'Website', aliases: ['Web'] },
    { key: 'address', label: 'Address', aliases: [] },
    { key: 'city', label: 'City', aliases: [] },
    { key: 'country', label: 'Country', aliases: [] },
    { key: 'status', label: 'Status', aliases: [], parse: parsers.oneOf(['PROSPECT', 'ACTIVE_CLIENT', 'FORMER_CLIENT', 'INACTIVE']) },
    { key: 'about', label: 'About', aliases: ['Description', 'Notes'] },
    // who the company belongs to, by name (as the table's "Added by" column shows it); an unknown name leaves it with the person importing
    { key: 'addedBy', label: 'Added by', aliases: ['Owner', 'Account owner'] },
  ],
  // the template has the columns of the Companies table (Team is worked out by the system, not typed)
  templateKeys: ['name', 'industry', 'email', 'city', 'status', 'addedBy'],
  // the name is what a company is; the rest can be filled in later
  requiredKeys: ['name'],
  completeKeys: ['name', 'industry', 'email', 'city'],
  sample: { name: 'Acme Sh.p.k.', industry: 'Retail', email: 'info@acme.com', phone: '0691234567', website: 'acme.com', city: 'Tirana', country: 'Albania', status: 'Prospect', addedBy: 'Admin Admin' },
  validate: (row) => createCompanySchema.safeParse(row),
  create: async (row) => {
    const { addedBy, ...company } = row as { addedBy?: string };
    const ownerId = await userIdByName(addedBy);
    return createCompany({ ...company, ...(ownerId ? { ownerId } : {}) } as never);
  },
};

export const candidateImport: ExcelImportConfig = {
  plural: 'candidates',
  fields: [
    { key: 'name', label: 'Name', aliases: ['Full name', 'Candidate'] },
    { key: 'firstName', label: 'First name', aliases: ['Firstname'] },
    { key: 'lastName', label: 'Last name', aliases: ['Surname', 'Lastname'] },
    { key: 'jobTitle', label: 'Job Title', aliases: ['Title', 'Position'] },
    // the trades, the main one first, the others after it, separated by commas
    { key: 'trade', label: 'Trades', aliases: ['Trade', 'Profession'] },
    { key: 'currentCompany', label: 'Company', aliases: ['Current company'] },
    { key: 'email', label: 'Email', aliases: ['E-mail'] },
    // a UK mobile, written 07… (a +44 number is turned into 07…); anything else is left out and the row is not added
    {
      key: 'phone',
      label: 'Phone',
      aliases: ['Phone number', 'Telephone', 'Mobile'],
      parse: (cell) => {
        const raw = parsers.text(cell);
        if (!raw) return undefined;
        const formatted = formatUkPhone(raw);
        return phoneProblem(formatted, true) ? undefined : formatted;
      },
    },
    { key: 'location', label: 'Location', aliases: ['City'] },
    { key: 'source', label: 'Source', aliases: [] },
    { key: 'status', label: 'Status', aliases: [], parse: parsers.oneOf(['ACTIVE', 'PASSIVE', 'DO_NOT_CONTACT', 'PLACED', 'ARCHIVED']) },
    // who the candidate belongs to, by name (as the table's "Added by" column shows it); an unknown name leaves it with the person importing
    { key: 'addedBy', label: 'Added by', aliases: ['Owner', 'Recruiter'] },
  ],
  // the same details "Add Candidate" asks for (the CV is added to the profile afterwards): without them the row is not added
  requiredKeys: ['firstName', 'lastName', 'phone', 'location', 'source', 'trade', 'jobTitle'],
  completeKeys: ['firstName', 'lastName', 'phone', 'location', 'source', 'trade', 'jobTitle'],
  templateKeys: ['firstName', 'lastName', 'phone', 'email', 'location', 'jobTitle', 'trade', 'source', 'addedBy'],
  notes: {
    firstName: 'First name only (or use one "Name" column with the full name)',
    lastName: 'Last name',
    phone: 'A UK mobile starting 07, e.g. 07123 456789 (+44 numbers are turned into 07…). A number that is not valid leaves the row out',
    email: 'Optional. A candidate with the same phone or email is not added twice',
    location: 'Town or address, e.g. Leeds',
    jobTitle: 'The job the person does, e.g. Electrician',
    trade: 'The trades, the main one first, separated by commas: Electrician, Plumber',
    source: 'Where the person came from: CV-Library, LinkedIn, Indeed, WhatsApp, Website, Referral, Adzuna …',
    addedBy: 'Optional. The name or email of the recruiter the candidate belongs to; left empty = the person importing',
  },
  sample: { firstName: 'Filan', lastName: 'Fisteku', phone: '07123 456789', email: 'filan@example.com', location: 'Leeds', jobTitle: 'Electrician', trade: 'Electrician, Plumber', source: 'Excel', addedBy: 'Admin Admin' },
  // "Name" is "First Last": the first word is the first name, the rest the last name
  finish: (row) => {
    const { name, ...rest } = row;
    if (typeof name !== 'string' || rest.firstName || rest.lastName) return rest;
    const [first, ...others] = name.trim().split(/\s+/);
    return { ...rest, firstName: first, ...(others.length ? { lastName: others.join(' ') } : {}) };
  },
  validate: (row) => createCandidateSchema.safeParse(row),
  create: async (row) => {
    const { addedBy, ...candidate } = row as { addedBy?: string };
    const ownerId = await userIdByName(addedBy);
    return createCandidate({ ...candidate, ...(ownerId ? { ownerId } : {}) } as never);
  },
};

const TYPES = { permanent: 'PERMANENT', temporary: 'TEMPORARY', contract: 'TEMPORARY', parttime: 'TEMPORARY' };

export const jobImport: ExcelImportConfig = {
  plural: 'jobs',
  fields: [
    { key: 'title', label: 'Job title', aliases: ['Title', 'Position'] },
    { key: 'companyName', label: 'Client', aliases: ['Company', 'Company name'] },
    { key: 'description', label: 'Description', aliases: ['Job description'] },
    { key: 'location', label: 'Location', aliases: ['City'] },
    { key: 'employmentType', label: 'Type', aliases: ['Job type', 'Employment type'], parse: parsers.oneOf(['PERMANENT', 'TEMPORARY'], TYPES) },
    { key: 'candidatesNeeded', label: 'Candidates needed', aliases: ['Candidates', 'Vacancies', 'Positions'], parse: parsers.number },
    { key: 'recruitStartDate', label: 'Find candidates from', aliases: ['Find candidates between', 'Recruit from', 'Start recruiting'], parse: parsers.date },
    { key: 'recruitEndDate', label: 'Find candidates by', aliases: ['Deadline', 'Recruit until'], parse: parsers.date },
    // a Temporary job also needs the days it runs: the work calendar is built from them (Monday to Friday, 08:00-17:00, 1 hour break)
    { key: 'workStart', label: 'Work starts', aliases: ['Work start date', 'Start date'], parse: parsers.date },
    { key: 'workEnd', label: 'Work ends', aliases: ['Work end date', 'End date'], parse: parsers.date },
    { key: 'salaryMin', label: 'Salary min', aliases: ['Min salary'], parse: parsers.number },
    { key: 'salaryMax', label: 'Salary max', aliases: ['Max salary'], parse: parsers.number },
    { key: 'status', label: 'Status', aliases: [], parse: parsers.oneOf(['DRAFT', 'OPEN', 'ON_HOLD', 'CLOSED', 'ARCHIVED']) },
    { key: 'responsibilities', label: 'Responsibilities', aliases: ['Key responsibilities'] },
    { key: 'requirements', label: 'Requirements', aliases: [] },
    // who the job belongs to, by name (as the table's "Added by" column shows it); an unknown name leaves it with the person importing
    { key: 'addedBy', label: 'Added by', aliases: ['Owner', 'Recruiter'] },
  ],
  // the same details "Add Job" asks for: without them the row is not added
  requiredKeys: ['title', 'companyName', 'description', 'location', 'employmentType', 'candidatesNeeded', 'recruitStartDate', 'recruitEndDate'],
  requiredFor: (row) => (row.employmentType === 'TEMPORARY' ? ['workStart', 'workEnd'] : []),
  completeKeys: ['title', 'companyName', 'description', 'location', 'employmentType', 'candidatesNeeded', 'recruitStartDate', 'recruitEndDate'],
  // the columns of the Jobs table (Website, CV Sent, Interview and Placement are worked out by the system), then the work dates
  templateKeys: ['title', 'companyName', 'description', 'location', 'employmentType', 'candidatesNeeded', 'recruitStartDate', 'recruitEndDate', 'workStart', 'workEnd', 'addedBy'],
  requiredNotes: { workStart: 'Required for Temporary jobs', workEnd: 'Required for Temporary jobs', addedBy: 'Optional' },
  notes: {
    title: 'The name of the job, e.g. Warehouse operative',
    companyName: 'The client. A company that is not in the CRM yet is created',
    description: 'What the job is, in a few lines',
    location: 'Where the work is, e.g. Leeds',
    employmentType: 'Permanent or Temporary',
    candidatesNeeded: 'A number: how many people the job needs',
    recruitStartDate: 'The date you start finding candidates (YYYY-MM-DD)',
    recruitEndDate: 'The date you must have found them by (YYYY-MM-DD)',
    workStart: 'Temporary jobs only: the first working day (YYYY-MM-DD). The calendar is Monday to Friday, 08:00-17:00, 1 hour break, London time',
    workEnd: 'Temporary jobs only: the last working day (YYYY-MM-DD)',
    addedBy: 'The name or email of the recruiter the job belongs to; left empty = the person importing',
  },
  sample: {
    title: 'Warehouse operative',
    companyName: 'Acme Sh.p.k.',
    description: 'Picking and packing orders in a warehouse',
    location: 'Leeds',
    employmentType: 'Temporary',
    candidatesNeeded: '4',
    recruitStartDate: '2026-12-01',
    recruitEndDate: '2026-12-31',
    workStart: '2027-01-04',
    workEnd: '2027-03-26',
    status: 'Open',
    addedBy: 'Admin Admin',
  },
  // a Temporary job is saved with its schedule, built the way "Add Job" builds it by default
  finish: (row) => {
    const { workStart, workEnd, employmentType } = row as { workStart?: string; workEnd?: string; employmentType?: string };
    // workStart / workEnd stay in the row (the import checks they are there); they are not sent to the server (see create)
    if (employmentType !== 'TEMPORARY' || !workStart || !workEnd) return row;
    return {
      ...row,
      schedule: {
        startDate: workStart,
        endDate: workEnd,
        timezone: 'Europe/London',
        recurringType: 'WEEKLY',
        workDays: ['mon', 'tue', 'wed', 'thu', 'fri'],
        shiftCount: 1,
        people: { '1': defaultShiftDays(workStart, workEnd) },
      },
    };
  },
  validate: (row) => createJobSchema.safeParse(row),
  create: async (row) => {
    const { addedBy, workStart: _workStart, workEnd: _workEnd, ...job } = row as { addedBy?: string; workStart?: string; workEnd?: string };
    const ownerId = await userIdByName(addedBy);
    return createJob({ ...job, ...(ownerId ? { ownerId } : {}) } as never);
  },
};
