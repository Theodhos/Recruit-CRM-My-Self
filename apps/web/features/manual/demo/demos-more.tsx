import type { ReactNode } from 'react';

import type { DemoDefinition } from './demos';
import { ana, board, candidateRows, CANDIDATE_HEAD, cardDialog, emptyBoard } from './demos';
import { Board, Btn, Column, DropZone, Field, MockApp, Notice, Overlay, Panel, PCard, Table, Tag } from './mock';

/**
 * The rest of the demos: one for every other topic of the manual, so each phase and sub-phase of the platform has its own.
 * Same pieces, same labels as the real screens (see mock.tsx).
 */

const JOB_HEAD = ['Job title', 'Client', 'Type', 'Needed'];
const jobRows = (): ReactNode[][] => [
  ['Electrician', 'Acme Ltd', <Tag key="a" tone="green">PERMANENT</Tag>, '1/2'],
  ['permanent job 2', 'Company', <Tag key="b" tone="green">PERMANENT</Tag>, '1/2'],
  ['jobs2', 'jobs2', <Tag key="c" tone="amber">TEMPORARY</Tag>, '1/2'],
];

/** A page with a pop-up over it. */
const over = (active: string, title: string, back: ReactNode, dialog: ReactNode, drawer = false) => (
  <MockApp active={active} title={title} dim>
    {back}
    <Overlay side={drawer ? 'right' : undefined}>{dialog}</Overlay>
  </MockApp>
);

const Tile = ({ id, label, value, tone = 'slate' }: { id?: string; label: string; value: string; tone?: 'slate' | 'green' | 'amber' | 'red' | 'blue' }) => (
  <div data-demo={id} className="rounded-lg border border-slate-200 bg-white p-3">
    <p className="text-[11px] text-slate-500">{label}</p>
    <p className={`mt-1 text-[22px] font-bold ${{ slate: 'text-slate-900', green: 'text-emerald-700', amber: 'text-amber-600', red: 'text-red-600', blue: 'text-blue-700' }[tone]}`}>{value}</p>
  </div>
);

const Tabs = ({ items, active }: { items: string[]; active: string }) => (
  <div className="mb-3 inline-flex gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1 text-[12px]">
    {items.map((item) => (
      <span key={item} data-demo={`tab-${item}`} className={`rounded-md px-3 py-1 ${item === active ? 'bg-slate-900 font-medium text-white' : ''}`}>
        {item}
      </span>
    ))}
  </div>
);

const buttons = (...children: ReactNode[]) => <>{children}</>;

