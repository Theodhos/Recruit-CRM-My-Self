# DC Solutions CRM — Audit and Implementation Plan

**Phase 1 deliverable. Read-only audit: no code, schema or data was changed.**

- Audit date: 2026-11-05
- Source of truth for requirements: `CRM.docx` (8 areas) plus the payslip template `Master copy - Copy.docx`
- Audited: the working tree on disk (branch `main`, including uncommitted work)
- Not audited: the live database and the live VPS (`/opt/crm`). Reads against production were not permitted in this session, so every statement about data (existing roles, users, rows) describes the code and seed files, not what is in production.

Status labels used throughout:

| Label | Meaning |
|---|---|
| IMPLEMENTED | Exists and the code path was read end to end |
| PARTIAL | Some of it exists; the gaps are listed |
| NOT IMPLEMENTED | Nothing usable exists |
| EXTERNAL | Cannot be finished without an outside system, account or credential |

---

## 1. Summary of the current state

The CRM is a working recruitment ATS: companies, contacts, candidates, jobs, a kanban pipeline, placements, interviews, documents, calendar, notifications and a basic revenue area (fees, retainers). It is multi-tenant, has cookie-based sign-in with optional e-mail OTP, and a permission system.

Against the 8 requested areas:

| # | Area | Status | One-line reason |
|---|---|---|---|
| 1 | Website and job publishing | PARTIAL | Publishing, statuses, expiry and website applications are written but uncommitted, and the careers site is not deployed anywhere |
| 2 | Candidate search, filter, export | PARTIAL | Text search and a few filters exist; 6 of the 10 requested filters have no field, there is no export and no consent data |
| 3 | Dialpad calls and SMS | NOT IMPLEMENTED + EXTERNAL | Telephony today is Twilio browser calling on a separate phone list; no Dialpad, no SMS |
| 4 | Temporary workers weekly payroll | PARTIAL (small slice) | Only a manual, standalone CIS payslip screen; no worker record, timesheets, payroll run, client charge or profit |
| 5 | Temp placements: resourcer billings and commission | NOT IMPLEMENTED | A placement has one owner; no split, no commission rate, no statement |
| 6 | Permanent placements: fees and commission | PARTIAL | Placement and a flat fee amount exist; no salary, fee type, invoice number or commission |
| 7 | Management dashboard | NOT IMPLEMENTED | Dashboard shows operational counts only; no money figures and no period filter |
| 8 | Roles and administrator controls | PARTIAL | Permission system exists, but only an Admin role is ever created, roles cannot be managed, and finance has no permissions |

Two security defects were found that should be fixed before anything else (section 9):

1. **Password verification is switched off in code.** Any password is accepted for any active user.
2. **The local file download route can be made to read outside the tenant's folder.**

---

## 2. Current architecture

### 2.1 Stack

| Layer | Technology | Location |
|---|---|---|
| Monorepo | pnpm workspaces + Turborepo | root |
| API | NestJS 10, Prisma, PostgreSQL, class-validator DTOs | `apps/api` |
| CRM front end | Next.js 14 App Router, React 18, TanStack Query v5, react-hook-form + zod, Tailwind 3 | `apps/web` |
| Public careers site | Plain Node `http` server + HTML templates + jQuery (no framework, no `package.json`) | `apps/careers` (uncommitted) |
| Background worker | BullMQ, 9 processors | `apps/worker` — **all stubs** |
| Realtime | socket.io gateway | `apps/realtime` — connects, never emits |
| Shared packages | `auth`, `config`, `database`, `logger`, `storage`, `types`, `ui`, `utils`, `validation` | `packages/*` |
| Database | PostgreSQL (production is Supabase), 47 models, cuid ids | `packages/database/prisma/schema.prisma` |
| File storage | S3/R2/MinIO (presigned URLs), local disk, Google Drive | `packages/storage` |
| E-mail | SMTP (nodemailer) or Resend, sent inline (not queued) | `apps/api/src/infrastructure/email` |
| Telephony | Twilio Programmable Voice, outbound only | `apps/api/src/infrastructure/telephony` |
| Video | Zoom Server-to-Server OAuth | `apps/api/src/infrastructure/zoom` |

### 2.2 API conventions (to be followed by all new work)

- Global prefix `/api/v1`; Swagger at `/api/v1/docs` outside production.
- Module layout: `modules/<name>/{controller,service,repositories,dto}`.
- Guard chain: `JwtAuthGuard → TenantGuard → RolesGuard → PermissionsGuard → ThrottlerGuard`.
- Success envelope `{ success: true, data, requestId }`; error envelope `{ success: false, error: { code, message, details }, requestId }`.
- Errors thrown as `AppException(code, message, status, details)`.
- Pagination: `page` (default 1), `pageSize` (default 25, max 100) → `{ items, page, pageSize, totalItems, totalPages }`.
- Validation: class-validator DTOs with `whitelist` + `forbidNonWhitelisted`. zod schemas in `packages/validation` are used by the web app only.
- Tenant isolation: `scopedPrisma` injects `organisationId` for 34 models (`packages/database/src/tenant.ts`).
- Owner scope: users without `users:manage` only see records they own, for candidate, company, job, contact, application, placement, calendarEvent, document, applicationStageNote, interview and phone (`packages/database/src/owner-scope.ts`).
- Audit: `AuditLogsService.record({ organisationId, userId, action, entityType, entityId, oldValues, newValues })`.

### 2.3 Front-end conventions

- One fetch module per domain in `apps/web/services`, one hook file per domain in `apps/web/hooks`, feature components in `apps/web/features/<domain>`.
- `lib/api-client.ts`: `fetch` with httpOnly cookies, single-flight refresh on 401.
- UI kit `packages/ui`: badge, button, card, dialog (native `<dialog>`), drawer, input, label, quick-field, search-select, select, textarea. shadcn-style (cva + tailwind-merge), slate theme, light and dark.
- Tables: `components/tables/data-table.tsx` (TanStack Table, server pagination; **no row selection or sorting built in**). The candidates page implements its own selection.
- Charts: recharts v3 (`features/analytics`).
- No toast library; API errors show in a global `ApiErrorBanner`.
- No i18n; UI is English. The only Albanian trace is the route `/pagesat` (labelled "Payments").
- Route protection: `middleware.ts` checks only that a session cookie exists. Page gating is client-side (`components/layout/dashboard-shell.tsx`).

### 2.4 Infrastructure

- Dev: `docker-compose.yml` (postgres, redis, mailhog, minio, api, web, worker, realtime).
- Prod definition in the repo: `docker-compose.prod.yml` with an nginx edge and blue/green api and web.
- CI/CD: `.github/workflows/{ci,deploy,rollback}.yml`. `docs/operations/deployment.md` states these were never actually run.
- **The live VPS differs from the repo.** `/opt/crm` on the server contains a `Caddyfile` and `docker-compose.vps.yml` that do not exist in this repository, has no git history, and builds images on the server. Changes reach production by copying files. The repo and the server can therefore drift.
- `.env.production.example` has no `TWILIO_*`, `ZOOM_*`, `SUPABASE_*`, `PUBLIC_API_URL` or `RESEND_*` entries although the code reads them.

---

## 3. Existing modules

### 3.1 API modules (`apps/api/src/modules`)

| Module | State | Notes |
|---|---|---|
| auth | Working, **critical defect** | Login, refresh, OTP, password reset. Password check disabled (section 9) |
| users | Working | CRUD, temp password, admin limit of 2, permanent delete |
| roles | Read-only | One `GET`; roles cannot be created or edited |
| permissions | Empty stub | — |
| organisations | Working | `settings.payDefaults`, env-based integration status |
| teams | Working | CRUD + members |
| companies | Working | Includes sales pipeline and `pipelineRecord` JSON |
| contacts | Working | — |
| candidates | Working | CRUD, CV parse, Zoom invite, list filters |
| jobs | Working | CRUD, places, website publishing fields (uncommitted) |
| applications | Working | Pipeline moves, stage notes, checklist, auto-placement |
| pipelines, pipeline-stages | Working | Configurable stages |
| public-applications | Working (uncommitted changes) | `GET /public/jobs`, `POST /public/applications` |
| placements | Working, one bug | Search regexes are broken (section 8) |
| fees | Working | Flat amount per placement, status, overview |
| retainers | Working | CRUD + renew |
| renewals | Empty stub | — |
| payslips | Working (uncommitted) | Standalone CIS payslip CRUD |
| interviews, calendar, tasks, activities | Working | `activities` has no UI |
| documents | Working | 25 MB, no MIME check |
| notifications | Working | DB row + e-mail copy; no realtime push |
| phones | Working | Twilio calling list + Excel import |
| analytics, reports | Working | Counts only, no money, no date filter |
| search | Working | Name and e-mail only, no permission check |
| audit-logs | Partial | Writes from 19 services; one unfiltered `GET`; no UI |
| telemetry | Working | — |
| comments, tags, talent-pools, distribution-lists, emails, integrations | Empty stubs | Tables exist, no logic |

