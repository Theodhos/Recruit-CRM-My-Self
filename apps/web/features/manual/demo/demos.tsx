import type { ReactNode } from 'react';

import type { DemoScene } from './player';
import { Board, Btn, Column, DropZone, Field, MockApp, Notice, Overlay, Panel, PCard, Table, Tag, Toast } from './mock';

/**
 * The demos of the manual — one for each main process, drawn with the platform's own screens and labels (see mock.tsx).
 * A topic of the manual points at one of them by its id (`demo` in manual-content.ts).
 */
export interface DemoDefinition {
  title: string;
  scenes: DemoScene[];
}

export const candidateRows = (extra?: ReactNode[]): ReactNode[][] => [
  ...(extra ? [extra] : []),
  ['Ana Dodaj', '+44 7700 900123', 'Website', <Tag key="a" tone="green">Available</Tag>],
  ['Besnik Krasniqi', '+44 7700 900456', 'Manual', <Tag key="b" tone="green">Available</Tag>],
  ['Eda Berisha', '+355 69 111 2233', 'Excel', <Tag key="c" tone="amber">On hold</Tag>],
];
export const CANDIDATE_HEAD = ['Name', 'Phone', 'Source', 'Status'];

export const board = (columns: { title: string; cards?: ReactNode; count?: number; id?: string; highlight?: boolean; note?: string }[], overlay?: ReactNode, toast?: ReactNode) => (
  <MockApp active="Pipeline Jobs" title="Pipeline Jobs" action={<><Btn tone="outline" small>Undo</Btn><Btn tone="outline" small>Redo</Btn></>} dim={Boolean(overlay)}>
    <div className="mb-2 flex gap-2 text-[11px]">
      <span className="rounded-md bg-slate-900 px-2.5 py-1 font-semibold text-white">Permanent</span>
      <span className="rounded-md border border-slate-300 bg-white px-2.5 py-1">Temporary</span>
    </div>
    <Board>
      {columns.map((column) => (
        <Column key={column.title} id={column.id} title={column.title} count={column.count ?? (column.cards ? 1 : 0)} highlight={column.highlight} note={column.note}>
          {column.cards}
        </Column>
      ))}
      </Board>
    {overlay}
    {toast}
  </MockApp>
);

const STAGES = ['Sent CV', 'Interview 1', 'Interview 2', 'Rejected', 'Placement', 'Completed'];
export const emptyBoard = (cardsIn: Record<string, ReactNode>, extra: Record<string, { id?: string; highlight?: boolean; note?: string }> = {}) =>
  STAGES.map((title) => ({ title, cards: cardsIn[title], id: extra[title]?.id ?? `col-${title}`, highlight: extra[title]?.highlight, note: extra[title]?.note }));

export const ana = (tag: string, tone: 'navy' | 'violet' | 'sky' | 'green' | 'amber' | 'red', id?: string, pulse?: boolean) => <PCard id={id} name="Ana Dodaj" tag={tag} tone={tone} pulse={pulse} />;

/** A pop-up of a card, as the platform opens it: who, the buttons of the stage on top, the history under. */
export const cardDialog = (stage: string, buttons: ReactNode, body?: ReactNode) => (
  <Overlay>
    <Panel title="Ana Dodaj   ·   permanent job 2" width={620}>
      <p className="mb-2 text-[11px] text-slate-500">Stage <Tag tone={stage === 'Sent CV' ? 'navy' : stage === 'Interview 1' ? 'violet' : 'sky'}>{stage}</Tag></p>
      <div className="mb-3 grid grid-cols-3 gap-2 rounded-lg border border-slate-200 p-2 text-[11px]">
        <div><p className="text-slate-400">Full name</p><p className="font-semibold">Ana Dodaj</p></div>
        <div><p className="text-slate-400">E-mail</p><p className="font-semibold">ana@example.com</p></div>
        <div><p className="text-slate-400">Phone</p><p className="font-semibold">+44 7700 900123</p></div>
      </div>
      <div data-demo="buttons" className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5">{buttons}</div>
      {body}
      <p className="mb-1 text-[12px] font-semibold">History</p>
      <div className="h-[60px] rounded-md border border-slate-200 p-2 text-[11px] text-slate-400">Write what matters about this candidate at this stage…</div>
    </Panel>
  </Overlay>
);

