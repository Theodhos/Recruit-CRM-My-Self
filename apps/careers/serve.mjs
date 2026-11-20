// Careers site backed by the CRM: `node serve.mjs` -> http://localhost:3100/jobs
// Lists the OPEN jobs of one organisation (GET /api/v1/public/jobs) and forwards applications to the CRM
// (POST /api/v1/public/applications). Config: CRM_API_URL (default http://localhost:4010), CAREERS_ORG (organisation slug).
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const port = Number(process.env.PORT ?? 3100);
const api = (process.env.CRM_API_URL ?? 'http://localhost:4010').replace(/\/$/, '') + '/api/v1/public';
const org = process.env.CAREERS_ORG ?? 'acme-recruiting';
const types = { '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.woff': 'font/woff', '.svg': 'image/svg+xml' };
const TYPE = { PERMANENT: 'Permanent', CONTRACT: 'Contract', TEMPORARY: 'Temporary', PART_TIME: 'Part-time' };

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const date = (iso) => {
  const d = new Date(iso);
  return [d.getUTCDate(), d.getUTCMonth() + 1].map((n) => String(n).padStart(2, '0')).join('/') + '/' + d.getUTCFullYear();
};
const lines = (s) => String(s ?? '').split('\n').map((l) => l.trim()).filter(Boolean);
const template = (name) => readFile(join(root, 'templates', name + '.html'), 'utf8');
const fill = (tpl, vars) => tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? '');

async function loadJobs() {
  const res = await fetch(`${api}/jobs?organisation=${encodeURIComponent(org)}`);
  if (!res.ok) throw new Error(`CRM API ${res.status}`);
  return (await res.json()).data;
}

// The job's description / responsibilities / requirements as the page's paragraph blocks.
function description(job) {
  const p = (t) => `<p>${esc(t)}</p>`;
  const bullets = (s) => lines(s).map((l) => p('• ' + l)).join('\n');
  const parts = [];
  if (job.description) parts.push(lines(job.description).map(p).join('\n'));
  if (job.responsibilities) parts.push('<p><strong>Key Responsibilities</strong></p>\n' + bullets(job.responsibilities));
  if (job.requirements) parts.push('<p><strong>Requirements</strong></p>\n' + bullets(job.requirements));
  if (job.skills) parts.push('<p><strong>Skills</strong></p>\n' + bullets(job.skills));
  if (job.qualifications) parts.push('<p><strong>Qualifications</strong></p>\n' + bullets(job.qualifications));
  if (job.experienceYearsMin != null) {
    const years = `${job.experienceYearsMin}${job.experienceYearsMax != null ? '–' + job.experienceYearsMax : '+'} years`;
    parts.push(`<p><strong>Experience:</strong> ${years}</p>`);
  }
  if (job.applicationInstructions) parts.push('<p><strong>How to apply</strong></p>\n' + lines(job.applicationInstructions).map(p).join('\n'));
  return parts.join('\n<p> </p>\n');
}
const descriptionBlock = (job) =>
  `<div class="job__description bg-white p-3">\n    <h3 class="text-primary">Job Description</h3>\n    <div class="page">\n${description(job)}\n</div>\n</div>`;
const money = (n, cur) => `${{ GBP: '£', USD: '$', EUR: '€' }[cur] ?? cur + ' '}${Number(n).toLocaleString('en-GB')}`;
const salary = (job) => {
  if (job.salaryMin == null && job.salaryMax == null) return '';
  const [a, b] = [job.salaryMin, job.salaryMax];
  return a != null && b != null && Number(a) !== Number(b) ? `${money(a, job.currency)} – ${money(b, job.currency)}` : money(a ?? b, job.currency);
};
const rows = (job) =>
  [
    ['Job title:', `<td class="font-weight-bold text-primary">${esc(job.title)}</td>`],
    ['Job type:', `<td>${TYPE[job.employmentType] ?? esc(job.employmentType)}</td>`],
    ...(job.location ? [['Location:', `<td>${esc(job.location)}</td>`]] : []),
    ...(salary(job) ? [['Salary:', `<td>${esc(salary(job))}</td>`]] : []),
    ['Job published:', `<td>${date(job.websitePublishedAt ?? job.createdAt)}</td>`],
    ['Job ID:', `<td>${esc(job.id)}</td>`],
  ]
    .map(([th, td]) => `<tr><th>${th}</th>${td}</tr>`)
    .join('\n');