### 3.2 CRM pages (`apps/web/app`)

| Sidebar group | Label | Route |
|---|---|---|
| Overview | Dashboard | `/dashboard` |
| CRM | Pipeline Jobs | `/pipeline` |
| CRM | Pipeline Companies | `/pipeline-companies` |
| Lists | Companies | `/companies`, `/companies/[id]` |
| Lists | Candidates | `/candidates`, `/candidates/[id]` |
| Lists | Jobs (Permanent / Temporary) | `/jobs`, `/jobs/[id]` |
| Lists | Active Jobs Temporary | `/active-jobs-temporary` |
| Lists | Completed Jobs | `/completed-contracts` |
| Lists | Active Employees | `/applications` (this page lists **placements**) |
| Lists | Rejected Applicants | `/rejected-applicants` |
| Revenue (admin) | Fees | `/fees` |
| Revenue (admin) | Retainers | `/retainers` |
| Revenue (admin) | Payments | `/pagesat` |
| Administration | My Profile, Notifications, Settings | `/profile`, `/notifications`, `/settings` |
| Not in sidebar | Calendar, Phones, User page | `/calendar`, `/phones`, `/users/[id]` |

Settings contains: my account, change password, organisation, pay and fee defaults, integrations (read-only status), links to users. There is no roles, pipelines or integration-configuration screen.

### 3.3 Uncommitted work in the tree

These are on disk but in no commit. Later phases build on them, so they should be reviewed and committed first.

- `apps/careers/` (whole careers site)
- `apps/api/src/modules/payslips/`, `apps/web/app/(dashboard)/pagesat/`, `apps/web/features/payslips/`, `hooks/use-payslips.ts`, `services/payslips.service.ts`
- `apps/web/components/import/` (Excel import)
- Migrations `20261104120000_payslips`, `20261104140000_job_website_publishing`
- Edits to jobs, applications, public-applications, candidates, companies, schema, types and validation

---

## 4. Requirement-by-requirement mapping

### 4.1 Area 1 — Website and CRM job publishing

Relevant files: `modules/jobs/*`, `modules/public-applications/*`, `modules/applications/service/{applications,candidate-intake}.service.ts`, `apps/careers/*`, `apps/web/features/jobs/{job-form,columns}.tsx`, `apps/web/app/(dashboard)/jobs/*`. Tables: `jobs`, `applications`, `candidates`, `candidate_documents`, `notifications`.

Endpoints: `GET/POST /jobs`, `GET/PATCH/DELETE /jobs/:id` (`job:*`), `GET /public/jobs?organisation=<slug>` (public, 60/min), `POST /public/applications` (public, 10/min, JSON or multipart `cv`).

| ID | Requirement | Status | What works | What is missing or wrong |
|---|---|---|---|---|
| 1.1 | Publish a job to the website | PARTIAL | "Publish on company website" checkbox; job served by `GET /public/jobs`; rendered by `apps/careers` | Careers site is not in any compose file, has no Dockerfile and is not routed. No explicit "Publish" action or indicator in the jobs table |
| 1.2 | Job appears on website vacancies page | EXTERNAL | Works against `apps/careers` locally | It is not confirmed which site is "the company website". See open question Q1 |
| 1.3 | CRM controls title, description, location, salary, type | IMPLEMENTED | All served from the job; `showSalary` hides the range | Fields "required skills", "qualifications", "application instructions" do not exist as separate fields (`requirements` is one free-text block) |
| 1.4 | Edit in CRM updates website | IMPLEMENTED | Site reads live on every page view | Every save of a published job resets `websitePublishedAt` to now (`jobs.repository.ts:17`), so the "published" date changes |
| 1.5 | Unpublish, close, archive | IMPLEMENTED | Any status other than OPEN, or unticking, hides the job; applying returns 400 | — |
| 1.6 | Statuses Draft / Published / On hold / Closed / Archived | IMPLEMENTED | Enum has DRAFT, OPEN, ON_HOLD, CLOSED, ARCHIVED; OPEN is labelled "Published" | Status and "published on website" are two separate switches, which can confuse (OPEN but not on website) |
| 1.7 | Automatic expiry date | PARTIAL | `expiresAt` hides the job from the site once passed | No scheduled job closes it; CRM status stays OPEN |
| 1.8 | Sync status and error recording | NOT IMPLEMENTED | Not needed while the site reads live from the API | Needed only if the website is a separate system (Q1) |
| 1.9 | Website application enters CRM | IMPLEMENTED | `POST /public/applications` creates or reuses the candidate and puts an application on the pipeline | `Application.source` stays `OTHER` instead of `CAREER_SITE` |
| 1.10 | Application linked to the vacancy | IMPLEMENTED | `Application.jobId` set; unique `(candidateId, jobId)` | — |
| 1.11 | CV and contact details saved to candidate | PARTIAL | CV stored, `CandidateDocument` type CV created | Careers proxy drops job title and company; a returning candidate's new phone or location is not saved; a failed CV upload is only logged |
| 1.12 | Assigned to the recruiter who posted the vacancy | PARTIAL | Candidate `ownerId = job.ownerId` | `Application.ownerId` is left null |
| 1.13 | E-mail notification to that recruiter | IMPLEMENTED | Plain-text e-mail to the job owner plus in-app notification | Sent inline; failure is logged and lost. Repeat submissions send again |
| 1.14 | Visible on the recruiter's dashboard | NOT IMPLEMENTED | Only the notification bell | No "new website applications" view |
| 1.15 | No duplicate candidates | PARTIAL | Match by e-mail (case-insensitive) on website intake | No phone match; no unique constraint; manual entry and Excel import do no de-duplication |
| 1.16 | Upload safety | PARTIAL | 5 MB limit, one file, MIME allow-list | Trusts the declared MIME type; no content or extension check |
| 1.17 | Duplicate application protection | PARTIAL | Unique key; duplicate is ignored silently | A REJECTED or WITHDRAWN applicant who re-applies is set back to ACTIVE |
| 1.18 | Anti-spam | PARTIAL | Throttle + honeypot field | Careers server forwards no client IP, so all visitors share one 10/min bucket; public CORS is `*` by default |

### 4.2 Area 2 — Candidate database, extraction and export

Relevant files: `modules/candidates/*`, `apps/web/app/(dashboard)/candidates/page.tsx`, `apps/web/features/candidates/*`, `apps/web/services/candidates.service.ts`, `apps/web/components/import/*`. Tables: `candidates`, `tags`, `candidate_tags`, `talent_pools`.

Endpoint: `GET /candidates` (`candidate:read`) with `search`, `name`, `location`, `phone`, `jobTitle`, `status`, `availability`, owner, company, interested job, recruitment stage. There is no export endpoint.

| ID | Requirement | Status | Notes |
|---|---|---|---|
| 2.1 | Filter by location | IMPLEMENTED | Substring match; also matches postcode |
| 2.2 | Filter by postcode | PARTIAL | Column `postalCode` exists and is searched inside the location filter; no own filter, no form field, no radius search |
| 2.3 | Filter by job title or trade | PARTIAL | Free-text `jobTitle`; no controlled list of trades |
| 2.4 | Filter by previous experience | NOT IMPLEMENTED | No field |
| 2.5 | Filter by skills | NOT IMPLEMENTED | `Tag` / `CandidateTag` tables exist but the tags module is empty |
| 2.6 | Filter by qualifications | NOT IMPLEMENTED | No field |
| 2.7 | Filter by availability | PARTIAL | Derived from status and placement; no "available from" date |
| 2.8 | Filter by employment status | PARTIAL | Only `currentCompany` text and `CandidateStatus` |
| 2.9 | Filter by last contacted date | NOT IMPLEMENTED | No column; calls and e-mails are not rolled up |
| 2.10 | Candidate grade A / B / C | NOT IMPLEMENTED | Only a computed "potential" score |
| 2.11 | Search by name, e-mail, mobile | IMPLEMENTED | ILIKE with no trigram index; will be slow on large data |
| 2.12 | Select individual / all on page | IMPLEMENTED | Used only for "add to pipeline" |
| 2.13 | Select all filtered results | NOT IMPLEMENTED | — |
| 2.14 | Export names, mobiles, e-mails | NOT IMPLEMENTED | — |
| 2.15 | CSV and Excel download | NOT IMPLEMENTED | `xlsx` is installed and used for import only |
| 2.16 | Export only chosen fields | NOT IMPLEMENTED | — |
| 2.17 | Dialpad-compatible export | NOT IMPLEMENTED | — |
| 2.18 | Respect contact preferences, marketing permission, opt-outs | NOT IMPLEMENTED | Only `CandidateStatus.DO_NOT_CONTACT`. No per-channel consent, no opt-out date, no consent checkbox on the website form |

### 4.3 Area 3 — Dialpad integration