export const DEMOS: Record<string, DemoDefinition> = {
  // ------------------------------------------------------------------------------------------------ candidates
  'add-candidate': {
    title: 'Shtimi i një kandidati me CV',
    scenes: [
      { caption: 'Hap Candidates dhe shtyp "Add Candidate".', target: 'add', screen: <MockApp active="Candidates" title="Candidates" action={<><Btn tone="outline">Import Excel</Btn><Btn id="add" pulse>+ Add Candidate</Btn></>}><Table head={CANDIDATE_HEAD} rows={candidateRows()} checks /></MockApp> },
      { caption: 'Hidh CV-në në kutinë e dokumentit. Pranohet çdo lloj dokumenti.', target: 'drop', carry: 'Theodhos Lupe CV.pdf', ms: 4200, screen: <MockApp active="Candidates" title="Candidates" dim><Table head={CANDIDATE_HEAD} rows={candidateRows()} checks /><Overlay side="right"><Panel title="Add Candidate" drawer width={400} footer={<Btn tone="outline">Create candidate</Btn>}><DropZone id="drop" /><div className="grid gap-2"><Field label="First name" /><Field label="Last name" /><Field label="Phone" /><Field label="Location" /></div></Panel></Overlay></MockApp> },
      { caption: 'Platforma e lexon dhe plotëson First name, Last name, Phone, Location, Job title dhe Trade. Kontrollo fushat.', target: 'fields', ms: 4200, screen: <MockApp active="Candidates" title="Candidates" dim><Overlay side="right"><Panel title="Add Candidate" drawer width={400} footer={<Btn tone="outline">Create candidate</Btn>}><DropZone filled="Theodhos Lupe CV.pdf" /><div data-demo="fields" className="grid gap-2"><Field label="First name" value="Theodhos" /><Field label="Last name" value="Lupe" /><Field label="Phone" value="+355 69 788 3395" /><Field label="Location" value="Korce, Albania" /></div></Panel></Overlay></MockApp> },
      { caption: 'Zgjidh Source dhe "Added by" nëse duhet, pastaj shtyp "Create candidate".', target: 'create', screen: <MockApp active="Candidates" title="Candidates" dim><Overlay side="right"><Panel title="Add Candidate" drawer width={400} footer={<Btn id="create" tone="outline" pulse>Create candidate</Btn>}><DropZone filled="Theodhos Lupe CV.pdf" /><div className="grid gap-2"><Field label="Location" value="Korce, Albania" /><Field label="Source" value="Manual" /><Field label="Added by" value="Me (the one adding it)" /></div></Panel></Overlay></MockApp> },
      { caption: 'Kandidati është në listë. CV-ja ruhet me të.', target: 'row-0', screen: <MockApp active="Candidates" title="Candidates" action={<Btn>+ Add Candidate</Btn>}><Table head={CANDIDATE_HEAD} rows={candidateRows(['Theodhos Lupe', '+355 69 788 3395', 'Manual', <Tag key="n" tone="green">Available</Tag>])} highlight={0} checks /></MockApp> },
    ],
  },
  duplicate: {
    title: 'Njoftimi për dublikim',
    scenes: [
      { caption: 'Shton një kandidat që ekziston tashmë (i njëjti telefon, e-mail ose emër).', target: 'create', screen: <MockApp active="Candidates" title="Candidates" dim><Overlay side="right"><Panel title="Add Candidate" drawer width={400} footer={<Btn id="create" tone="outline" pulse>Create candidate</Btn>}><div className="grid gap-2"><Field label="First name" value="Ana" /><Field label="Last name" value="Dodaj" /><Field label="Phone" value="07700 900123" /></div></Panel></Overlay></MockApp> },
      { caption: 'Nuk ruhet: del njoftimi "Already in the system" në mes të ekranit.', target: 'ok', ms: 4200, screen: <MockApp active="Candidates" title="Candidates" dim><Overlay><Notice id="ok" title="Already in the system">This candidate is already in the system: Ana Dodaj has the same phone number. It was not added again.</Notice></Overlay></MockApp> },
      { caption: 'Shtyp OK. Formulari mbetet i hapur që të korrigjosh. Njoftimi nuk del dy herë.', target: 'create', screen: <MockApp active="Candidates" title="Candidates" dim><Overlay side="right"><Panel title="Add Candidate" drawer width={400} footer={<Btn id="create" tone="outline">Create candidate</Btn>}><div className="grid gap-2"><Field label="First name" value="Ana" /><Field label="Last name" value="Dodaj" /><Field label="Phone" value="07700 900123" /></div></Panel></Overlay></MockApp> },
    ],
  },
  'add-to-pipeline': {
    title: 'Vendosja e kandidatëve te pipeline',
    scenes: [
      { caption: 'Shëno kandidatin me kutinë në fillim të rreshtit.', target: 'check-0', screen: <MockApp active="Candidates" title="Candidates"><Table head={CANDIDATE_HEAD} rows={candidateRows()} checks checked={[]} /></MockApp> },
      { caption: 'Shtyp "Add to pipeline" te shiriti i zgjedhjes.', target: 'bar', screen: <MockApp active="Candidates" title="Candidates"><Table head={CANDIDATE_HEAD} rows={candidateRows()} checks checked={[0]} /><div className="mt-3 flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-100 px-4 py-3 text-[12px]"><b>1 candidate selected</b><Btn id="bar" pulse>Add to pipeline</Btn></div></MockApp> },
      { caption: 'Zgjidh punën (ose disa punë). Ka kërkim dhe ndarje Permanent / Temporary.', target: 'job', ms: 4200, screen: <MockApp active="Candidates" title="Candidates" dim><Overlay><Panel title="Add 1 candidate to Pipeline Jobs" width={480} footer={<Btn tone="outline">Add to pipeline</Btn>}><div className="mb-2 flex h-8 items-center rounded-md border border-slate-300 px-2 text-[12px] text-slate-400">Search jobs by title, client or location…</div><div className="mb-2 grid grid-cols-3 gap-1 rounded-md bg-slate-100 p-1 text-center text-[11px]"><span className="rounded bg-slate-900 py-1 font-semibold text-white">All jobs (3)</span><span className="py-1">Temporary (1)</span><span className="py-1">Permanent (2)</span></div><div className="rounded-md border border-slate-200 text-[12px]"><p className="border-b border-slate-100 px-2 py-2">☐ Electrician · Acme Ltd · Leeds</p><p data-demo="job" className="border-b border-slate-100 bg-blue-50 px-2 py-2 font-medium">☑ permanent job 2 · Company</p><p className="px-2 py-2">☐ Plumber · Brick &amp; Co</p></div></Panel></Overlay></MockApp> },
      { caption: 'Kandidati hyn te faza e parë, Sent CV, e pipeline-it të punës.', target: 'card', screen: board(emptyBoard({ 'Sent CV': ana('Sent CV', 'navy', 'card') })) },
    ],
  },
  // ---------------------------------------------------------------------------------------------------- jobs
  'add-job': {
    title: 'Shtimi i një pune',
    scenes: [
      { caption: 'Hap Jobs dhe shtyp "Add Job".', target: 'add', screen: <MockApp active="Jobs" title="Jobs" action={<><Btn tone="outline">Import Excel</Btn><Btn tone="outline">Add job title</Btn><Btn id="add" pulse>+ Add Job</Btn></>}><Table head={['Job title', 'Client', 'Type', 'Needed']} rows={[['jobs2', 'jobs2', <Tag key="t" tone="amber">TEMPORARY</Tag>, '1/2'], ['permanent job 2', 'permanent job 2', <Tag key="p" tone="green">PERMANENT</Tag>, '1/2']]} checks /></MockApp> },
      { caption: 'Zgjidh Company dhe një ose më shumë Job title nga lista (me kuti).', target: 'title', ms: 4200, screen: <MockApp active="Jobs" title="Jobs" dim><Overlay side="right"><Panel title="Quick Add Job" drawer width={420} footer={<Btn tone="outline">Save</Btn>}><div className="grid gap-2"><Field label="Company" value="Acme Ltd" /><div data-demo="title"><p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Job title</p><div className="rounded-md border border-slate-300 bg-white p-1.5 text-[11px]"><span className="mr-1 rounded-full bg-blue-100 px-2 py-0.5 text-blue-800">Electrician / Electrical engineer ✕</span><div className="mt-1.5 rounded border border-slate-200 p-1.5"><p>☑ Electrician / Electrical engineer</p><p>☐ Plumber</p></div></div></div></div></Panel></Overlay></MockApp> },
      { caption: 'Plotëso Job Description, Location, Employment type dhe Candidates needed (sa vende ka puna).', target: 'needed', screen: <MockApp active="Jobs" title="Jobs" dim><Overlay side="right"><Panel title="Quick Add Job" drawer width={420} footer={<Btn tone="outline">Save</Btn>}><div className="grid gap-2"><Field label="Job Description" value="Installs and repairs wiring on site" wide /><Field label="Location" value="Leeds" /><Field label="Employment type" value="Permanent" /><Field id="needed" label="Candidates needed *" value="2" /></div></Panel></Overlay></MockApp> },
      { caption: 'Shtyp Save. Nëse e njëjta punë ekziston, nuk ruhet dhe del njoftimi.', target: 'row-0', screen: <MockApp active="Jobs" title="Jobs" action={<Btn>+ Add Job</Btn>}><Table head={['Job title', 'Client', 'Type', 'Needed']} rows={[['Electrician / Electrical engineer', 'Acme Ltd', <Tag key="p" tone="green">PERMANENT</Tag>, '0/2'], ['jobs2', 'jobs2', <Tag key="t" tone="amber">TEMPORARY</Tag>, '1/2']]} highlight={0} checks /></MockApp> },
    ],
  },
  'job-titles': {
    title: 'Titujt e punës',
    scenes: [
      { caption: 'Shtyp "Add job title" te faqja Jobs.', target: 'titles', screen: <MockApp active="Jobs" title="Jobs" action={<><Btn tone="outline">Import Excel</Btn><Btn id="titles" tone="outline" pulse>Add job title</Btn><Btn>+ Add Job</Btn></>}><Table head={['Job title', 'Client', 'Type']} rows={[['jobs2', 'jobs2', 'TEMPORARY']]} /></MockApp> },
      { caption: 'Shkruaj një emër dhe shtyp Enter; shto emra të tjerë për të njëjtën punë.', target: 'names', ms: 4400, screen: <MockApp active="Jobs" title="Jobs" dim><Overlay><Panel title="Job titles" width={480} footer={<Btn tone="outline">Save</Btn>}><p className="mb-1 text-[12px] font-semibold">Add job title</p><div data-demo="names" className="mb-2 flex flex-wrap gap-1"><Tag tone="sky">Electrician ✕</Tag><Tag tone="sky">Electrical engineer ✕</Tag></div><Field label="Another name for the same job…" /></Panel></Overlay></MockApp> },
      { caption: 'Titujt e ruajtur dalin poshtë: lapsi i ndryshon, koshi i fshin, kërkimi i gjen.', target: 'list', screen: <MockApp active="Jobs" title="Jobs" dim><Overlay><Panel title="Job titles" width={480}><div className="mb-2 flex h-8 items-center rounded-md border border-slate-300 px-2 text-[12px] text-slate-400">Search job titles…</div><div data-demo="list" className="divide-y divide-slate-100 rounded-md border border-slate-200 text-[12px]"><p className="flex items-center justify-between px-2 py-2"><span><Tag>Electrician</Tag> <Tag>Electrical engineer</Tag></span><span>✎  🗑</span></p><p className="flex items-center justify-between px-2 py-2"><span><Tag>Plumber</Tag></span><span>✎  🗑</span></p></div></Panel></Overlay></MockApp> },
    ],
  },
  transfer: {
    title: 'Transferimi i punëve te një rekrutues tjetër',
    scenes: [
      { caption: 'Shënoji punët në tabelë, ose shtyp direkt butonin poshtë.', target: 'check-1', screen: <MockApp active="Jobs" title="Jobs"><Table head={['Job title', 'Client', 'Type']} rows={[['Electrician', 'Acme Ltd', 'PERMANENT'], ['permanent job 2', 'Company', 'PERMANENT'], ['jobs2', 'jobs2', 'TEMPORARY']]} checks checked={[1]} /></MockApp> },
      { caption: 'Shtyp "Transfer to another recruiter" në fund të faqes.', target: 'bar', screen: <MockApp active="Jobs" title="Jobs"><Table head={['Job title', 'Client', 'Type']} rows={[['Electrician', 'Acme Ltd', 'PERMANENT'], ['permanent job 2', 'Company', 'PERMANENT'], ['jobs2', 'jobs2', 'TEMPORARY']]} checks checked={[1]} /><div className="absolute bottom-3 left-5 right-5 flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-[12px] shadow"><b>1 job selected</b><Btn id="bar" pulse>↔ Transfer to another recruiter</Btn></div></MockApp> },
      { caption: 'Në dritare kontrollo punët (1) dhe zgjidh një ose më shumë rekrutues (2).', target: 'rec', ms: 4400, screen: <MockApp active="Jobs" title="Jobs" dim><Overlay><Panel title="Transfer jobs to another recruiter" width={680}><div className="grid grid-cols-2 gap-3 text-[11px]"><div><p className="mb-1 font-semibold">1 · Jobs (1 selected)</p><div className="rounded-md border border-slate-200"><p className="px-2 py-1.5">☐ Electrician · Acme Ltd</p><p className="bg-blue-50 px-2 py-1.5 font-medium">☑ permanent job 2 · Company</p></div></div><div><p className="mb-1 font-semibold">2 · Transfer to</p><div data-demo="rec" className="rounded-md border border-slate-200"><p className="px-2 py-1.5">☐ Aurora Merolli</p><p className="bg-blue-50 px-2 py-1.5 font-medium">☑ Gabriela Foto</p><p className="px-2 py-1.5">☐ Rudi Lengu</p></div></div></div></Panel></Overlay></MockApp> },
      { caption: 'Shtyp Transfer. Puna kalon te ai rekrutues; pipeline-i dhe kandidatët mbeten me të.', target: 'go', screen: <MockApp active="Jobs" title="Jobs" dim><Overlay><Panel title="Transfer jobs to another recruiter" width={520} footer={<Btn id="go" tone="outline" pulse>Transfer</Btn>}><p className="rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-[12px] font-medium">→ 1 job → Gabriela Foto</p></Panel></Overlay></MockApp> },
    ],
  },
  // ----------------------------------------------------------------------------------------------- pipeline
  'move-cards': {
    title: 'Lëvizja e kartave në pipeline',
    scenes: [
      { caption: 'Çdo kolonë është një fazë dhe çdo kartë një kandidat për një punë. Kandidati është te Sent CV.', target: 'card', screen: board(emptyBoard({ 'Sent CV': ana('Sent CV', 'navy', 'card') })) },
      { caption: 'Tërhiqe kartën te kolona tjetër me drag and drop...', target: 'col-Interview 1', carry: 'Ana Dodaj', screen: board(emptyBoard({}, { 'Interview 1': { id: 'col-Interview 1', highlight: true } })) },
      { caption: '...ose hape kartën dhe shtyp Interview 1 ose Interview 2.', target: 'buttons', ms: 4200, screen: cardDialog('Sent CV', <><Btn id="b1" tone="purple">Interview 1</Btn><Btn tone="sky">Interview 2</Btn><Btn tone="red">Rejected</Btn><span className="flex-1" /><Btn tone="outline">+ Add CV</Btn><Btn tone="grey">No CV on file</Btn></>) },
      { caption: 'Karta kalon te Interview 1. Undo lart djathtas e kthen veprimin e fundit.', target: 'card', screen: board(emptyBoard({ 'Interview 1': ana('Interview 1', 'violet', 'card') })) },
    ],
  },
  'no-show': {
    title: 'No Show dhe Reject',
    scenes: [
      { caption: 'Kandidati nuk erdhi te intervista. Hape kartën te Interview 1 ose Interview 2.', target: 'card', screen: board(emptyBoard({ 'Interview 2': ana('Interview 2', 'sky', 'card') })) },
      { caption: 'Shtyp "No Show". Hapet një dritare ku shkruan pse kandidati nuk erdhi (shënim i detyrueshëm), pastaj konfirmon.', target: 'noshow', ms: 4200, screen: cardDialog('Interview 2', <><Btn tone="green">Hire</Btn><Btn id="noshow" tone="amber" pulse>No Show</Btn><Btn tone="red">Reject</Btn></>) },
      { caption: 'Kolona Rejected është bosh: kush refuzohet largohet nga pipeline.', target: 'col-Rejected', screen: board(emptyBoard({}, { Rejected: { id: 'col-Rejected', note: 'Rejected people are on Rejected Applicants' } })) },
      { caption: 'Është te Rejected Applicants, me etiketën "No Show". Shënimi mbetet edhe te History.', target: 'row-0', screen: <MockApp active="Rejected Applicants" title="Rejected Applicants"><Table head={['Candidate', 'Job', 'Reason']} rows={[['Ana Dodaj', 'permanent job 2', <Tag key="n" tone="amber">No Show</Tag>]]} highlight={0} /></MockApp> },
    ],
  },
  hire: {
    title: 'Punësimi (Hire) dhe tabela e pagës',
    scenes: [
      { caption: 'Kandidati kalon intervistat. Te Interview 2 shtyp "Hire".', target: 'hire', ms: 4000, screen: cardDialog('Interview 2', <><Btn id="hire" tone="green" pulse>Hire</Btn><Btn tone="amber">No Show</Btn><Btn tone="red">Reject</Btn></>) },
      { caption: 'Hapet tabela e pagës: Rate / hour, Currency, Hours / day, Days / month dhe Fee %.', target: 'pay', ms: 4600, screen: <MockApp active="Pipeline Jobs" title="Pipeline Jobs" dim><Overlay><Panel title="Hire — pay for Ana Dodaj" width={560} footer={<Btn tone="outline">Confirm pay — hire</Btn>}><div data-demo="pay" className="grid grid-cols-5 gap-2"><Field label="Rate / hour" value="200" /><Field label="Currency" value="GBP" /><Field label="Hours / day" value="8" /><Field label="Days / month" value="21" /><Field label="Fee %" value="15" /></div><div className="mt-3 grid grid-cols-3 gap-2 rounded-lg bg-slate-100 p-2 text-[11px]"><p>Per day (8 h)<br /><b>£1,600</b></p><p>Per month (21 days)<br /><b>£33,600</b></p><p>Agency fee / month<br /><b>£5,040</b></p></div></Panel></Overlay></MockApp> },
      { caption: 'Shtyp "Confirm pay — hire". Karta kalon te Placement.', target: 'confirm', screen: <MockApp active="Pipeline Jobs" title="Pipeline Jobs" dim><Overlay><Panel title="Hire — pay for Ana Dodaj" width={560} footer={<Btn id="confirm" tone="outline" pulse>Confirm pay — hire</Btn>}><div className="grid grid-cols-5 gap-2"><Field label="Rate / hour" value="200" /><Field label="Currency" value="GBP" /><Field label="Hours / day" value="8" /><Field label="Days / month" value="21" /><Field label="Fee %" value="15" /></div></Panel></Overlay></MockApp> },
      { caption: 'Kandidati është te Placement dhe te faqja Active Employees.', target: 'row-0', screen: <MockApp active="Active Employees" title="Active Employees"><Table head={['Employee', 'Job', 'Type', 'Pay']} rows={[['Ana Dodaj', 'permanent job 2', <Tag key="p" tone="green">Permanent</Tag>, '£200/h']]} highlight={0} /></MockApp> },
    ],
  },
  completed: {
    title: 'Completed dhe Terminated',
    scenes: [
      { caption: 'Personi i punësuar është te Placement. Hape kartën e tij.', target: 'card', screen: board(emptyBoard({ Placement: ana('Active', 'green', 'card') })) },
      { caption: 'Kur kontrata mbaron shtyp "Completed". "Terminated" e mbyll para kohe, me arsye.', target: 'completed', ms: 4400, screen: <Overlay><Panel title="Ana Dodaj   ·   permanent job 2" width={560}><div data-demo="buttons" className="flex gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5"><Btn id="completed" tone="green" pulse>Completed</Btn><Btn tone="red">Terminated</Btn></div></Panel></Overlay> },
      { caption: 'Karta shkon te Completed; personi mbetet te Active Employees.', target: 'col-Completed', screen: board(emptyBoard({ Completed: ana('Contract completed', 'navy', 'card') }), undefined) },
      { caption: 'Kur plotësohen të gjitha vendet e punës, kartat dalin nga pipeline dhe puna kalon te Completed Jobs.', target: 'row-0', screen: <MockApp active="Completed Jobs" title="Completed Jobs"><Table head={['Job title', 'Client', 'Filled']} rows={[['permanent job 2', 'Company', '2 of 2']]} highlight={0} /></MockApp> },
    ],
  },
  temporary: {
    title: 'Pipeline Temporary',
    scenes: [
      { caption: 'Punët Temporary kanë vetëm Screening, Active dhe Completed. Kandidati është te Screening.', target: 'card', screen: <MockApp active="Pipeline Jobs" title="Pipeline Jobs"><div className="mb-2 flex gap-2 text-[11px]"><span className="rounded-md border border-slate-300 bg-white px-2.5 py-1">Permanent</span><span className="rounded-md bg-slate-900 px-2.5 py-1 font-semibold text-white">Temporary</span></div><Board><Column title="Screening" count={1}><PCard id="card" name="Ana Dodaj" job="jobs2" tag="Screening" tone="violet" /></Column><Column title="Active" count={0} /><Column title="Completed" count={0} /></Board></MockApp> },
      { caption: 'Shtyp "Active": hapet tabela e pagës; pasi konfirmohet, personi fillon punë.', target: 'active', ms: 4200, screen: <Overlay><Panel title="Ana Dodaj   ·   jobs2" width={560}><div data-demo="buttons" className="flex gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5"><Btn id="active" tone="green" pulse>Active</Btn><Btn tone="amber">No Show</Btn><Btn tone="red">Reject</Btn></div></Panel></Overlay> },
      { caption: 'Te Active, kur puna mbaron, shtyp "Completed". Puna del te Active Jobs Temporary.', target: 'row-0', screen: <MockApp active="Active Jobs Temporary" title="Active Jobs Temporary"><Table head={['Job title', 'Client', 'Active', 'Employees']} rows={[['jobs2', 'jobs2', '1 of 2', 'Ana Dodaj']]} highlight={0} /></MockApp> },
    ],
  },
  reconsider: {
    title: 'Rejected Applicants dhe Reconsider',
    scenes: [
      { caption: 'Hap Rejected Applicants: të gjithë të refuzuarit, me arsyen.', target: 'row-0', screen: <MockApp active="Rejected Applicants" title="Rejected Applicants"><Table head={['Candidate', 'Job', 'Reason', '']} rows={[['Ana Dodaj', 'permanent job 2', <Tag key="n" tone="amber">No Show</Tag>, <span key="o" data-demo="open" className="text-blue-700">Open in pipeline</span>]]} /></MockApp> },
      { caption: 'Shtyp "Open in pipeline" për të hapur kartën.', target: 'open', screen: <MockApp active="Rejected Applicants" title="Rejected Applicants"><Table head={['Candidate', 'Job', 'Reason', '']} rows={[['Ana Dodaj', 'permanent job 2', <Tag key="n" tone="amber">No Show</Tag>, <span key="o" data-demo="open" className="demo-pulse rounded px-1 text-blue-700">Open in pipeline</span>]]} /></MockApp> },
      { caption: 'Aty shtyp "Reconsider": kandidati kthehet në pipeline dhe punon sërish.', target: 'reconsider', ms: 4200, screen: <Overlay><Panel title="Ana Dodaj   ·   permanent job 2" width={560}><div className="flex gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5"><Btn id="reconsider" tone="green" pulse>Reconsider</Btn></div></Panel></Overlay> },
    ],
  },
  // ---------------------------------------------------------------------------------------------- settings
  dialpad: {
    title: 'Lidhja me Dialpad',
    scenes: [
      { caption: 'Hap Settings → Connections & API. Dialpad është i pari.', target: 'dialpad', screen: <MockApp active="Settings" title="Settings"><div className="mb-3 inline-flex gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1 text-[12px]"><span data-demo="dialpad" className="rounded-md bg-slate-900 px-3 py-1 font-medium text-white">Dialpad</span><span className="px-3 py-1">Zoom</span><span className="px-3 py-1">File storage</span></div><div className="rounded-lg border border-slate-200 bg-white p-3"><p className="mb-2 text-[13px] font-semibold">Dialpad <Tag tone="amber">Not connected</Tag></p><div className="rounded-md border border-slate-200 bg-slate-50 p-2 text-[11px]">What you need to connect Dialpad: 1. the API key  2. the business number</div></div></MockApp> },
      { caption: 'Ngjit çelësin API nga Dialpad admin console dhe vendos numrin e biznesit.', target: 'key', ms: 4200, screen: <MockApp active="Settings" title="Settings"><div className="rounded-lg border border-slate-200 bg-white p-3"><p className="mb-2 text-[13px] font-semibold">Dialpad</p><div className="grid max-w-[360px] gap-2"><Field id="key" label="Dialpad API key" value="••••••••••••••••" /><Field label="Business number" value="+442071234567" /><div><Btn>Connect Dialpad</Btn></div></div></div></MockApp> },
      { caption: 'Shtyp "Connect Dialpad". Statusi bëhet Connected; te kandidati shfaqen WhatsApp (për të shkruar) dhe SMS.', target: 'status', screen: <MockApp active="Settings" title="Settings"><div className="rounded-lg border border-slate-200 bg-white p-3"><p data-demo="status" className="mb-2 text-[13px] font-semibold">Dialpad <Tag tone="green">Connected</Tag></p><div className="flex gap-2"><Btn tone="outline">Check connection</Btn><Btn tone="outline">Reconnect with a new key</Btn></div></div></MockApp> },
    ],
  },
};

// the same list of topics → demos
export const DEMO_BY_TOPIC: Record<string, string> = {
  'start/rules': 'duplicate',
  'candidates/add': 'add-candidate',
  'candidates/pipeline': 'add-to-pipeline',
  'jobs/add': 'add-job',
  'jobs/titles': 'job-titles',
  'jobs/transfer': 'transfer',
  'pipeline-permanent/stages': 'move-cards',
  'pipeline-permanent/move': 'move-cards',
  'pipeline-permanent/noshow': 'no-show',
  'pipeline-permanent/hire': 'hire',
  'pipeline-permanent/completed': 'completed',
  'pipeline-temporary/flow': 'temporary',
  'lists/rejected': 'reconsider',
  'administration/dialpad': 'dialpad',
};