const article = (job) => `<article class="job">
    <div class="job__meta row">
        <div class="job_header col-12 col-lg-6">
            <div class="job__title mb-2">
                <a href="/job/${esc(job.id)}" class="font-weight-bold">${esc(job.title)}</a>
                <span class="rounded-circle js-toggle-job-summary" role="button"><i class="fal fa-angle-right cursor-pointer"></i></span>
            </div>
        </div>
        <div class="job__location col-12 col-lg-3 ">${esc(job.location)}</div>
        <div class="job__other-info col-12 col-lg-3 "><div class="job__type">${TYPE[job.employmentType] ?? ''}</div></div>
    </div>
    <div class="job__id row mb-2"><div class="col-md-2 font-weight-bold">Job ID:</div><div class="col-md-10">${esc(job.id)}</div></div>
    <div class="job__published-date row mb-2"><div class="col-md-2 font-weight-bold">Published date:</div><div class="col-md-10">${date(job.websitePublishedAt ?? job.createdAt)}</div></div>
    <div class="job__summary js-summary hidden">
        <div class="row mb-3">
            <div class="col-md-2 font-weight-bold">Summary</div>
            <div class="col-md-10"><div class="page">${description(job)}</div></div>
        </div>
        <div class="row"><div class="col-2"></div><div class="col-10 clearfix job_links"><div class="float-left">
            <a href="/job/${esc(job.id)}" class="btn btn-primary mr-2 job__links--readmore">Read More</a>
            <a href="/apply/${esc(job.id)}" class="btn btn-primary job__links--apply-now">Apply Now</a>
        </div></div></div>
    </div>
</article>`;

async function page(path) {
  const { organisation, jobs } = await loadJobs();
  if (path === '/jobs') {
    return fill(await template('list'), { ORG: esc(organisation), COUNT: jobs.length, JOBS: jobs.map(article).join('\n') });
  }
  const m = path.match(/^\/(job|apply)\/([a-z0-9]+)(\/|$)/i);
  const job = m && jobs.find((j) => j.id === m[2]);
  if (!job) return null;
  const where = job.location ? ` in ${job.location}` : '';
  return fill(await template(m[1]), {
    TITLE_TAG: esc(`New Job Opening: ${job.title}${where}`),
    ID: esc(job.id),
    TITLE: esc(job.title),
    ROWS: rows(job),
    DESCRIPTION: descriptionBlock(job),
  });
}

const send = (res, status, body, type = 'text/html; charset=utf-8') => {
  res.writeHead(status, { 'Content-Type': type });
  res.end(body);
};

async function submit(req, res, jobId) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 6_000_000) return send(res, 413, '{}', 'application/json');
    chunks.push(chunk);
  }
  let incoming;
  try {
    incoming = await new Request('http://x', { method: 'POST', headers: { 'content-type': req.headers['content-type'] ?? '' }, body: Buffer.concat(chunks) }).formData();
  } catch {
    return send(res, 400, '{}', 'application/json');
  }
  const out = new FormData();
  out.set('organisation', org);
  out.set('jobId', jobId);
  for (const k of ['firstName', 'lastName', 'email', 'website', 'phone', 'location', 'marketingConsent']) {
    const v = incoming.get(k);
    if (typeof v === 'string' && v !== '') out.set(k, v);
  }
  const cv = incoming.get('cv');
  if (cv && typeof cv !== 'string' && cv.size > 0) out.set('cv', cv, cv.name);
  const visitor = String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim() || req.socket.remoteAddress || '';
  const r = await fetch(`${api}/applications`, { method: 'POST', body: out, headers: visitor ? { 'X-Forwarded-For': visitor } : {} });
  send(res, r.ok ? 200 : 400, JSON.stringify({ ok: r.ok }), 'application/json');
}

createServer(async (req, res) => {
  try {
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/(.)\/$/, '$1');
    if (path === '/') return void res.writeHead(302, { Location: '/jobs' }).end();
    if (path.startsWith('/assets/')) {
      const file = normalize(join(root, path));
      if (!file.startsWith(join(root, 'assets'))) return send(res, 403, 'Forbidden', 'text/plain');
      return send(res, 200, await readFile(file), types[extname(file)] ?? 'application/octet-stream');
    }
    const apply = req.method === 'POST' && path.match(/^\/apply\/([a-z0-9]+)$/i);
    if (apply) return await submit(req, res, apply[1]);
    const html = req.method === 'GET' ? await page(path) : null;
    if (html == null) return send(res, 404, 'Not found', 'text/plain');
    send(res, 200, html);
  } catch (e) {
    console.error(e);
    send(res, e.code === 'ENOENT' ? 404 : 502, 'Not available', 'text/plain');
  }
}).listen(port, process.env.HOST, () => console.log(`Careers page: http://localhost:${port}/jobs  (CRM ${api}, organisation ${org})`));