Relevant files: `apps/api/src/infrastructure/telephony/twilio-voice.service.ts`, `modules/phones/*`, `apps/web/app/(dashboard)/phones`, `apps/web/features/phones/*`, `modules/integrations/*` (stub), `modules/activities/*`. Tables: `phones`, `phone_calls`, `phone_imports`, `integrations`, `activities`.

A search of the repository for "dialpad" and "sms" returns nothing.

| ID | Requirement | Status | Notes |
|---|---|---|---|
| 3.1 | Connect the existing Dialpad account | DONE (needs the API key) | Settings → Dialpad: API key (encrypted), health check, reconnect, disconnect. OAuth not built: it needs an OAuth app registered with Dialpad |
| 3.2 | Use the existing business number | DONE (needs the number) | Chosen in Settings; texts use it as `from_number`, calls as `outbound_caller_id` |
| 3.3 | Call from a candidate profile | DONE | Communication card → Call rings the recruiter's own Dialpad app (`initiate_call`); needs the web/desktop app open |
| 3.4 | Individual SMS | DONE | Communication card → Text, with templates and placeholders |
| 3.5 | Bulk SMS to selected candidates | DONE, UNVERIFIED LIVE | Sent one text per person through `POST /sms` (documented). Not yet run against the real account |
| 3.6 | Message templates | DONE | Create / edit / delete (`template:manage`), pick when texting |
| 3.7 | Record calls and messages on the candidate | DONE | New `communications` table is the single history |
| 3.8 | Incoming calls and messages matched to candidate | DONE, UNVERIFIED LIVE | Webhook (signed JWT) matches by phone; unknown numbers kept apart. Needs a real event to confirm |
| 3.9 | Date, time and recruiter per communication | DONE | Shown on every history row |
| 3.10 | Secure credential storage and connection status | DONE | AES-256-GCM in `integrations.config`, key derived from SESSION_SECRET (or INTEGRATION_ENCRYPTION_KEY) |
| 3.11 | Webhook validation | DONE (Dialpad) | HS256 signature checked with a per-organisation secret; Twilio check unchanged |

Reusable for Dialpad: the `PhoneCall` status model, the idempotent webhook pattern (`lastEventSeq`), E.164 normalisation (`modules/phones/lib/phone-number.ts`), the integration status card.

### 4.4 Area 4 — Temporary workers weekly payroll

Relevant files: `modules/payslips/*`, `apps/web/app/(dashboard)/pagesat/page.tsx`, `apps/web/features/payslips/*`, `modules/placements/*`, `apps/web/app/(dashboard)/{applications,active-jobs-temporary}`. Tables: `payslips`, `placements`.

A temporary worker today is a `Candidate` with a `Placement` where `employmentType = TEMPORARY` and `status = ACTIVE`. There is no worker record.

Endpoints: `GET/POST /payslips`, `GET /payslips/overview`, `GET/PATCH/DELETE /payslips/:id` (guarded by section `/pagesat`, no permission key).

| ID | Requirement | Status | Notes |
|---|---|---|---|
| 4.1 | Worker details: UTR, NINO, bank, CIS verification, rates, arrangement | NOT IMPLEMENTED | UTR and NINO exist only as free text typed on each payslip. Bank details, CIS status, pay rate and charge rate exist nowhere |
| 4.A | Weekly timesheets (submit, upload, approve, reject, resubmit, history) | NOT IMPLEMENTED | No table, no screen |
| 4.B | Weekly payroll dashboard with filters | NOT IMPLEMENTED | `/pagesat` is a flat list with all-time totals |
| 4.C | Payroll calculation (20 columns of the Excel sheet) | PARTIAL | Only gross = rate × quantity, CIS %, payroll fee, net. Missing: accountant fee, charge rate, total charge, client CIS, invoice, CIS balance, profit, VAT, reverse charge |
| 4.C | Daily, hourly and price-work arrangements | PARTIAL | DAY and HOUR only |
| 4.C | Configurable CIS and VAT | PARTIAL | CIS % is editable per payslip; nothing is tied to HMRC verification; no VAT at all |
| 4.D | Manual adjustments with reason, recalculation | NOT IMPLEMENTED | A payslip can be edited; no bonus or deduction lines, no reason, update audit stores no old values |
| 4.E | Branded PDF payslip, individual | PARTIAL | A branded HTML payslip is printed through the browser's print dialog. Layout matches the template. No server PDF. Branding is hard-coded |
| 4.E | Bulk payslips for a week | NOT IMPLEMENTED | — |
| 4.F | Status workflow (8 statuses) | NOT IMPLEMENTED | Payslips have no status |
| 4.F | Only authorised users approve payroll | NOT IMPLEMENTED | No approval concept, no payroll permission |
| 4.F | Weekly summary (10 totals) | NOT IMPLEMENTED | — |
| 4.F | Excel export for the accountant | NOT IMPLEMENTED | — |

Problems in what exists: money is computed with JavaScript floats; a payslip has no link to a candidate, placement or client; nothing prevents two payslips for the same worker and week; delete is permanent; NINO and UTR are written into the audit log.

### 4.5 Area 5 — Temporary placements: resourcer billings and commission

Relevant files: `modules/placements/*`, `apps/web/features/placements/*`. Table: `placements` (`ownerId` is the only user link).

| ID | Requirement | Status |
|---|---|---|
| 5.A | One or two resourcers per placement with a split that totals 100% | NOT IMPLEMENTED |
| 5.B | Commission % per resourcer, editable by admin | NOT IMPLEMENTED |
| 5.B | Monthly billings, profit, commission earned, paid, outstanding | NOT IMPLEMENTED |
| 5.B | Monthly commission statement per employee | NOT IMPLEMENTED |
| 5.B | Configurable commission basis (profit or another billing figure) | NOT IMPLEMENTED |

Depends on Area 4: there is no billing or profit figure to attribute until payroll lines exist.

### 4.6 Area 6 — Permanent placements: fees, billings, commission

Relevant files: `modules/placements/*`, `modules/fees/*`, `apps/web/app/(dashboard)/fees`, `apps/web/features/{placements,revenue}`. Tables: `placements`, `fees`.

| ID | Requirement | Status | Notes |
|---|---|---|---|
| 6.A | Candidate, client, job title, start date | IMPLEMENTED | On `Placement` |
| 6.A | Placement date, annual salary | NOT IMPLEMENTED | — |
| 6.A | Resourcer and second resourcer | PARTIAL | Single `ownerId` |
| 6.B | Fee type: percentage of salary or fixed | NOT IMPLEMENTED | `Fee.amount` is typed by hand. The only % logic is hourly × hours × days × fee %, a temp-style monthly formula read from pipeline stage notes |
| 6.A | Total client fee calculated | NOT IMPLEMENTED | — |
| 6.A | Invoice date, number, status Draft / Sent / Paid / Overdue | PARTIAL | `Fee.status` has PENDING, INVOICED, PAID, OVERDUE, CANCELLED, `dueDate`, `paidAt`. No invoice number or date, no Draft or Sent |
| 6.C | Commission split and commission payable | NOT IMPLEMENTED | — |
| 6.C | Several placements per vacancy, each with own fee | IMPLEMENTED | Allowed up to `Job.candidatesNeeded`; fees hang off the placement, not the job |
| 6.C | Permanent figures reported separately from temporary | NOT IMPLEMENTED | — |

### 4.7 Area 7 — Management dashboard

Relevant files: `modules/analytics/*`, `modules/reports/*`, `apps/web/app/(dashboard)/dashboard/page.tsx`, `apps/web/features/analytics/*`.

Endpoints: `GET /analytics/dashboard-summary`, `GET /analytics/overview` (`analytics:view`), `GET /reports/overview` (`reports:view`). No date parameters.

| ID | Requirement | Status |
|---|---|---|
| 7.1 | Temporary billings and profit | NOT IMPLEMENTED |
| 7.2 | Permanent billings and profit | NOT IMPLEMENTED |
| 7.3 | Active temporary workers | PARTIAL (active placements counted, not split by type on the dashboard) |
| 7.4 | Active vacancies | IMPLEMENTED (open jobs count) |
| 7.5 | Monthly revenue and profit, temp versus perm | NOT IMPLEMENTED |
| 7.6 | Resourcer performance | PARTIAL (application and conversion counts per owner, no money) |
| 7.7 | Payroll expenditure, outstanding worker payments | NOT IMPLEMENTED |
| 7.8 | Outstanding client invoices | PARTIAL (all-time totals on the Fees page only) |
| 7.9 | Commission payable | NOT IMPLEMENTED |
| 7.10 | Week / month / quarter / year filter | NOT IMPLEMENTED |

Depends on Areas 4, 5 and 6 for its data.

### 4.8 Area 8 — Roles and administrator controls

Relevant files: `packages/auth/*`, `apps/api/src/common/{guards,constants}`, `modules/{roles,permissions,users}`, `packages/database/prisma/seed/*`, `apps/web/components/navigation/nav-config.ts`, `apps/web/components/layout/dashboard-shell.tsx`. Tables: `users`, `roles`, `permissions`, `role_permissions`.