export const DEMOS_MORE: Record<string, DemoDefinition> = {
  // ------------------------------------------------------------------------------------------------ overview
  flow: {
    title: 'Rruga e një pune dhe e një kandidati',
    scenes: [
      { caption: '1. Shto kompaninë (klientin) te Companies.', target: 'add', screen: <MockApp active="Companies" title="Companies" action={<Btn id="add" pulse>+ Add Company</Btn>}><Table head={['Company', 'Industry', 'Status']} rows={[['Acme Ltd', 'Construction', 'ACTIVE CLIENT'], ['Brick & Co', 'Building', 'PROSPECT']]} /></MockApp> },
      { caption: '2. Shto punën te Jobs: titulli, kompania, lloji dhe sa kandidatë duhen.', target: 'add', screen: <MockApp active="Jobs" title="Jobs" action={<Btn id="add" pulse>+ Add Job</Btn>}><Table head={JOB_HEAD} rows={jobRows()} /></MockApp> },
      { caption: '3. Shto kandidatët te Candidates (me CV, Excel, ose vijnë nga faqja e internetit).', target: 'add', screen: <MockApp active="Candidates" title="Candidates" action={<Btn id="add" pulse>+ Add Candidate</Btn>}><Table head={CANDIDATE_HEAD} rows={candidateRows()} checks /></MockApp> },
      { caption: '4. Vendosi te pipeline-i i punës dhe çoji fazë pas faze.', target: 'card', screen: board(emptyBoard({ 'Interview 1': ana('Interview 1', 'violet', 'card') })) },
      { caption: '5. Kur punësohet, kandidati shfaqet te Active Employees; kur mbaron, shtyp Completed.', target: 'row-0', screen: <MockApp active="Active Employees" title="Active Employees"><Table head={['Employee', 'Job', 'Type', 'Pay']} rows={[['Ana Dodaj', 'permanent job 2', <Tag key="p" tone="green">Permanent</Tag>, '£200/h']]} highlight={0} /></MockApp> },
    ],
  },
  dashboard: {
    title: 'Leximi i Dashboard-it',
    scenes: [
      { caption: 'Dashboard hapet i pari: numrat kryesorë të punës.', target: 'tiles', screen: <MockApp active="Dashboard" title="Dashboard"><div data-demo="tiles" className="grid grid-cols-4 gap-3"><Tile label="Candidates" value="248" /><Tile label="Open jobs" value="12" tone="blue" /><Tile label="In pipeline" value="63" /><Tile label="Active employees" value="41" tone="green" /></div><div className="mt-4 grid grid-cols-2 gap-3"><div className="h-[190px] rounded-lg border border-slate-200 bg-white p-3 text-[12px] font-semibold">Pipeline by stage</div><div className="h-[190px] rounded-lg border border-slate-200 bg-white p-3 text-[12px] font-semibold">Recent activity</div></div></MockApp> },
      { caption: 'Poshtë shihni çfarë ka ndodhur së fundi dhe çfarë pret veprim.', target: 'activity', screen: <MockApp active="Dashboard" title="Dashboard"><div className="grid grid-cols-4 gap-3"><Tile label="Candidates" value="248" /><Tile label="Open jobs" value="12" tone="blue" /><Tile label="In pipeline" value="63" /><Tile label="Active employees" value="41" tone="green" /></div><div className="mt-4 grid grid-cols-2 gap-3"><div className="h-[190px] rounded-lg border border-slate-200 bg-white p-3 text-[12px] font-semibold">Pipeline by stage</div><div data-demo="activity" className="h-[190px] rounded-lg border border-blue-300 bg-white p-3 text-[12px]"><p className="mb-2 font-semibold">Recent activity</p><p className="py-1">Ana Dodaj moved to Interview 1</p><p className="py-1">New candidate: Theodhos Lupe</p><p className="py-1">Job transferred to Gabriela Foto</p></div></div></MockApp> },
    ],
  },
  // ------------------------------------------------------------------------------------------------ candidates
  import: {
    title: 'Importi nga Excel',
    scenes: [
      { caption: 'Te Candidates shtyp "Import Excel".', target: 'imp', screen: <MockApp active="Candidates" title="Candidates" action={<><Btn id="imp" tone="outline" pulse>Import Excel</Btn><Btn>+ Add Candidate</Btn></>}><Table head={CANDIDATE_HEAD} rows={candidateRows()} checks /></MockApp> },
      { caption: 'Zgjidh skedarin dhe përputh kolonat e tij me fushat e CRM-së.', target: 'map', ms: 4400, screen: over('Candidates', 'Candidates', <Table head={CANDIDATE_HEAD} rows={candidateRows()} />, <Panel title="Import Excel" width={560} footer={<Btn tone="outline">Import</Btn>}><DropZone label="candidates.xlsx" filled="candidates.xlsx · 4 rows" /><div data-demo="map" className="grid grid-cols-2 gap-2 text-[11px]"><Field label="Column A" value="First name" /><Field label="Column B" value="Last name" /><Field label="Column C" value="Phone" /><Field label="Column D" value="Location" /></div></Panel>) },
      { caption: 'Rezultati: rreshtat e vlefshëm shtohen; dublikatët dhe rreshtat bosh refuzohen me arsyen.', target: 'result', ms: 4400, screen: over('Candidates', 'Candidates', <Table head={CANDIDATE_HEAD} rows={candidateRows()} />, <Panel title="Import finished" width={520}><div data-demo="result" className="space-y-1.5 text-[12px]"><p className="rounded-md bg-emerald-50 px-3 py-2 text-emerald-900">✓ 3 candidates added</p><p className="rounded-md bg-amber-50 px-3 py-2 text-amber-900">Row 4: already in the system (same phone number)</p></div></Panel>) },
    ],
  },
  filters: {
    title: 'Kërkimi dhe filtrat',
    scenes: [
      { caption: 'Shkruaj te kutitë Name, Location, Number ose Job title.', target: 'name', screen: <MockApp active="Candidates" title="Candidates"><div className="mb-3 grid grid-cols-4 gap-2"><Field id="name" label="Name" value="Ana" /><Field label="Location" /><Field label="Number" /><Field label="Job title" /></div><Table head={CANDIDATE_HEAD} rows={candidateRows().slice(0, 1)} checks /></MockApp> },
      { caption: 'Availability, Added dhe "Added by" e ngushtojnë listën sipas kohës dhe sipas rekrutuesit.', target: 'by', screen: <MockApp active="Candidates" title="Candidates"><div className="mb-3 grid grid-cols-4 gap-2"><Field label="Availability" value="All" /><Field label="Added" value="All candidates" /><Field id="by" label="Added by" value="Aurora Merolli" /><Btn tone="outline">More filters</Btn></div><Table head={CANDIDATE_HEAD} rows={candidateRows().slice(1)} checks /></MockApp> },
      { caption: '"More filters" hap filtrat e avancuar: zanati, përvoja, aftësitë, kualifikimet, kontaktimi i fundit.', target: 'more', ms: 4200, screen: over('Candidates', 'Candidates', <Table head={CANDIDATE_HEAD} rows={candidateRows()} />, <Panel title="More filters" width={420}><div data-demo="more" className="grid grid-cols-2 gap-2"><Field label="Trade" value="Electrician" /><Field label="Experience (years)" value="5" /><Field label="Skills" value="conduit bending" /><Field label="Qualifications" value="NVQ level 3" /></div></Panel>, true) },
    ],
  },
  export: {
    title: 'Eksporti dhe mesazhet në masë',
    scenes: [
      { caption: 'Shëno kandidatët (ose lëri të gjithë të listuarit).', target: 'check-0', screen: <MockApp active="Candidates" title="Candidates"><Table head={CANDIDATE_HEAD} rows={candidateRows()} checks checked={[0, 1]} /></MockApp> },
      { caption: 'Shtyp "Export" dhe zgjidh formatin: CSV, Excel ose Dialpad.', target: 'exp', screen: over('Candidates', 'Candidates', <Table head={CANDIDATE_HEAD} rows={candidateRows()} checks checked={[0, 1]} />, <Panel title="Export 2 candidates" width={440} footer={<Btn tone="outline">Export</Btn>}><div data-demo="exp" className="space-y-1.5 text-[12px]"><p className="rounded-md border border-blue-400 bg-blue-50 px-3 py-2 font-medium">◉ Excel (.xlsx)</p><p className="rounded-md border border-slate-200 px-3 py-2">○ CSV</p><p className="rounded-md border border-slate-200 px-3 py-2">○ Dialpad contacts</p><p className="text-[11px] text-slate-500">Vetëm kandidatët me pëlqim marrin SMS ose e-mail.</p></div></Panel>) },
      { caption: 'Skedari shkarkohet me kolonat e zgjedhura.', target: 'done', screen: <MockApp active="Candidates" title="Candidates"><Table head={CANDIDATE_HEAD} rows={candidateRows()} checks /><div data-demo="done" className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-[12px] font-medium text-emerald-900 shadow-lg">candidates.xlsx downloaded</div></MockApp> },
    ],
  },
  'candidate-detail': {
    title: 'Faqja e kandidatit',
    scenes: [
      { caption: 'Klikoje emrin e kandidatit në listë.', target: 'row-0', screen: <MockApp active="Candidates" title="Candidates"><Table head={CANDIDATE_HEAD} rows={candidateRows(['Theodhos Lupe', '+355 69 788 3395', 'Manual', <Tag key="n" tone="green">Available</Tag>])} checks /></MockApp> },
      { caption: 'Faqja tregon kontaktin, CV-në (Preview) dhe butonat WhatsApp (për të shkruar) dhe Text (SMS).', target: 'actions', ms: 4400, screen: <MockApp active="Candidates" title="Theodhos Lupe" action={<><Btn tone="outline">Call</Btn><Btn tone="outline">SMS</Btn></>}><div className="grid grid-cols-2 gap-3"><div className="rounded-lg border border-slate-200 bg-white p-3 text-[12px]"><p className="mb-1 font-semibold">Details</p><p>Phone: +355 69 788 3395</p><p>Location: Korce, Albania</p><p>Trade: Electrician</p></div><div data-demo="actions" className="rounded-lg border border-slate-200 bg-white p-3 text-[12px]"><p className="mb-1 font-semibold">CV</p><p className="mb-2">Theodhos Lupe CV.pdf</p><div className="flex gap-2"><Btn small tone="outline">Preview</Btn><Btn small tone="outline">Add document</Btn></div></div></div></MockApp> },
      { caption: 'Më poshtë është historiku i pipeline-it, thirrjet dhe tekstet me kandidatin.', target: 'history', screen: <MockApp active="Candidates" title="Theodhos Lupe"><div data-demo="history" className="rounded-lg border border-slate-200 bg-white p-3 text-[12px]"><p className="mb-2 font-semibold">History</p><p className="py-1">Sent CV → Interview 1 (permanent job 2)</p><p className="py-1">Call, 3 min · 12 Nov</p><p className="py-1">SMS sent: "Intervista e hënë, ora 10"</p></div></MockApp> },
    ],
  },
  // ---------------------------------------------------------------------------------------------------- jobs
  'job-detail': {
    title: 'Faqja e punës',
    scenes: [
      { caption: 'Klikoje titullin e punës te lista.', target: 'row-1', screen: <MockApp active="Jobs" title="Jobs"><Table head={JOB_HEAD} rows={jobRows()} checks /></MockApp> },
      { caption: 'Plotëso seksionet: What the job is, What the candidate will do, What is required, Skills, Qualifications, How to apply, me "Add".', target: 'sections', ms: 4400, screen: <MockApp active="Jobs" title="permanent job 2"><div data-demo="sections" className="grid grid-cols-2 gap-3 text-[12px]">{['What the job is', 'What the candidate will do', 'What is required', 'Skills', 'Qualifications', 'How to apply'].map((section) => <div key={section} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3"><span className="font-semibold">{section}</span><Btn small tone="outline">Add</Btn></div>)}</div></MockApp> },
      { caption: 'Për punë Temporary ndrysho kalendarin: ditët e punës dhe orët e çdo personi.', target: 'cal', screen: <MockApp active="Jobs" title="jobs2"><div data-demo="cal" className="grid grid-cols-7 gap-1 rounded-lg border border-slate-200 bg-white p-3 text-center text-[11px]">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, index) => <div key={day} className={`rounded-md py-4 ${index < 5 ? 'bg-blue-100 font-semibold text-blue-900' : 'bg-slate-100 text-slate-400'}`}>{day}<br />{index < 5 ? '8 h' : '—'}</div>)}</div></MockApp> },
    ],
  },
  website: {
    title: 'Publikimi në faqen e internetit',
    scenes: [
      { caption: 'Te Add/Edit Job shëno "Publish this job on the company website".', target: 'publish', screen: over('Jobs', 'Jobs', <Table head={JOB_HEAD} rows={jobRows()} />, <Panel title="Edit Job" drawer width={420} footer={<Btn tone="outline">Save</Btn>}><div data-demo="publish" className="space-y-2 text-[12px]"><p>☑ Publish this job on the company website</p><p>☑ Show the salary on the website</p><Field label="Expires on" value="2026-12-31" /></div></Panel>, true) },
      { caption: 'Puna shfaqet në faqen e kompanisë dhe te lista tregon që është publikuar.', target: 'tag', screen: <MockApp active="Jobs" title="Jobs"><Table head={['Job title', 'Website', 'Type']} rows={[['Electrician', <span key="w" data-demo="tag"><Tag tone="green">On website</Tag></span>, 'PERMANENT'], ['jobs2', <Tag key="n">Not on website</Tag>, 'TEMPORARY']]} highlight={0} /></MockApp> },
      { caption: 'Aplikimet nga faqja vijnë vetë te Candidates dhe te faza Sent CV; puna mbyllet vetë kur skadon data.', target: 'row-0', screen: <MockApp active="Candidates" title="Candidates"><Table head={['Name', 'Source', 'Added']} rows={[['New Applicant', <Tag key="w" tone="sky">Website</Tag>, 'just now']]} highlight={0} /></MockApp> },
    ],
  },
  // ------------------------------------------------------------------------------------------------ companies
  'company-add': {
    title: 'Shtimi i një kompanie',
    scenes: [
      { caption: 'Shtyp "Add Company".', target: 'add', screen: <MockApp active="Companies" title="Companies" action={<Btn id="add" pulse>+ Add Company</Btn>}><Table head={['Company', 'Industry', 'Status']} rows={[['Acme Ltd', 'Construction', 'ACTIVE CLIENT']]} /></MockApp> },
      { caption: 'Shkruaj emrin, industrinë, statusin, kontaktin dhe adresën; zgjidh "Added by".', target: 'name', ms: 4200, screen: over('Companies', 'Companies', <Table head={['Company', 'Industry', 'Status']} rows={[['Acme Ltd', 'Construction', 'ACTIVE CLIENT']]} />, <Panel title="Quick Add Company" drawer width={400} footer={<Btn tone="outline">Create company</Btn>}><div className="grid gap-2"><Field id="name" label="Company name" value="Brick & Co" /><Field label="Industry" value="Building" /><Field label="Status" value="PROSPECT" /><Field label="Added by" value="Me (the one adding it)" /></div></Panel>, true) },
      { caption: 'Nëse kompania ekziston (i njëjti emër ose website), nuk ruhet dhe del njoftimi.', target: 'ok', ms: 4200, screen: over('Companies', 'Companies', <Table head={['Company', 'Industry', 'Status']} rows={[['Acme Ltd', 'Construction', 'ACTIVE CLIENT']]} />, <Notice id="ok" title="Already in the system">This company is already in the system: Acme Ltd has the same name. It was not added again.</Notice>) },
    ],
  },
  'company-detail': {
    title: 'Faqja e kompanisë',
    scenes: [
      { caption: 'Klikoje emrin e kompanisë.', target: 'row-0', screen: <MockApp active="Companies" title="Companies"><Table head={['Company', 'Industry', 'Status']} rows={[['Acme Ltd', 'Construction', 'ACTIVE CLIENT']]} /></MockApp> },
      { caption: 'Shiko kontaktet, punët dhe punonjësit e kompanisë.', target: 'tabs', screen: <MockApp active="Companies" title="Acme Ltd"><div data-demo="tabs"><Tabs items={['Contacts', 'Jobs', 'Employees']} active="Contacts" /></div><Table head={['Contact', 'Role', 'E-mail']} rows={[['John Smith', 'Site manager', 'john@acme.com']]} /></MockApp> },
      { caption: 'Shto një kontakt të ri me butonin Add.', target: 'add', screen: <MockApp active="Companies" title="Acme Ltd" action={<Btn id="add" pulse>+ Add contact</Btn>}><Tabs items={['Contacts', 'Jobs', 'Employees']} active="Contacts" /><Table head={['Contact', 'Role', 'E-mail']} rows={[['John Smith', 'Site manager', 'john@acme.com']]} /></MockApp> },
    ],
  },
  // ------------------------------------------------------------------------------------- permanent pipeline phases
  'pp-card': {
    title: 'Karta dhe pop-up-i i saj',
    scenes: [
      { caption: 'Klikoje kartën ose "Stage notes & pay".', target: 'card', screen: board(emptyBoard({ 'Interview 1': ana('Interview 1', 'violet', 'card') })) },
      { caption: 'Pop-up-i tregon kandidatin, butonat e fazës dhe CV-në me "Preview CV".', target: 'buttons', ms: 4200, screen: cardDialog('Interview 1', buttons(<Btn key="1" tone="sky">Interview 2</Btn>, <Btn key="2" tone="amber">No Show</Btn>, <Btn key="3" tone="red">Reject</Btn>, <span key="s" className="flex-1" />, <Btn key="p" tone="grey">Preview CV</Btn>)) },
      { caption: 'Shkruaj shënimet e fazës dhe ruaji me Save. History mban udhëtimin e kandidatit.', target: 'save', screen: <Overlay><Panel title="Ana Dodaj   ·   permanent job 2" width={560} footer={<Btn id="save" tone="outline" pulse>Save</Btn>}><p className="mb-1 text-[12px] font-semibold">History</p><div className="rounded-md border border-slate-200 p-2 text-[11px]"><p><Tag tone="navy">Sent CV</Tag> CV sent to the client</p><p className="mt-1"><Tag tone="violet">Interview 1</Tag> Good first call, strong references</p></div></Panel></Overlay> },
    ],
  },
  'stage-sentcv': {
    title: 'Faza Sent CV',
    scenes: [
      { caption: 'Kandidati hyn te Sent CV kur e vendos te puna.', target: 'card', screen: board(emptyBoard({ 'Sent CV': ana('Sent CV', 'navy', 'card') })) },
      { caption: 'Hap kartën dhe shtyp "Add CV" për të ngarkuar CV-në.', target: 'addcv', screen: cardDialog('Sent CV', buttons(<Btn key="1" tone="purple">Interview 1</Btn>, <Btn key="2" tone="sky">Interview 2</Btn>, <Btn key="3" tone="red">Rejected</Btn>, <span key="s" className="flex-1" />, <Btn key="a" id="addcv" tone="outline" pulse>+ Add CV</Btn>, <Btn key="n" tone="grey">No CV on file</Btn>)) },
      { caption: 'Pas ngarkimit CV-ja hapet menjëherë në anë (Preview CV).', target: 'preview', ms: 4200, screen: <MockApp active="Pipeline Jobs" title="Pipeline Jobs" dim><Overlay><div className="flex gap-3"><Panel title="Ana Dodaj   ·   permanent job 2" width={400}><p className="text-[12px]">Stage <Tag tone="navy">Sent CV</Tag></p><div className="mt-2 flex gap-2"><Btn tone="outline">+ Add another CV</Btn><Btn>Preview CV</Btn></div></Panel><div data-demo="preview" className="h-[300px] w-[300px] rounded-xl bg-white p-4 text-[11px] shadow-2xl"><p className="mb-2 font-bold">Ana Dodaj</p><p>Electrician · Leeds</p><p className="mt-2 text-slate-500">CV preview…</p></div></div></Overlay></MockApp> },
      { caption: 'Kur është gati shtyp Interview 1 ose Interview 2, ose Rejected.', target: 'col-Interview 1', screen: board(emptyBoard({ 'Interview 1': ana('Interview 1', 'violet', 'card') })) },
    ],
  },
  'stage-interview1': {
    title: 'Faza Interview 1',
    scenes: [
      { caption: 'Karta është te Interview 1: rishikimi i dytë i kandidatit.', target: 'card', screen: board(emptyBoard({ 'Interview 1': ana('Interview 1', 'violet', 'card') })) },
      { caption: 'Hap kartën: lart ka kujtesën, pastaj butonat Interview 2, No Show dhe Reject.', target: 'buttons', ms: 4200, screen: cardDialog('Interview 1', buttons(<Btn key="1" id="i2" tone="sky">Interview 2</Btn>, <Btn key="2" tone="amber">No Show</Btn>, <Btn key="3" tone="red">Reject</Btn>)) },
      { caption: 'Shtyp "Interview 2": karta kalon te faza e dytë.', target: 'col-Interview 2', screen: board(emptyBoard({ 'Interview 2': ana('Interview 2', 'sky', 'card') })) },
    ],
  },
  'stage-interview2': {
    title: 'Faza Interview 2',
    scenes: [
      { caption: 'Karta është te Interview 2: intervista e dytë, vendimi final.', target: 'card', screen: board(emptyBoard({ 'Interview 2': ana('Interview 2', 'sky', 'card') })) },
      { caption: 'Hap kartën: "Hire", "No Show" ose "Reject". Me "WhatsApp" hapet biseda për të shkruar kandidatit.', target: 'hire', ms: 4200, screen: cardDialog('Interview 2', buttons(<Btn key="c" tone="dark">WhatsApp +44 7700 900123</Btn>, <Btn key="h" id="hire" tone="green" pulse>Hire</Btn>, <Btn key="n" tone="amber">No Show</Btn>, <Btn key="r" tone="red">Reject</Btn>)) },
      { caption: 'Hire hap tabelën e pagës; pasi konfirmohet, karta kalon te Placement.', target: 'col-Placement', screen: board(emptyBoard({ Placement: ana('Active', 'green', 'card') })) },
    ],
  },
  'stage-rejected': {
    title: 'Faza Rejected',
    scenes: [
      { caption: 'Refuzo me butonin Reject, me No Show, ose tërhiq kartën te kolona Rejected.', target: 'col-Rejected', carry: 'Ana Dodaj', screen: board(emptyBoard({ 'Interview 1': undefined }, { Rejected: { id: 'col-Rejected', highlight: true, note: 'Drop here to reject' } })) },
      { caption: 'Kërkohet një shënim (arsyeja) para se të refuzohet.', target: 'note', ms: 4200, screen: over('Pipeline Jobs', 'Pipeline Jobs', <div />, <Panel title="Reject Ana Dodaj" width={460} footer={<Btn tone="red">Reject</Btn>}><div data-demo="note" className="h-[90px] rounded-md border border-slate-300 p-2 text-[12px]">Not enough site experience for this role.</div></Panel>) },
      { caption: 'Kolona Rejected mbetet bosh; kandidati është te Rejected Applicants me arsyen.', target: 'row-0', screen: <MockApp active="Rejected Applicants" title="Rejected Applicants"><Table head={['Candidate', 'Job', 'Reason']} rows={[['Ana Dodaj', 'permanent job 2', 'Not enough site experience for this role.']]} highlight={0} /></MockApp> },
    ],
  },
  'stage-placement': {
    title: 'Faza Placement',
    scenes: [
      { caption: 'Pas Hire karta qëndron te Placement dhe personi është te Active Employees.', target: 'card', screen: board(emptyBoard({ Placement: ana('Active', 'green', 'card') })) },
      { caption: 'Hap kartën: sheh pagën dhe butonat Completed dhe Terminated.', target: 'buttons', ms: 4200, screen: <Overlay><Panel title="Ana Dodaj   ·   permanent job 2" width={560}><p className="mb-2 rounded-md bg-slate-100 px-3 py-2 text-[12px]">£200/h · £33,600/mo · fee 15%</p><div data-demo="buttons" className="flex gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5"><Btn tone="green">Completed</Btn><Btn tone="red">Terminated</Btn></div></Panel></Overlay> },
      { caption: 'Karta nuk largohet vetë: qëndron derisa të shtypësh Completed ose Terminated.', target: 'card', screen: board(emptyBoard({ Placement: ana('Active', 'green', 'card') })) },
    ],
  },
  'stage-completed': {
    title: 'Faza Completed',
    scenes: [
      { caption: 'Kur shtyp "Completed" te Placement, karta vjen te Completed.', target: 'col-Completed', screen: board(emptyBoard({ Completed: ana('Contract completed', 'navy', 'card') })) },
      { caption: 'Personi mbetet te Active Employees; karta qëndron në kolonë.', target: 'row-0', screen: <MockApp active="Active Employees" title="Active Employees"><Table head={['Employee', 'Job', 'Type']} rows={[['Ana Dodaj', 'permanent job 2', 'Permanent']]} highlight={0} /></MockApp> },
      { caption: 'Kur plotësohen të gjitha vendet, kartat dalin nga pipeline dhe puna kalon te Completed Jobs.', target: 'row-0', screen: <MockApp active="Completed Jobs" title="Completed Jobs"><Table head={['Job title', 'Client', 'Filled']} rows={[['permanent job 2', 'Company', '2 of 2']]} highlight={0} /></MockApp> },
    ],
  },
  // ------------------------------------------------------------------------------------ temporary pipeline phases
  'temp-screening': {
    title: 'Faza Screening',
    scenes: [
      { caption: 'Kandidati hyn te Screening me "Add to pipeline" (zgjedh Screening ose direkt Active).', target: 'card', screen: <MockApp active="Pipeline Jobs" title="Pipeline Jobs"><Board><Column title="Screening" count={1}><PCard id="card" name="Ana Dodaj" job="jobs2" tag="Screening" tone="violet" /></Column><Column title="Active" count={0} /><Column title="Completed" count={0} /></Board></MockApp> },
      { caption: 'Hap kartën: lexo të dhënat dhe CV-në; shtyp Active, No Show ose Reject.', target: 'buttons', ms: 4200, screen: <Overlay><Panel title="Ana Dodaj   ·   jobs2" width={560}><div data-demo="buttons" className="flex gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5"><Btn tone="green">Active</Btn><Btn tone="amber">No Show</Btn><Btn tone="red">Reject</Btn></div></Panel></Overlay> },
    ],
  },
  'temp-active': {
    title: 'Faza Active',
    scenes: [
      { caption: 'Active hap tabelën e pagës; pasi konfirmohet, personi fillon punë.', target: 'pay', ms: 4200, screen: over('Pipeline Jobs', 'Pipeline Jobs', <div />, <Panel title="Active — pay for Ana Dodaj" width={540} footer={<Btn tone="outline">Confirm pay</Btn>}><div data-demo="pay" className="grid grid-cols-4 gap-2"><Field label="Rate / hour" value="18" /><Field label="Currency" value="GBP" /><Field label="Hours / day" value="8" /><Field label="Days / month" value="21" /></div></Panel>) },
      { caption: 'Karta është te Active dhe personi te Active Employees.', target: 'card', screen: <MockApp active="Pipeline Jobs" title="Pipeline Jobs"><Board><Column title="Screening" count={0} /><Column title="Active" count={1}><PCard id="card" name="Ana Dodaj" job="jobs2" tag="Active" tone="green" /></Column><Column title="Completed" count={0} /></Board></MockApp> },
      { caption: 'Puna del te Active Jobs Temporary, me njerëzit që punojnë.', target: 'row-0', screen: <MockApp active="Active Jobs Temporary" title="Active Jobs Temporary"><Table head={['Job title', 'Client', 'Active', 'Employees']} rows={[['jobs2', 'jobs2', '1 of 2', 'Ana Dodaj']]} highlight={0} /></MockApp> },
    ],
  },
  'temp-completed': {
    title: 'Faza Completed (Temporary)',
    scenes: [
      { caption: 'Kur puna mbaron, hap kartën te Active dhe shtyp "Completed".', target: 'done', screen: <Overlay><Panel title="Ana Dodaj   ·   jobs2" width={520}><div className="flex gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5"><Btn id="done" tone="green" pulse>Completed</Btn></div></Panel></Overlay> },
      { caption: 'Karta kalon te Completed; personi mbetet te Active Employees.', target: 'card', screen: <MockApp active="Pipeline Jobs" title="Pipeline Jobs"><Board><Column title="Screening" count={0} /><Column title="Active" count={0} /><Column title="Completed" count={1}><PCard id="card" name="Ana Dodaj" job="jobs2" tag="Contract completed" tone="navy" /></Column></Board></MockApp> },
    ],
  },
  'pipeline-companies': {
    title: 'Pipeline Companies',
    scenes: [
      { caption: 'Çdo kolonë është një fazë e marrëdhënies me kompaninë: New, In conversation, Signed, Lost.', target: 'board', screen: <MockApp active="Pipeline Companies" title="Pipeline Companies"><div data-demo="board" className="flex gap-2"><Column title="New" count={1}><PCard name="Brick & Co" job="Building" tag="New" tone="navy" /></Column><Column title="In conversation" count={1}><PCard name="Acme Ltd" job="Construction" tag="Follow-up" tone="violet" /></Column><Column title="Signed" count={0} /><Column title="Lost" count={0} /></div></MockApp> },
      { caption: 'Tërhiq kartën e kompanisë te faza tjetër.', target: 'col-Signed', carry: 'Acme Ltd', screen: <MockApp active="Pipeline Companies" title="Pipeline Companies"><div className="flex gap-2"><Column title="New" count={0} /><Column title="In conversation" count={0} /><Column id="col-Signed" title="Signed" count={0} highlight /><Column title="Lost" count={0} /></div></MockApp> },
      { caption: 'Për të kaluar te "Signed" duhet një dokument si provë (p.sh. kontrata).', target: 'proof', ms: 4200, screen: over('Pipeline Companies', 'Pipeline Companies', <div />, <Panel title="Acme Ltd → Signed" width={460} footer={<Btn tone="outline">Save</Btn>}><div data-demo="proof"><DropZone label="Upload a document as proof" /></div></Panel>) },
    ],
  },
  // ------------------------------------------------------------------------------------------------------- lists
  'list-employees': {
    title: 'Active Employees',
    scenes: [
      { caption: 'Hap Active Employees dhe zgjidh Permanent ose Temporary.', target: 'toggle', screen: <MockApp active="Active Employees" title="Active Employees"><div data-demo="toggle" className="mb-3 inline-flex gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1 text-[12px]"><span className="rounded-md bg-slate-900 px-3 py-1 text-white">Permanent</span><span className="px-3 py-1">Temporary</span></div><Table head={['Employee', 'Job', 'Company', 'Pay']} rows={[['Ana Dodaj', 'permanent job 2', 'Company', '£200/h'], ['Besnik Krasniqi', 'Electrician', 'Acme Ltd', '£25/h']]} /></MockApp> },
      { caption: 'Klikoje një rresht për të parë punën, kompaninë, fillimin dhe pagën.', target: 'row-0', screen: <MockApp active="Active Employees" title="Active Employees"><Table head={['Employee', 'Job', 'Company', 'Pay']} rows={[['Ana Dodaj', 'permanent job 2', 'Company', '£200/h'], ['Besnik Krasniqi', 'Electrician', 'Acme Ltd', '£25/h']]} highlight={0} /></MockApp> },
      { caption: 'Lapsi e ndryshon kontratën, koshi e fshin. Asgjë nuk largohet vetvetiu.', target: 'edit', screen: <MockApp active="Active Employees" title="Active Employees"><Table head={['Employee', 'Job', 'Company', '']} rows={[['Ana Dodaj', 'permanent job 2', 'Company', <span key="e" data-demo="edit">✎   🗑</span>]]} /></MockApp> },
    ],
  },
  'list-active-temporary': {
    title: 'Active Jobs Temporary',
    scenes: [
      { caption: 'Punët Temporary që kanë njerëz që punojnë tani, me sa vende janë mbushur.', target: 'row-0', screen: <MockApp active="Active Jobs Temporary" title="Active Jobs Temporary"><Table head={['Job title', 'Client', 'Active', 'Employees']} rows={[['jobs2', 'jobs2', '1 of 2', 'Ana Dodaj']]} highlight={0} /></MockApp> },
      { caption: 'Klikoje punën: sheh orarin, turnet dhe njerëzit e saj.', target: 'panel', ms: 4200, screen: over('Active Jobs Temporary', 'Active Jobs Temporary', <div />, <Panel title="jobs2" drawer width={420}><div data-demo="panel" className="space-y-2 text-[12px]"><p className="rounded-md bg-slate-100 px-3 py-2">Mon–Fri · 8 h · 1 Dec – 31 Jan</p><p className="rounded-md border border-slate-200 px-3 py-2">Ana Dodaj <span className="float-right text-blue-700">Replace</span></p></div></Panel>, true) },
      { caption: 'Zëvendëso një person nga paneli kur nevojitet.', target: 'rep', screen: over('Active Jobs Temporary', 'Active Jobs Temporary', <div />, <Panel title="Replace Ana Dodaj" width={420} footer={<Btn tone="outline">Replace</Btn>}><div data-demo="rep"><Field label="Replace with" value="Besnik Krasniqi" /></div></Panel>) },
    ],
  },
  'list-completed-jobs': {
    title: 'Completed Jobs',
    scenes: [
      { caption: 'Punët me të gjitha vendet e mbushura vijnë këtu vetë.', target: 'row-0', screen: <MockApp active="Completed Jobs" title="Completed Jobs"><Table head={['Job title', 'Client', 'Filled']} rows={[['permanent job 2', 'Company', '2 of 2']]} highlight={0} /></MockApp> },
      { caption: 'Hape punën për të parë kush punon në të.', target: 'people', screen: <MockApp active="Completed Jobs" title="permanent job 2"><div data-demo="people" className="rounded-lg border border-slate-200 bg-white p-3 text-[12px]"><p className="mb-2 font-semibold">People on this job</p><p className="py-1">Ana Dodaj · Permanent</p><p className="py-1">Besnik Krasniqi · Permanent</p></div></MockApp> },
    ],
  },
  // ---------------------------------------------------------------------------------------------------- revenue
  fees: {
    title: 'Fees',
    scenes: [
      { caption: 'Lart janë kartat: Permanent placements, Draft invoices, Sent awaiting payment, Overdue, Paid this year.', target: 'tiles', screen: <MockApp active="Fees" title="Fees" action={<Btn>+ Add fee</Btn>}><div data-demo="tiles" className="grid grid-cols-5 gap-2"><Tile label="Permanent placements" value="12" /><Tile label="Draft invoices" value="£8,400" tone="amber" /><Tile label="Sent, awaiting payment" value="£12,000" tone="blue" /><Tile label="Overdue" value="£1,500" tone="red" /><Tile label="Paid this year" value="£64,200" tone="green" /></div></MockApp> },
      { caption: '"Permanent placements without a fee" liston njerëzit e punësuar pa tarifë: shtyp "Add fee terms".', target: 'addfee', screen: <MockApp active="Fees" title="Fees"><div className="rounded-lg border border-slate-200 bg-white p-3"><p className="mb-2 text-[12px] font-semibold">Permanent placements without a fee (2)</p><Table head={['Candidate', 'Job', 'Client', '']} rows={[['Ana Dodaj', 'permanent job 2', 'Company', <Btn key="a" id="addfee" small pulse>Add fee terms</Btn>]]} /></div></MockApp> },
      { caption: 'Vendos tarifën; pastaj ndiq statusin: Mark sent, pastaj Mark paid.', target: 'mark', screen: <MockApp active="Fees" title="Fees"><Table head={['Candidate', 'Client fee', 'Status', '']} rows={[['Ana Dodaj', '£5,040', <Tag key="s" tone="amber">Draft</Tag>, <Btn key="m" id="mark" small pulse>Mark sent</Btn>]]} /></MockApp> },
    ],
  },
  retainers: {
    title: 'Retainers',
    scenes: [
      { caption: 'Retainers: marrëveshjet me para paraprakisht me klientët.', target: 'add', screen: <MockApp active="Retainers" title="Retainers" action={<Btn id="add" pulse>+ Add retainer</Btn>}><Table head={['Client', 'Amount', 'Ends', 'Status']} rows={[['Acme Ltd', '£5,000', '31 Mar', <Tag key="a" tone="green">Active</Tag>]]} /></MockApp> },
      { caption: 'Vendos klientin, shumën, datat dhe afatin; marrëveshja skadon vetë kur mbaron data.', target: 'form', ms: 4200, screen: over('Retainers', 'Retainers', <div />, <Panel title="Add retainer" width={440} footer={<Btn tone="outline">Save</Btn>}><div data-demo="form" className="grid grid-cols-2 gap-2"><Field label="Client" value="Acme Ltd" /><Field label="Amount" value="5000" /><Field label="Starts" value="2026-01-01" /><Field label="Ends" value="2026-03-31" /></div></Panel>) },
    ],
  },
  timesheets: {
    title: 'Timesheets',
    scenes: [
      { caption: 'Zgjidh javën dhe shtyp "Add timesheet".', target: 'add', screen: <MockApp active="Timesheets" title="Timesheets" action={<Btn id="add" pulse>+ Add timesheet</Btn>}><Table head={['Worker', 'Client', 'Days / hours', 'Net pay', 'Status']} rows={[['Besnik Krasniqi', 'Acme Ltd', '5 days', '£620', <Tag key="p" tone="amber">Pending</Tag>]]} /></MockApp> },
      { caption: 'Zgjidh punonjësin dhe klientin dhe vendos ditët ose orët e çdo dite.', target: 'days', ms: 4200, screen: over('Timesheets', 'Timesheets', <div />, <Panel title="Add timesheet" width={520} footer={<Btn tone="outline">Save</Btn>}><div className="grid grid-cols-2 gap-2"><Field label="Worker" value="Besnik Krasniqi" /><Field label="Client" value="Acme Ltd" /></div><div data-demo="days" className="mt-2 grid grid-cols-5 gap-1 text-center text-[11px]">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((day) => <div key={day} className="rounded border border-slate-300 py-2">{day}<br /><b>1</b></div>)}</div></Panel>) },
      { caption: 'Hape për të parë llogaritjet: bruto, neto, tarifa e klientit dhe fitimi; aprovoje që të kalojë te paga.', target: 'approve', screen: <MockApp active="Timesheets" title="Besnik Krasniqi · week 46" action={<Btn id="approve" pulse>Approve</Btn>}><div className="grid grid-cols-4 gap-2"><Tile label="Gross" value="£750" /><Tile label="Net pay" value="£620" /><Tile label="Client charge" value="£875" /><Tile label="Profit" value="£125" tone="green" /></div></MockApp> },
    ],
  },
  payroll: {
    title: 'Weekly payroll',
    scenes: [
      { caption: 'Zgjidh javën dhe kontrollo përmbledhjen: kush është aprovuar, kush pret.', target: 'tiles', screen: <MockApp active="Weekly payroll" title="Weekly payroll"><div data-demo="tiles" className="grid grid-cols-4 gap-2"><Tile label="Awaiting authorisation" value="£4,200" tone="amber" /><Tile label="Authorised" value="£3,100" tone="blue" /><Tile label="Paid" value="£8,900" tone="green" /><Tile label="Warnings" value="1" tone="red" /></div></MockApp> },
      { caption: 'Shëno rreshtat dhe shtyp "Authorise" për pagesat.', target: 'auth', screen: <MockApp active="Weekly payroll" title="Weekly payroll" action={<Btn id="auth" pulse>Authorise 2</Btn>}><Table head={['Worker', 'Client', 'Net pay', 'Payment']} rows={[['Besnik Krasniqi', 'Acme Ltd', '£620', <Tag key="a" tone="amber">Unpaid</Tag>], ['Eda Berisha', 'Brick & Co', '£540', <Tag key="b" tone="amber">Unpaid</Tag>]]} checks checked={[0, 1]} /></MockApp> },
      { caption: 'Pas pagesës shëno si të paguara dhe shkarko payslips për të shënuarit.', target: 'dl', screen: <MockApp active="Weekly payroll" title="Weekly payroll" action={<><Btn tone="outline">Mark paid</Btn><Btn id="dl" pulse>Download payslips</Btn></>}><Table head={['Worker', 'Client', 'Net pay', 'Payment']} rows={[['Besnik Krasniqi', 'Acme Ltd', '£620', <Tag key="a" tone="green">Paid</Tag>], ['Eda Berisha', 'Brick & Co', '£540', <Tag key="b" tone="green">Paid</Tag>]]} checks checked={[0, 1]} /></MockApp> },
    ],
  },
  payslips: {
    title: 'Payslips',
    scenes: [
      { caption: 'Kërko punonjësin te Payslips.', target: 'search', screen: <MockApp active="Payslips" title="Payslips"><div className="mb-3 w-[260px]"><Field id="search" label="Search" value="Besnik" /></div><Table head={['Worker', 'Week', 'Net pay']} rows={[['Besnik Krasniqi', 'Week 46', '£620']]} /></MockApp> },
      { caption: 'Hape një payslip për ta parë ose shkarkuar; kur e dërgon, shëno si të lëshuar.', target: 'open', screen: <MockApp active="Payslips" title="Payslips"><Table head={['Worker', 'Week', 'Net pay', '']} rows={[['Besnik Krasniqi', 'Week 46', '£620', <Btn key="o" id="open" small pulse>Open</Btn>]]} /></MockApp> },
    ],
  },
  commission: {
    title: 'Commission',
    scenes: [
      { caption: 'Zgjidh muajin dhe shiko tabelën për çdo rekrutues.', target: 'table', screen: <MockApp active="Commission" title="Commission"><div data-demo="table"><Table head={['Resourcer', '%', 'Billing', 'Profit', 'Commission']} rows={[['Aurora Merolli', '10%', '£12,000', '£3,000', '£300'], ['Gabriela Foto', '8%', '£9,500', '£2,100', '£168']]} /></div></MockApp> },
      { caption: 'Regjistro pagesat e komisionit që janë bërë.', target: 'paid', screen: <MockApp active="Commission" title="Commission"><div className="rounded-lg border border-slate-200 bg-white p-3 text-[12px]"><p className="mb-2 font-semibold">Commission paid</p><p data-demo="paid" className="rounded-md bg-emerald-50 px-3 py-2">Aurora Merolli · £300 · 30 Nov</p></div></MockApp> },
    ],
  },
  // ---------------------------------------------------------------------------------------------- administration
  profile: {
    title: 'My Profile dhe përdoruesit',
    scenes: [
      { caption: 'Admini sheh listën e përdoruesve me numrat e secilit.', target: 'row-1', screen: <MockApp active="Settings" title="My Profile" action={<Btn>+ Add Instructor</Btn>}><Table head={['Name', 'Role', 'Companies', 'Jobs', 'Candidates', 'Status']} rows={[['Admin Admin', <Tag key="a" tone="navy">Admin</Tag>, '3', '3', '8', <Tag key="s" tone="green">ACTIVE</Tag>], ['Aurora Merolli', <Tag key="r" tone="sky">Recruiter</Tag>, '0', '0', '0', <Tag key="t" tone="green">ACTIVE</Tag>]]} /></MockApp> },
      { caption: 'Për të shtuar një përdorues shtyp "Add Instructor": zgjidh rolin (Admin, Recruiter, Manager) dhe statusin (Active, Deactivated).', target: 'role', ms: 4400, screen: over('Settings', 'My Profile', <div />, <Panel title="Add Instructor" width={460} footer={<Btn tone="outline">Create</Btn>}><div className="grid grid-cols-2 gap-2"><Field label="First name" value="Rudi" /><Field label="Last name" value="Lengu" /><Field label="Email" value="rudi@dcsolutions" wide /><Field id="role" label="Role" value="Recruiter" /><Field label="Status" value="Active" /></div></Panel>) },
      { caption: 'Klikimi i një përdoruesi hap faqen e tij me tre skeda: Companies, Jobs, Candidates që ka shtuar.', target: 'tabs', screen: <MockApp active="Settings" title="Aurora Merolli"><div data-demo="tabs" className="grid grid-cols-3 gap-2 text-[12px]"><Tile label="Companies added by Aurora" value="4" /><Tile label="Jobs added by Aurora" value="7" /><Tile label="Candidates added by Aurora" value="23" /></div></MockApp> },
    ],
  },
  notifications: {
    title: 'Notifications',
    scenes: [
      { caption: 'Njoftimet grupohen sipas llojit: Candidates, Hires, Tasks, Calendar, Needs attention, Pay & fees.', target: 'cats', screen: <MockApp active="Settings" title="Notifications"><div data-demo="cats" className="grid grid-cols-6 gap-2 text-[11px]">{['All', 'Candidates', 'Hires & placements', 'Tasks', 'Calendar', 'Needs attention'].map((c, i) => <div key={c} className={`rounded-lg border p-2 ${i === 0 ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white'}`}><b>{c}</b><p className="text-slate-500">{[9, 4, 2, 1, 1, 1][i]}</p></div>)}</div></MockApp> },
      { caption: 'Klikoje një njoftim për të shkuar te vendi përkatës.', target: 'n1', screen: <MockApp active="Settings" title="Notifications"><div className="rounded-lg border border-slate-200 bg-white text-[12px]"><p data-demo="n1" className="border-b border-slate-100 px-3 py-2.5"><b>New candidate: Theodhos Lupe</b><br /><span className="text-slate-500">Added manually · Candidates · 2 min ago</span></p><p className="px-3 py-2.5">Ana Dodaj hired · Hires &amp; placements</p></div></MockApp> },
      { caption: '"Mark read" ose "Mark all read" i heq të palexuarat.', target: 'all', screen: <MockApp active="Settings" title="Notifications" action={<><Btn tone="outline">Unread only</Btn><Btn id="all" pulse>Mark all read</Btn></>}><div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[12px]">All caught up.</div></MockApp> },
    ],
  },
  settings: {
    title: 'Settings',
    scenes: [
      { caption: 'Settings ka skedat: My account, Organisation, Connections & API dhe Manual përdorimi.', target: 'tabs', screen: <MockApp active="Settings" title="Settings"><div data-demo="tabs" className="flex gap-2 text-[12px]">{['My account', 'Organisation', 'Connections & API', 'Manual përdorimi'].map((t, i) => <span key={t} className={`rounded-lg border px-3 py-2 ${i === 0 ? 'border-blue-500 bg-blue-50 font-semibold' : 'border-slate-200 bg-white'}`}>{t}</span>)}</div></MockApp> },
      { caption: 'My account: ndrysho emrin; "Change password" dërgon një lidhje në e-mail.', target: 'pw', screen: <MockApp active="Settings" title="Settings"><div className="grid max-w-[420px] gap-2"><Field label="First name" value="Admin" /><Field label="Last name" value="Admin" /><div><Btn id="pw" pulse>Change password</Btn></div></div></MockApp> },
    ],
  },
  zoom: {
    title: 'Lidhja me Zoom',
    scenes: [
      { caption: 'Hap Settings → Connections & API → Zoom.', target: 'zoom', screen: <MockApp active="Settings" title="Settings"><div className="mb-3 inline-flex gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1 text-[12px]"><span className="px-3 py-1">Dialpad</span><span data-demo="zoom" className="rounded-md bg-slate-900 px-3 py-1 font-medium text-white">Zoom</span><span className="px-3 py-1">File storage</span></div><p className="text-[13px] font-semibold">Zoom <Tag tone="amber">Not connected</Tag></p></MockApp> },
      { caption: 'Vendos Account ID, Client ID dhe Client Secret nga aplikacioni Server-to-Server OAuth i Zoom.', target: 'fields', ms: 4400, screen: <MockApp active="Settings" title="Settings"><div data-demo="fields" className="grid max-w-[380px] gap-2"><Field label="Account ID" value="aBcD1234" /><Field label="Client ID" value="xYz98765" /><Field label="Client Secret" value="••••••••••••" /></div></MockApp> },
      { caption: 'Shtyp "Connect Zoom": kontrollohet me Zoom para ruajtjes. Pastaj intervistat krijohen automatikisht.', target: 'status', screen: <MockApp active="Settings" title="Settings"><p data-demo="status" className="text-[13px] font-semibold">Zoom <Tag tone="green">Connected</Tag></p></MockApp> },
    ],
  },
  storage: {
    title: 'File storage',
    scenes: [
      { caption: 'Hap Settings → Connections & API → File storage: shihet ku ruhen skedarët tani.', target: 'status', screen: <MockApp active="Settings" title="Settings"><p data-demo="status" className="text-[13px] font-semibold">File storage <Tag tone="green">In use: Google Drive</Tag></p></MockApp> },
      { caption: 'Zgjidh ruajtjen (Google Drive, S3, disku i serverit) dhe vendos të dhënat; secretet maskohen.', target: 'fields', ms: 4400, screen: <MockApp active="Settings" title="Settings"><div data-demo="fields" className="grid max-w-[400px] gap-2"><Field label="Storage" value="Google Drive" /><Field label="Client ID" value="1234-abcd.apps.googleusercontent.com" /><Field label="Client secret" value="••••••••a1b2" /><Field label="Refresh token" value="••••••••x9z8" /></div></MockApp> },
      { caption: 'Shtyp "Test and save": provohet lidhja para ruajtjes; nëse dështon, nuk ruhet.', target: 'save', screen: <MockApp active="Settings" title="Settings"><div className="max-w-[400px]"><Btn id="save" pulse>Test and save</Btn></div></MockApp> },
    ],
  },
};

export const DEMO_BY_TOPIC_MORE: Record<string, string> = {
  'start/flow': 'flow',
  'dashboard/overview': 'dashboard',
  'candidates/import': 'import',
  'candidates/filters': 'filters',
  'candidates/export': 'export',
  'candidates/detail': 'candidate-detail',
  'jobs/detail': 'job-detail',
  'jobs/website': 'website',
  'companies/add': 'company-add',
  'companies/detail': 'company-detail',
  'pipeline-permanent/card': 'pp-card',
  'pipeline-permanent/sentcv': 'stage-sentcv',
  'pipeline-permanent/interview1': 'stage-interview1',
  'pipeline-permanent/interview2': 'stage-interview2',
  'pipeline-permanent/rejected': 'stage-rejected',
  'pipeline-permanent/placement': 'stage-placement',
  'pipeline-permanent/completedstage': 'stage-completed',
  'pipeline-temporary/screening': 'temp-screening',
  'pipeline-temporary/active': 'temp-active',
  'pipeline-temporary/completedtemp': 'temp-completed',
  'pipeline-companies/flow': 'pipeline-companies',
  'lists/employees': 'list-employees',
  'lists/active-temporary': 'list-active-temporary',
  'lists/completed-jobs': 'list-completed-jobs',
  'revenue/fees': 'fees',
  'revenue/retainers': 'retainers',
  'revenue/timesheets': 'timesheets',
  'revenue/payroll': 'payroll',
  'revenue/payslips': 'payslips',
  'revenue/commission': 'commission',
  'administration/profile': 'profile',
  'administration/notifications': 'notifications',
  'administration/settings': 'settings',
  'administration/zoom': 'zoom',
  'administration/storage': 'storage',
};