How access works today:

- 46 permission keys: `{candidate, company, contact, job, application, placement, task, document, activity, calendar}:{create, read, update, delete}` plus `reports:view`, `analytics:view`, `settings:manage`, `users:manage`, `notification:read`, `notification:delete`.
- "Admin" means "holds `users:manage`". Everyone else is a member, limited by `User.allowedSections` (a list of sidebar paths) and by owner scope.
- Registration creates only an "Admin" role. Dev fixtures add "Instructor" and "Manager". The roles module cannot create or edit roles.
- At most 2 admins (`MAX_ADMINS = 2`).

| ID | Requirement | Status | Notes |
|---|---|---|---|
| 8.1 | Administrator: full access | IMPLEMENTED | — |
| 8.2 | Account Manager role | NOT IMPLEMENTED | Role does not exist; can be approximated with `allowedSections` |
| 8.3 | Resourcer role (own placements, own commission) | PARTIAL | Owner scope gives "own placements"; no commission data yet |
| 8.4 | Payroll Administrator role | NOT IMPLEMENTED | No payroll permissions; `/pagesat` is gated by section only |
| 8.5 | Marketing role | NOT IMPLEMENTED | No publishing permission separate from `job:update` |
| 8.6 | Resourcers cannot see others' commission | NOT IMPLEMENTED | No commission data |
| 8.7 | Only admins change commission % | NOT IMPLEMENTED | — |
| 8.8 | Only authorised users approve payroll | NOT IMPLEMENTED | — |
| 8.9 | Restricted access to bank details, NINO, UTR | NOT IMPLEMENTED | NINO and UTR are readable by anyone with the Payments section and are copied into audit logs |
| 8.10 | Audit trail for all financial changes | PARTIAL | Fees, retainers, payslips, placements are audited. Stage-note pay changes are not. No "reason" field. No screen to read the log |
| 8.11 | Contact permissions respected | NOT IMPLEMENTED | See 2.18 |

Enforcement gap: `allowedSections` is enforced on the server only for `/fees`, `/retainers` and `/pagesat`. For every other page it only hides the menu item.

---

## 5. Entity relationships: current state and problems

### 5.1 Relationships today

```
Organisation ─┬─ User ── Role ── RolePermission ── Permission
              ├─ Company ─┬─ Contact
              │           ├─ Job ─┬─ Application ── Candidate
              │           │       └─ Placement ── Fee
              │           └─ Retainer ── Renewal
              ├─ Candidate ─┬─ CandidateDocument
              │             ├─ Application ─ ApplicationStageNote (pay terms)
              │             └─ Placement (candidate + job + company, one owner)
              ├─ Payslip            (no relation to anything but the organisation)
              ├─ Phone ── PhoneCall (optional link to Candidate, set only at import)
              └─ AuditLog, Notification, Integration, Activity, Task, Document
```

### 5.2 Data duplication and architectural problems

| # | Problem | Evidence | Effect on the requested work |
|---|---|---|---|
| D1 | Pay terms live in three places | `ApplicationStageNote` (hourlyRate, feePercent), `Company.pipelineRecord.pay` (JSON), `Organisation.settings.payDefaults` | Payroll needs one authoritative pay rate and charge rate per placement. Fees currently pick "the newest stage note with a rate" |
| D2 | Calculations duplicated | Fee and pay maths in API stage notes, fees service, two web dialogs; payslip maths on server and client | Any payroll engine must be the single source; clients should only display |
| D3 | Payslip is detached | `Payslip` has only `organisationId`; name, NINO, UTR re-typed weekly | Blocks payroll, profit and commission. No unique (worker, week) |
| D4 | Money computed with floats | `Number()` + `Math.round` in payslips, fees, retainers, stage notes; overviews load all rows into memory | Rounding drift; must move to decimal arithmetic and DB aggregates |
| D5 | Conflicting currency defaults | Payslip defaults GBP; Fee, Retainer, Job, StageNote, payDefaults default USD | A UK business will see USD defaults on new records |
| D6 | Fee is not an invoice | No number, date, Draft or Sent; one fee per placement, deleted with the placement (`onDelete: Cascade`) | Temp work needs weekly client invoices covering many workers; deleting a placement erases revenue history |
| D7 | Two phone stores | `Candidate.phone` (free text) and `Phone.normalizedPhone` (E.164, unique) are unrelated | SMS and inbound matching need one normalised number per candidate |
| D8 | Candidate de-duplication is weak | Non-unique index on `(organisationId, email)`; only website intake matches by e-mail | Excel import and manual entry create duplicates |
| D9 | One owner per placement | `Placement.ownerId` | Cannot express a two-resourcer split |
| D10 | Communication history is fragmented | `Activity` (unused by UI), `PhoneCall` (per phone), `EmailThread` (unused), `Comment` (stub) | The candidate timeline has no single source |
| D11 | Integration credentials have no home | `Integration.config` is plain JSON and unused; everything is read from env | Dialpad needs encrypted per-organisation credentials |
| D12 | "Active Employees" route is `/applications` | The page lists placements | Naming is misleading for future work; do not add a second placements page |
| D13 | Owner is inferred | The owner is "the oldest user with `users:manage`" | The second admin can demote or deactivate the owner |
| D14 | Worker, queue and realtime are stubs | 9 processors log "not yet implemented"; no `queue.add` anywhere | Bulk SMS, bulk PDFs, exports and e-mail retries need a real queue |

---

## 6. Modules: missing, and requiring modification

### 6.1 Extend (do not duplicate)

| Existing module | Extension needed | For area |
|---|---|---|
| jobs | Publish action and indicator, skills / qualifications / instructions fields, expiry job, keep `websitePublishedAt` stable | 1 |
| public-applications | Source = CAREER_SITE, application owner, update returning candidate, file content check, consent capture, real client IP | 1, 2 |
| candidates | New searchable fields, filters, select-all-filtered, export, consent | 2 |
| tags | Implement the stub and use it for skills | 2 |
| placements | Rates and arrangement (temp), salary and fee terms (perm), resourcer split, fix search regexes | 4, 5, 6 |
| payslips | Link to worker, placement and payroll line; status; server PDF; stop permanent delete | 4 |
| fees | Decide its relation to invoices (Q5) | 6 |
| phones / telephony | Provider abstraction so Dialpad sits beside Twilio; link calls to candidates | 3 |
| integrations | Implement the stub with encrypted config | 3 |
| activities | Become the candidate communication timeline | 3 |
| analytics / reports + dashboard page | Financial KPIs and period filter | 7 |
| roles / permissions | Role management, new permission keys, seeded DC Solutions roles | 8 |
| audit-logs | `reason`, filters, UI, redaction of sensitive fields | 8 |
| organisations settings | Payroll, CIS, VAT and commission defaults | 4, 5 |
| apps/worker | Real processors for e-mail, SMS, PDF, export, job expiry | 1–4 |

### 6.2 New modules (nothing equivalent exists)

| New module | Purpose | For area |
|---|---|---|
| worker-profiles | UTR, NINO, bank details, CIS verification, one per candidate | 4 |
| timesheets | Weekly timesheets, entries, approval history | 4 |
| payroll | Payroll week, payroll lines, adjustments, calculation engine, summary, export | 4 |
| invoices | Client invoices, lines, payments | 4, 6 |
| commissions | Rates with history, entries per placement, monthly statements, payouts | 5, 6 |
| messaging (SMS) | Messages, templates, bulk batches, delivery status, inbound | 3 |
| exports | Candidate export jobs with field selection and consent filter | 2 |

---

## 7. Database changes required

Proposals only. Nothing has been applied. All changes are additive (new nullable columns, new tables); no existing column is dropped or retyped.

### 7.1 Extend existing tables

| Table | Add |
|---|---|
| `jobs` | `skills`, `qualifications`, `applicationInstructions` (text); `websiteSyncStatus`, `websiteSyncError`, `websiteSyncedAt` only if the website is a separate system |
| `candidates` | `normalizedPhone`, `grade` (A/B/C), `employmentStatus`, `availableFrom`, `experienceYears`, `experienceSummary`, `qualifications`, `lastContactedAt`, consent fields (`smsConsent`, `emailConsent`, `callConsent`, `marketingConsent`, each with `…At` and source), `optedOutAt` |
| `placements` | `placedAt`; temp: `payRate`, `chargeRate`, `rateUnit` (DAY/HOUR/PRICE_WORK), `payrollFee`, `accountantFee`, VAT treatment; perm: `annualSalary`, `feeType` (PERCENTAGE/FIXED), `feePercent`, `fixedFee`, `clientFee` |
| `companies` | `vatTreatment`, `vatRate`, `reverseCharge`, `cisDeductsFromAgency`, `paymentTermDays`, `invoiceEmail` |
| `payslips` | `candidateId`, `placementId`, `payrollLineId`, `status`, `issuedAt`, `pdfDocumentId`, `deletedAt` |
| `fees` | `invoiceId` (if Q5 option A) |
| `phone_calls` | `candidateId`, provider-neutral fields |
| `audit_logs` | `reason`, `ipAddress` |
| `users` | `isOwner` flag |
| `applications` | no new column; set `source` and `ownerId` correctly |

### 7.2 New tables

| Table | Key columns | Constraints |
|---|---|---|
| `worker_profiles` | candidateId, utr, nino, bank fields (encrypted), cisStatus, cisRate, cisVerifiedAt, cisVerificationRef | unique (candidateId) |
| `timesheets` | placementId, candidateId, companyId, weekStart, status, submittedBy, clientConfirmedBy, documentId | unique (placementId, weekStart) |
| `timesheet_entries` | timesheetId, workDate, units | unique (timesheetId, workDate) |
| `timesheet_events` | timesheetId, action, userId, note, createdAt | append-only |
| `payroll_weeks` | weekStart, status, approvedBy, approvedAt, authorisedBy | unique (organisationId, weekStart) |
| `payroll_lines` | payrollWeekId, placementId, candidateId, companyId, timesheetId, every calculated column, a snapshot of the rates and rules used, status | unique (payrollWeekId, placementId) |
| `payroll_adjustments` | payrollLineId, type, amount, reason, userId | reason required |
| `invoices` | companyId, number, issueDate, dueDate, status, net, vat, total, amountPaid | unique (organisationId, number) |
| `invoice_lines` | invoiceId, placementId, payrollLineId or feeId, description, amount | — |
| `invoice_payments` | invoiceId, paidAt, amount, reference | — |
| `placement_resourcers` | placementId, userId, splitPercent | unique (placementId, userId); max 2 rows; total 100 enforced in the service and by a deferred check |
| `commission_rates` | userId, type (TEMP/PERM), percent, basis, effectiveFrom, effectiveTo | no overlapping periods per user and type |
| `commission_entries` | userId, placementId, source line, period, basisAmount, splitPercent, ratePercent, amount, status | unique per (user, source line) |
| `commission_statements` | userId, month, totals, paid, outstanding | unique (userId, month) |
| `sms_templates` | name, body, createdBy | unique (organisationId, name) |
| `messages` | candidateId, direction, channel, body, fromNumber, toNumber, provider, providerMessageId, status, userId, jobId, batchId | unique (provider, providerMessageId) |
| `message_batches` | templateId, createdBy, recipient counts, status | — |
| `export_jobs` | userId, filters, fields, format, row count, status, fileKey | — |

### 7.3 Rules for money and identifiers

- Money: `Decimal(12,2)`; rates and percentages `Decimal(7,4)`. All arithmetic with a decimal library on the server. No floats.
- Every payroll line and commission entry stores the inputs it was calculated from, so history does not change when a rate changes later.
- Default currency GBP for this organisation.
- Indexes: `candidates(organisationId, normalizedPhone)`, trigram indexes for name, job title and location search, `candidates(organisationId, grade)`, `(organisationId, lastContactedAt)`, payroll and invoice lookups by week, company and status.
- Candidate de-duplication: unique partial index on `(organisationId, lower(email))` where not deleted. Existing duplicates must be listed and merged by hand first (Q6).

---

## 8. API changes required

All new endpoints follow section 2.2.

| Area | Endpoints to add or change |
|---|---|
| 1 | `POST /jobs/:id/publish`, `POST /jobs/:id/unpublish`; website filter on `GET /jobs`; `GET /applications?source=CAREER_SITE&mine=true`; scheduled expiry |
| 2 | New filters on `GET /candidates`; `POST /candidates/selection/count`; `POST /candidates/export` (fields, format, filters or ids, channel) returning a job; `GET /exports/:id` |
| 3 | `GET/PUT /integrations/dialpad`; `POST /candidates/:id/call`; `POST /candidates/:id/sms`; `POST /messages/bulk`; `GET /candidates/:id/communications`; `CRUD /sms-templates`; `POST /webhooks/dialpad` (public, signature verified) |
| 4 | `CRUD /worker-profiles`; `CRUD /timesheets` + `submit / approve / reject`; `GET /payroll/weeks/:weekStart`; `POST …/generate`, `…/recalculate`, `…/approve`, `…/authorise`, `…/mark-paid`; `POST /payroll/lines/:id/adjustments`; `GET …/summary`; `GET …/export.xlsx`; `POST /payslips/generate` (one or bulk), `GET /payslips/:id/pdf` |
| 5, 6 | `PUT /placements/:id/resourcers`; `CRUD /commission-rates`; `GET /commissions/statements`; `POST /commissions/statements/:id/payouts`; permanent fee fields on placements; `CRUD /invoices` + payments |
| 7 | `GET /analytics/management?period=&from=&to=` and report endpoints, all aggregated in SQL |
| 8 | `CRUD /roles` with permission assignment; `GET /audit-logs` with filters |

Fixes to existing endpoints: `placements.repository.ts:61-75` (regexes missing backslashes, e.g. `/^(d{4})$/` and `/s+/`); permission keys for fees, retainers, payslips and roles; `GET /search` permission.

---

## 9. Security considerations

### 9.1 Defects found (fix first, needs approval)

| # | Severity | Finding | Location |
|---|---|---|---|
| S1 | Critical | `const PASSWORD_CHECK_DISABLED = true` — any password signs in to any active account. Present since the first commit, so it is almost certainly live | `apps/api/src/modules/auth/service/auth.service.ts:86` |
| S2 | Critical on local storage | Download route builds a file path from a user-supplied key with only a prefix check; `..` segments are not rejected | `apps/api/src/infrastructure/storage/storage.controller.ts:46-67` |
| S3 | High | Download route ignores owner scope: any member with `document:read` can fetch any file in the organisation if they have its key | same file |
| S4 | High | Second admin can reset the owner's password, demote or deactivate them; admin limit can be passed by re-activating a deactivated admin | `modules/users/service/users.service.ts` |
| S5 | High | Registering a new organisation with an existing user's e-mail locks that user out of sign-in | `auth.service.ts:76` + public register |
| S6 | High | Refresh tokens are never rotated or revoked; logout only clears cookies | `modules/auth` |
| S7 | Medium | Fees, retainers, payslips and roles have no permission key | their controllers |
| S8 | Medium | Owner scope does not cover activities, tasks, comments or revenue models | `packages/database/src/owner-scope.ts` |
| S9 | Medium | Document upload has no MIME allow-list; `.docx` preview HTML is served from the API origin | `modules/documents` |
| S10 | Medium | Twilio webhook is unauthenticated when `TWILIO_AUTH_TOKEN` is unset | `twilio-voice.service.ts:59-64` |
| S11 | Medium | Public CORS defaults to `*`; careers proxy hides client IPs from the throttle | `main.ts:53`, `apps/careers/serve.mjs` |
| S12 | Medium | NINO and UTR are stored in plain text and copied into audit logs | `modules/payslips` |

S1 means the shared password requested for the five new users gives no protection until it is fixed.

### 9.2 Requirements for the new work

- Encrypt bank details, NINO and UTR at field level; mask them in API responses unless the caller holds a dedicated permission; never write them to audit logs.
- Enforce every new permission on the server. New keys: `payroll:{read,manage,approve,authorise}`, `timesheet:{read,manage,approve}`, `worker:{read,manage,read_sensitive}`, `invoice:{read,manage}`, `commission:{read_own,read_all,manage}`, `sms:{send,bulk_send}`, `candidate:export`, `job:publish`, `integration:manage`, `finance:view`.
- Commission queries filter by the caller's user id unless `commission:read_all`.
- Consent is checked on the server at export and at send time, per channel. Selection in the browser is never trusted.
- Integration secrets stored encrypted, never returned to the browser.
- Webhooks verified by signature and made idempotent by provider event id.
- Payroll lines are locked after approval; changes require an adjustment with a reason.
- UK GDPR: export logs who exported what; payslip and CV downloads go through authorised routes.

---

## 10. External integrations required

| Integration | Needed for | What must be supplied |
|---|---|---|
| Company website | Area 1 | Which site is it, who hosts it, and how it should show jobs (Q1) |
| Dialpad API | Area 3 | API key or OAuth app on the company account, the office / user and number to send from, confirmation that the plan allows API SMS and webhooks, a public HTTPS URL for webhooks |
| E-mail | Areas 1, 4 | Confirm the production SMTP or Resend account |
| HMRC CIS verification | Area 4 | No API integration is proposed. Verification status and rate are entered by the administrator from HMRC's own service |
| Accountant | Area 4 | A sample of the current weekly Excel sheet to match columns and check figures |
| Payments | Area 4 | None. "Paid" is a status set by a person; the CRM will not move money |

---

## 11. Dependencies between modules

```
Security fixes (S1–S6)
        │
Foundation: roles + permissions, audit reason, decimal money,
            integration secrets, real worker queue
        │
        ├── Area 1 Website publishing ──────────────┐
        ├── Area 2 Candidate fields + consent ──┐    │
        │                                       ├── Area 3 Dialpad (needs consent + selection)
        │                                       │
        ├── Worker profile + placement rates ── Timesheets ── Payroll ── Payslip PDF
        │                                                        │
        │                                             Invoices ──┤
        │                                                        │
        ├── Placement resourcer split ── Commission (temp needs payroll profit,
        │                                             perm needs client fee)
        │
        └── Management dashboard (needs payroll, invoices, fees, commission)
                │
        Final permissions pass + QA
```

---

## 12. Recommended implementation order

The order follows the phases already defined, with one step added at the front.

| Step | Phase | Scope | Blocked by |
|---|---|---|---|
| 0 | — | Commit the uncommitted work; fix S1 and S2; confirm repo and VPS match | Approval |
| 1 | Phase 2 | Schema and backend foundation (section 7), permissions, audit reason, decimal helpers, queue | Q4, Q5, Q6 |
| 2 | Phase 3 | Website publishing and applications | Q1 |
| 3 | Phase 4 | Candidate filters, selection, export, consent | Q2 |
| 4 | Phase 5 | Dialpad | Q3; real sending cannot be tested without credentials |
| 5 | Phase 6 | Temporary workers and weekly payroll | Q7 |
| 6 | Phase 7 | Temporary placement commission (Area 5). **No Phase 7 brief was received**; scope taken from `CRM.docx` section 5 | Step 5 |
| 7 | Phase 8 | Permanent placements, fees, commission | Q5 |
| 8 | Phase 9 | Management dashboard | Steps 5–7 |
| 9 | Phase 10 | Roles, security pass, regression and workflow testing, final report | All |

Database migrations will be written and tested locally first. Applying them to the production database is a separate step that needs explicit approval each time.

---

## 13. Open questions

| # | Question | Why it matters |
|---|---|---|
| Q1 | Is "the company website" the `apps/careers` site in this repo, or an existing site (for example WordPress)? What is its address? | Decides whether jobs are read live from the CRM or pushed to another system with sync status |
| Q2 | Is there a record of which existing candidates agreed to SMS or marketing? If not, what should the default be for existing candidates? | Legally, the safe default is "no consent recorded", which would exclude all existing candidates from bulk SMS |
| Q3 | Can Dialpad API credentials be provided, and does the plan include SMS through the API? | Without them only the architecture and settings screen can be built |
| Q4 | Which production roles and users exist today? | Could not be read. Needed before seeding the five new roles |
| Q5 | Invoices: (A) add an `invoices` table and link existing `fees` to it, or (B) extend `fees` into the invoice record? | A is recommended: temp invoices cover many workers per week, which `fees` (one placement each) cannot represent |
| Q6 | May duplicate candidates be merged before a unique e-mail rule is added? | The rule cannot be added while duplicates exist |
| Q7 | Please supply one real weekly payroll spreadsheet (figures can be anonymised) | Needed to confirm the formulas for CIS client, CIS balance, profit and VAT |
| Q8 | Should the five pending user accounts wait until S1 is fixed and roles exist? | Their role assignment depends on Area 8 |

---

## 14. Requirement checklist

Legend: ☑ implemented · ◐ partial · ☐ not implemented · ⧉ external dependency

**1. Website and job publishing**
- ◐ 1.1 Publish option per job ⧉
- ⧉ 1.2 Appears on website vacancies page
- ☑ 1.3 CRM controls displayed details
- ☑ 1.4 Edit updates website (date bug)
- ☑ 1.5 Unpublish / close / archive
- ☑ 1.6 Five statuses
- ◐ 1.7 Automatic expiry
- ☑ 1.9 Application enters CRM
- ☑ 1.10 Linked to vacancy
- ◐ 1.11 CV and contact saved
- ◐ 1.12 Assigned to posting recruiter
- ☑ 1.13 E-mail to recruiter
- ☐ 1.14 Shown on recruiter dashboard
- ◐ 1.15 No duplicate candidates

**2. Candidate extraction**
- ☑ Location · ◐ Postcode · ◐ Job title / trade · ☐ Experience · ☐ Skills · ☐ Qualifications · ◐ Availability · ◐ Employment status · ☐ Last contacted · ☐ Grade
- ☑ Select individual / page · ☐ Select all filtered
- ☐ Export names, mobiles, e-mails · ☐ CSV / Excel · ☐ Chosen fields · ☐ Dialpad format
- ☐ Respect preferences and opt-outs

**3. Dialpad**
- ☐ ⧉ Connect account · ⧉ Existing number · ◐ Call from profile · ☐ Individual SMS · ☐ Bulk SMS · ☐ Templates · ◐ Record on candidate · ☐ Incoming matched · ◐ Date, time, recruiter

**4. Weekly payroll**
- ☐ Worker details · ☐ Timesheets · ☐ Approval history · ☐ Payroll dashboard · ◐ Calculations · ◐ Arrangements · ◐ CIS / ☐ VAT · ☐ Adjustments · ◐ Payslip · ☐ Bulk payslips · ☐ Statuses · ☐ Weekly summary · ☐ Excel export

**5. Temp commission**
- ☐ Resourcer allocation and split · ☐ Commission % · ☐ Monthly calculation · ☐ Statement · ☐ Configurable basis

**6. Permanent placements**
- ◐ Placement record · ☐ Salary and fee type · ☐ Calculated fee · ◐ Invoice tracking · ☐ Commission · ☑ Several placements per vacancy · ☐ Separate reporting

**7. Management dashboard**
- ☐ Temp billings / profit · ☐ Perm billings / profit · ◐ Active temp workers · ☑ Active vacancies · ☐ Financial reports · ☐ Period filter

**8. Permissions**
- ☑ Administrator · ☐ Account Manager · ◐ Resourcer · ☐ Payroll Administrator · ☐ Marketing · ☐ Commission privacy · ☐ Payroll approval control · ☐ Sensitive data restriction · ◐ Financial audit trail · ☐ Contact permissions

---

## 15. Phase log

| Phase | Status | Notes |
|---|---|---|
| 1 — Audit | Complete | This document |
| Step 0 — security hotfixes | Done in code, **not deployed** | S1 password check restored; S2/S3 download path escape closed; placement search regexes fixed |
| Website and job publishing (the phase sent as "Phase 1 – Website & CRM Job Publishing") | Done in code and tested locally, **not deployed** | Section 16 |
| Remaining phases | Not started | |

---

## 16. Website and job publishing — implementation report

Tested on 2026-11-05 against an isolated local PostgreSQL (all 23 migrations applied to an empty database, then seeded), a separate API instance and an SMTP sink. **Nothing was applied to the production database or the VPS.**

### 16.1 What was built

| Requirement | Result |
|---|---|
| Publish / Unpublish / Close / Archive actions | `POST /jobs/:id/{publish,unpublish,close,archive}` (permission `job:update`, each audited). Buttons on the job page; Close and Archive ask for confirmation |
| Publication indicator | "On website / Expired / Not on website" badge on the job page and a new **Website** column in the Jobs table |
| Statuses Draft, Published, On hold, Closed, Archived | Already existed ("Published" = status OPEN). Close and Archive now stamp `closedAt`; re-opening clears it |
| Editing a published job updates the website | Website reads the CRM live, so edits show at once. **Fixed:** saving a published job no longer resets its "published" date |
| Only published, active vacancies are public | Rule unchanged: OPEN + switched on + not past expiry. Publish is refused (422) if title or description is missing or the expiry date has passed |
| Automatic expiry | The website hides an expired vacancy immediately; a new job (every 10 minutes, one replica at a time) now also sets it to Closed, off the website, with an `EXPIRE_JOB` audit entry |
| Skills, qualifications, how to apply | Three new job fields: form, job page, API, public list and the careers pages |
| Website application → CRM | Existing flow kept. Now `Application.source = CAREER_SITE` and the application is owned by the recruiter who posted the vacancy |
| Candidate de-duplication | Matches on normalised e-mail **or normalised phone** (`+44 7700 900123`, `0044…`, `07700 900123` are one number). Existing details are never overwritten from the public form; missing phone or location is filled in |
| Repeat submissions | Same person, same vacancy: one application, no second e-mail, no second alert. A rejected or withdrawn applicant who re-applies is **not** put back on the pipeline |
| CV upload safety | Declared type, file extension and the file's first bytes must all agree (PDF, DOC, DOCX). Disguised executables and HTML are rejected. 5 MB limit unchanged. A failed CV save is now written to the audit log |
| Recruiter notification | E-mail to the vacancy owner (once per application) plus the existing in-app notifications |
| Recruiter dashboard | New "Website applications" card on the dashboard (own vacancies for a recruiter, all for an admin) and a `source` filter on `GET /applications` |
| Careers site | Shows skills, qualifications and how to apply; list page shows the real published date; forwards the visitor's address so the rate limit is per visitor, not shared by everyone |
| Publishing errors | Every publish, unpublish, close, archive, expiry and CV failure is in the audit log. There is no separate sync step to fail: the website reads the CRM directly |

### 16.2 Files

**Created:** `apps/api/src/common/utils/phone.ts` (+ spec), `apps/api/src/modules/jobs/service/job-expiry.service.ts` (+ spec), `apps/api/src/modules/jobs/service/jobs.service.publication.spec.ts`, `apps/api/src/modules/public-applications/lib/cv-file.ts` (+ spec), `apps/web/features/jobs/website-state.ts`, `apps/web/features/applications/website-applications-card.tsx`, migration `20261105120000_job_skills_candidate_phone_dedup`.

**Modified (this work):** `auth.service.ts`, `storage.controller.ts`, `placements.repository.ts`, `jobs.{controller,service,repository,module}`, `create-job.dto.ts`, `public-applications.{controller,service,spec}`, `applications.{service,repository}`, `list-applications-query.dto.ts`, `candidates.repository.ts`, `schema.prisma`, `job.schema.ts`, `types/entities/job.ts`, `apps/careers/serve.mjs`, web: `job-form.tsx`, `columns.tsx`, `jobs/[id]/page.tsx`, `dashboard/page.tsx`, `jobs.service.ts`, `use-jobs.ts`, `applications.service.ts`, `features/applications/index.ts`.

### 16.3 Database migration `20261105120000_job_skills_candidate_phone_dedup`

Additive only; nothing dropped or retyped.

- `jobs`: `skills`, `qualifications`, `applicationInstructions` (all optional text)
- `candidates`: `normalizedPhone` (optional text), filled for existing rows by the migration with the same rules the code uses, plus index `(organisationId, normalizedPhone)`

### 16.4 API

| Endpoint | Notes |
|---|---|
| `POST /jobs/:id/publish` · `/unpublish` · `/close` · `/archive` | New. 422 `JOB_NOT_PUBLISHABLE` when publishing without title / description / with a past expiry |
| `GET /applications?source=CAREER_SITE` | New filter |
| `GET /public/jobs` | Adds `skills`, `qualifications`, `applicationInstructions` |
| `POST /public/applications` | Stricter CV check; phone matching; no repeat e-mails |

### 16.5 Tests

- **Unit (jest):** API suite 13 suites, 101 passed, 24 skipped (those 24 are in suites I did not touch); database package 14 passed. New: phone normalisation, CV content check, publication rules, expiry sweep, website application matching.
- **End to end against a real API + database + SMTP sink: 53 of 53 checks passed.** Covered: wrong password refused; create, publish, edit, unpublish, close, archive; salary hiding; no internal fields on the public list; application with CV; one profile, one application, correct owner and source; e-mail received by the recruiter exactly once; duplicate by e-mail, by phone in another format, repeat submission, second vacancy (one profile, two applications), rejected applicant re-applying; disguised executable, HTML, oversize file, honeypot, invalid e-mail; expiry hides the job and publish is refused; audit entries; download route refuses `../`, other organisation and absolute paths.
- **Expiry sweep** run against the database: closed the expired vacancy once, 0 the second time.
- **Type-check:** API and web clean. **Lint:** no new errors (one pre-existing `bcrypt` import error in `auth.service.ts`).

### 16.6 Not verified

- **The live website and production.** Nothing was deployed. Tested against the local careers code only, not against `https://crm.example.com/jobs`.
- **Real e-mail delivery.** Verified into an SMTP sink; production uses SMTP with the company's own settings, which were not exercised.
- **Browser UI.** The Chrome extension was not connected, so the new buttons, badges, form fields and dashboard card were checked by type-check and API behaviour, not by looking at them.
- **Placement search fix** returns 200 for dates and multi-word searches, but the test database had no placements, so matching itself was not exercised.

### 16.7 Needed before this goes live

1. Approval to run migration `20261105120000_job_skills_candidate_phone_dedup` on the production database (additive, back-up first).
2. Decision on the password-check fix: it has been disabled since 2026-10-01, so people may not know their real passwords. Restoring it will refuse every wrong password, including ones that work today. Plan a password reset for the users, or set known passwords first.
3. Deploy the new API, web and `apps/careers` (the VPS copy in `/opt/careers` is a separate, older file).

### 16.8 Known limits

- The pipeline still reads status from the stage; a PATCH of `status` alone is overwritten by the stage.
- Creating a job still requires `candidatesNeeded` (existing rule).
- `apps/careers` serves one organisation per instance.
- Public CORS still allows any origin by default, and the Twilio webhook signature check is still skipped without a token (section 9, S10 and S11).

---

## 17. Candidate database, search and contact export — implementation report

Tested on 2026-11-06 against a real PostgreSQL engine (all migrations applied, then a 1,500-candidate dataset), the real API over HTTP, and independent expectations recomputed in JavaScript. **Not deployed yet: it needs the database change in 17.4 first.**

### 17.1 What was built

| Requirement | Result |
|---|---|
| Filters: location, post code, job title, trade, experience, skills, qualifications, employment status, last contacted, grade A/B/C | New filters on `GET /candidates`: `postcode` (starts with, also found inside the location text), `trade`, `grade` (A, B, C or several), `employmentStatus`, `experienceMin`, `skills` / `qualifications` (must have **all**), `contactedFrom`, `contactedTo`, `notContactedSince` (counts "never contacted"). They combine with each other and with the existing filters, search, availability, owner and website/manual |
| Availability | Existing derived filter kept (Available / Not available / Do not use) |
| New candidate fields | Trade, grade, employment status, years of experience, experience notes, skills, qualifications, last contacted, consent per channel, plus a post code box on the form |
| Selection | Tick people one by one; tick everyone on the page; then **"Select all N that match"**, which sends the filters (not the people) to the server. People can be un-ticked afterwards. The bar always shows the exact number, and the "Add to pipeline" action is only offered for hand-ticked people |
| Export | CSV, Excel (.xlsx) and a Dialpad contacts file. The user chooses the purpose, the format and the columns (20 allowed columns) before downloading |
| Contact rules | Applied **on the server before any file is written or counted**: see 17.2 |
| Dialpad | Fixed contact layout, phone numbers in international format, 500 contacts per file with a file picker for the rest |
| Interface | "More filters" panel, "Clear filters", select-all banner, Export and (admin) Record consent dialogs, loading, empty and error states |
| Stable paging | **Bug found by the tests and fixed:** people added in one import share the same creation time, so pages overlapped (one person twice, another never). The list now breaks ties by id |

### 17.2 Who may be put on a list

| Purpose | Needs |
|---|---|
| SMS | Consent **recorded as granted** for SMS, a valid mobile number, not opted out, not "Do not use" |
| Email | Consent recorded as granted for email, an address, not opted out, not "Do not use" |
| Phone calls | Not opted out of calls, a valid mobile number, not "Do not use" |

An opt-out in one channel does not block another channel; "Do not use" blocks all. **Nothing recorded counts as "no"** for SMS and email. People who tick the box on the website form ("You may contact me by SMS and e-mail…", never pre-ticked) are recorded as agreeing; filling the form never reverses an opt-out. An admin can record consent for a selection (evidence required; anyone who opted out is never switched back in bulk). The export dialog tells the user how many were left out and why (no data about them).

**Consequence to know about:** every existing candidate has "nothing recorded", so SMS and email lists are empty until consent is recorded (per person in the form, in bulk by an admin with evidence, or by new website applicants ticking the box). Calls are not affected.

### 17.3 Files

**Created:** `candidates/lib/{contact-policy,export-fields,export-files,list-values}.ts`, `candidates/dto/export-candidates.dto.ts`, `candidates/service/candidate-export.service.ts`, web `features/candidates/{export-dialog.tsx,form-defaults.ts}`, migration `20261106120000_candidate_filters_consent_export`, and the matching specs.
**Modified:** `schema.prisma`, `permissions` seed and constants, `candidates.{controller,module,repository}`, create / list DTOs, `public-applications.{service,dto}`, shared validation and types, careers `apply.html` and `serve.mjs`, web `candidates/page.tsx`, `candidate-form.tsx`, `columns`, `candidates.service.ts`, `api-client.ts`.

### 17.4 Database (additive; nothing dropped or overwritten)

- 3 types (`CandidateGrade`, `CandidateEmploymentStatus`, `ConsentStatus`)
- 12 columns on `candidates`, all optional or defaulting to "nothing recorded"
- 5 indexes (grade, last contacted, post code, and GIN on skills and qualifications)
- New permission `candidate:export`, granted to every role that already has `candidate:update`

### 17.5 API

`POST /candidates/export/preview` (counts only), `POST /candidates/export` (file), `POST /candidates/consent` (admin only). Export needs `candidate:export`. Every export and every consent change is written to the audit log with counts and column names, never contents.

### 17.6 Tests

- **Unit:** 104 pass across the API modules (contact rules, files, filters, selection, service, permission metadata).
- **End to end, real API + real Postgres + 1,500 candidates: 62 of 62 checks.** 19 filter cases (alone and combined, including a 6-way combination) match independent JavaScript results exactly; pagination returns every person exactly once; selection by ticks, by "all matching" and "all matching minus 3" gives exact counts; SMS / email / call lists exclude opted-out, no-consent, "do not use" and numberless people; CSV, XLSX and Dialpad files have only the chosen columns, E.164 numbers, and the 500-per-file split; disallowed columns, missing purpose and un-signed-in requests are refused; a recruiter can only export their own candidates; consent needs an admin and evidence and never overrides an opt-out; audit entries hold no personal data; a 1,500-person Excel export took about 0.25 s.
- **Migration:** applied to an empty database and inside a named schema like production's; existing data kept, permission granted only to roles that could already edit, safe to run twice.

### 17.7 Not verified

- **Dialpad's real template.** Dialpad's help says the file must start with `First_Name` / `Last_Name`, use E.164 numbers and hold at most 500 contacts; the other column names are not documented publicly. Download the template in Dialpad (Admin Settings → My Company → Shared Contacts) and compare; the headers are one constant (`DIALPAD_COLUMNS`).
- **The screens in a browser** (the extension is not connected): checked by type-check and API behaviour only.
- **Search speed on a very large database.** Search uses substring matching without a text index; fine at 1,500 rows, to be re-checked at tens of thousands (a trigram index would be the next step).
- **"Last contacted"** is set by hand for now; calls and messages will set it once Dialpad is connected.


---

## Phase 3 — Dialpad integration (built 5 Nov 2026, live on the VPS)

Phase 4 has **not** been started.

### What was built
- **Database (additive migration `20261107120000_dialpad_communications`)**: `communications` (one row per call or text: candidate, type, direction, status, text, number, recruiter, Dialpad id, delivery status, error, duration, batch), `communication_batches` (one row per bulk send, with an idempotency key), `message_templates`, and the permissions `communication:send`, `communication:bulk`, `template:manage` (granted to every role that already had `candidate:update`; an administrator can narrow this per role).
- **API (`modules/communications`)**: Dialpad connection (connect / change number / health / disconnect), `POST /candidates/:id/call`, `POST /candidates/:id/sms`, `GET /candidates/:id/communications`, bulk preview and send, batch progress, template CRUD, unmatched numbers, and the public `POST /webhooks/dialpad/:token`.
- **Screens**: Settings → Dialpad, Message templates, Unknown numbers; candidate profile → Communication card; Candidates → "Text via Dialpad" on the selection bar (works with "select all matching").

### Dialpad endpoints used (all read in the official reference, developers.dialpad.com)
`GET /company` (health), `GET /numbers` (admin key only), `GET /users?email=`, `POST /sms`, `POST /users/{id}/initiate_call`, `POST /webhooks`, `POST /subscriptions/sms`, `POST /subscriptions/call`, and the matching `DELETE`s. Auth is `Authorization: Bearer <API key>`.

### Safety rules in force
- Texts go only to people with **recorded SMS consent**, not opted out, not "Do not contact", with a valid number (the same rule the export uses). The preview shows the real count and why others are left out.
- A "STOP" (and similar) reply switches that candidate to opted-out immediately.
- Double-click and retry protection: the browser sends an idempotency key; the same exact text to the same person within 24 h is skipped; a single text repeated within 60 s is refused.
- Pace of about 85 texts a minute (Dialpad's documented SMS limit is 100 a minute); an HTTP 429 is waited out and retried. A text whose outcome is unknown (network error, server restart) is marked failed and is **never re-sent automatically**.
- A failure for one person does not stop the others; each result is on that candidate's history and in the batch summary.
- The API key and webhook secret are encrypted at rest and never returned to the browser.

### Verified and not verified
- Verified: 38 new automated tests (client requests, signature check, encryption, placeholders, consent rules, duplicates, partial failure, rate limit, webhook handling, permission enforcement); API and web type-check clean; all new routes live and return 401/404 correctly when called without a login.
- **Not verified against the real Dialpad account** (no key available): connecting, sending a real text, placing a real call, receiving a real webhook. Bulk messaging is therefore *built on the documented single-text endpoint* and is not claimed as proven until a first small send succeeds.
- Not verified in the Dialpad docs: access-token lifetime (not needed — API keys are used), 10DLC / carrier registration requirements for UK business texting, whether `from_number` can be a department or office line (the page says "user or user group"), and the rate-limit tier definitions. `subscriptions` use the field `endpoint_id` per the schema; the code retries with `webhook_id` (as the prose says) if Dialpad answers 400.
- Not built: OAuth (needs an OAuth app registered with Dialpad); Dialpad's own `POST /bulk_messages` (seen in the index but not read); company opt-out list sync (`companysms_opt_out`).

### External credentials and account settings still required
1. **Dialpad API key** from the Dialpad admin console (Company settings → Authentication → API keys). An **admin-level** key is preferable: it lets the CRM list and verify the company numbers. Paste it in Settings → Dialpad.
2. **The business number** already used in Dialpad, in international format (+44…), and it must be assigned to a Dialpad user or user group.
3. **Every recruiter's CRM e-mail must match their Dialpad e-mail** (calls ring that person's own Dialpad app, which must be open: web or desktop; mobile and desk phones do not support this API call).
4. **To receive incoming texts and calls**: nothing extra if the server's public address is set (`API_URL=https://crm.example.com`, already so). To also receive the *text* of incoming messages, Dialpad must allow the key the `message_content_export` scope; without it the history shows that a message arrived but not what it said.
5. **Consent**: no candidate can be texted until SMS consent is recorded (Candidates → select → Record consent, admin). All existing candidates are currently "no consent recorded", so a first bulk text will correctly reach nobody until consent is entered.
6. Users must **sign out and in again** to receive the three new permissions.
7. Optional: `INTEGRATION_ENCRYPTION_KEY` on the server. Without it the encryption key is derived from `SESSION_SECRET`; rotating that secret later would make the stored Dialpad key unreadable (it would need to be pasted again).
8. UK business texting may require carrier / 10DLC-style registration on the Dialpad account; confirm with Dialpad.


---

## Phase 6 — Temporary workers weekly payroll (built 6 Nov 2026, live on the VPS)

**Screens:** Revenue → **Timesheets** (`/timesheets`, detail `/timesheets/[id]`) and **Weekly payroll** (`/payroll`). Both belong to the administrator or to a user the page was ticked for. Approving, authorising, paying, overriding, bulk payslips and the Excel export need the new permission `payroll:approve` (granted to the roles that can manage users).

**A. Timesheets.** One worker, one client, one Monday-to-Sunday week. Submitted (pending approval), checked (errors block approval, warnings are the administrator's call), approved or rejected with a reason; rejected ones are amended and resubmitted. Approval works out the payroll and writes the payslip. Full approval history with who, when, and what changed.

**B. Weekly payroll dashboard.** Pick a week; filters: client, worker, approval, payment status, paid/unpaid, CIS status. Totals, payment progress, warnings (pending timesheets, missing NINO/UTR), select-all-awaiting, authorise (with the complete payroll shown first), mark paid (date + bank reference), take an authorisation back, Excel for the accountant.

**C. Calculation (server, whole pence).** gross = rate × days/hours + bonuses; CIS = gross × rate; net = gross − CIS − payroll fee − deductions − admin fees ± adjustments; client charge = charge rate × units; **profit = client charge − gross + payroll fee + admin fees − adjustments paid** (assumption to confirm with the accountant).

**D. Manual control.** Add a worker to a week (optionally approved straight away); amend days / rates (also after approval, with a reason, until the payment is authorised); bonuses, additional payments, deductions, admin fees and ± adjustments, each with a reason; override any figure with a reason (the calculated value is kept); recalculate the whole week (preview first). Locked once authorised or paid. Everything is in the timesheet's history and the audit log (never the NINO / UTR).

**E. Payslips.** Server-generated PDF in the DC Solutions layout of the master copy (logo, company, registration number, employee and payment details, NINO/UTR, week, payment date, description of work, rate, days/hours, gross, CIS, payroll fee, bonuses/deductions, net, notes, payment reference once paid). Individually, or for a whole week as a ZIP of PDFs or one PDF (filters / ticked lines apply).

**Database (additive, applied to production 6 Nov 2026 by hand, backup of the touched tables in `/opt/crm/backups/pre-payroll-*`):** `20261108120000_timesheets_payroll`, `20261108130000_weekly_payroll_payments`, `20261108140000_payroll_adjustments`. Existing payslips were recorded as PAID.

**Tested:** 24 unit tests (calculation, week, checks, PDF, ZIP); API end to end 45/46 + 41/42 + 65/65 (the two misses are test expectations since corrected); screens checked in Chrome (timesheets, payroll week, payroll control, payslip PDF rendered and read back).

**Not verified:** nothing was run against a real accountant's sheet — the profit definition and the 20 / 30 / 0 % CIS handling should be confirmed with the accountant. The payslip PDF could not be compared pixel by pixel with the `.odt`; it follows the `.docx` copy (Downloads/Master copy - Copy.docx.docx).
