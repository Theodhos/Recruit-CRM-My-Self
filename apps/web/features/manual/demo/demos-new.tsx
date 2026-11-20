import type { ReactNode } from 'react';

import type { DemoDefinition } from './demos';
import { ana, board, candidateRows, CANDIDATE_HEAD, emptyBoard } from './demos';
import { Board, Btn, Column, Field, MockApp, Overlay, Panel, PCard, Table, Tag, Toast } from './mock';

/**
 * The demos for how the CRM behaves today: the careers website, the manual status of a candidate, the Temporary pipeline
 * (no Screening), the hand-over of notifications and the currency conversion. Same pieces and labels as the real screens.
 * They replace the older demos of the same id and add new ones (see user-manual.tsx).
 */

const Bell = ({ id, count, pulse }: { id?: string; count: number; pulse?: boolean }) => (
  <span data-demo={id} className={`relative inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 bg-white text-[14px] ${pulse ? 'demo-pulse' : ''}`}>
    🔔
    {count > 0 ? <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[9px] font-bold text-white">{count}</span> : null}
  </span>
);

const JOBS = ['Electrician', 'Plumber', 'Site Manager'];

/** The public careers page, drawn as a small browser inside the stage. */
const Careers = ({ children, form }: { children?: ReactNode; form?: boolean }) => (
  <div className="absolute inset-0 bg-white text-slate-900">
    <div className="flex items-center justify-between border-b border-slate-200 px-8 py-3">
      <b className="text-[15px]">DC Solutions · Careers</b>
      <span className="text-[11px] text-slate-500">www.dcsolutions-jobs.co.uk</span>
    </div>
    <div className="px-8 py-5">
      {form ? (
        children
      ) : (
        <>
          <p className="mb-3 text-[18px] font-semibold">Open positions</p>
          <div className="grid grid-cols-3 gap-3">
            {JOBS.map((job, index) => (
              <div key={job} data-demo={`job-${index}`} className="rounded-xl border border-slate-200 p-3">
                <p className="text-[13px] font-semibold">{job}</p>
                <p className="mt-0.5 text-[11px] text-slate-500">Leeds · Permanent</p>
                <span className="mt-3 inline-flex rounded-md bg-slate-900 px-2.5 py-1 text-[11px] font-medium text-white">Apply</span>
              </div>
            ))}
          </div>
          {children}
        </>
      )}
    </div>
  </div>
);

export const DEMOS_NEW: Record<string, DemoDefinition> = {
  // ------------------------------------------------------------------------------------------------ overview
  flow: {
    title: 'Rruga e një pune dhe e një kandidati',
    scenes: [
      { step: 'Klienti', caption: 'Shto kompaninë (klientin) te Companies.', target: 'add', screen: <MockApp active="Companies" title="Companies" action={<Btn id="add" pulse>+ Add Company</Btn>}><Table head={['Company', 'Industry', 'Status']} rows={[['Acme Ltd', 'Construction', 'ACTIVE CLIENT'], ['Brick & Co', 'Building', 'PROSPECT']]} /></MockApp> },
      { step: 'Vendi i lirë', caption: 'Shto punën te Jobs: titulli, kompania, lloji dhe sa kandidatë duhen. Puna del vetë në faqen publike.', target: 'add', screen: <MockApp active="Jobs" title="Jobs" action={<Btn id="add" pulse>+ Add Job</Btn>}><Table head={['Job title', 'Client', 'Type', 'Needed']} rows={[['Electrician', 'Acme Ltd', <Tag key="a" tone="green">PERMANENT</Tag>, '1/2'], ['jobs2', 'jobs2', <Tag key="c" tone="amber">TEMPORARY</Tag>, '1/2']]} /></MockApp> },
      { step: 'Njerëzit', caption: 'Kandidatët vijnë te Candidates: i shton ti (me CV ose Excel) ose aplikojnë vetë nga faqja publike.', target: 'add', screen: <MockApp active="Candidates" title="Candidates" action={<Btn id="add" pulse>+ Add Candidate</Btn>}><Table head={CANDIDATE_HEAD} rows={candidateRows()} checks /></MockApp> },
      { step: 'Pipeline', caption: 'Me "Add to pipeline" kandidati hyn te puna dhe ecën fazë pas faze.', target: 'card', screen: board(emptyBoard({ 'Interview 1': ana('Interview 1', 'violet', 'card') })) },
      { step: 'Në punë', caption: 'Kur punësohet shfaqet te Active Employees; kur kontrata mbaron shtyp Completed. Pastaj vijnë paratë: tarifa, timesheet, payroll.', target: 'row-0', screen: <MockApp active="Active Employees" title="Active Employees"><Table head={['Employee', 'Job', 'Type', 'Pay']} rows={[['Ana Dodaj', 'permanent job 2', <Tag key="p" tone="green">Permanent</Tag>, '£200/h']]} highlight={0} /></MockApp> },
    ],
  },

  // ------------------------------------------------------------------------------------------------ the website
  website: {
    title: 'Aplikimi nga faqja publike',
    scenes: [
      { step: 'Puna del vetë', caption: 'Çdo punë e hapur (Published) del vetë në faqen publike, pa asnjë buton shtesë.', target: 'job-0', screen: <Careers /> },
      { step: 'Aplikimi', caption: 'Kandidati shtyp Apply, plotëson emrin, telefonin, email-in dhe ngarkon CV-në.', target: 'send', ms: 4200, screen: <Careers form><p className="mb-3 text-[16px] font-semibold">Apply: Electrician</p><div className="grid max-w-[520px] grid-cols-2 gap-3"><Field label="First name" value="Arben" /><Field label="Last name" value="Hoxha" /><Field label="Phone" value="07700 900321" /><Field label="Email" value="arben@example.com" /></div><div className="mt-3 flex max-w-[520px] items-center gap-3"><span className="rounded-md border border-dashed border-slate-300 px-3 py-2 text-[11px]">📎 Arben Hoxha CV.pdf</span><Btn id="send" pulse>Send application</Btn></div></Careers> },
      { step: 'Te Candidates', caption: 'Në CRM krijohet një kandidat me burim Web. CV-ja ruhet te profili i tij dhe puna ruhet te "Interested in".', target: 'row-0', ms: 4200, screen: <MockApp active="Candidates" title="Candidates"><Table head={['Name', 'Source', 'Interested in', 'Pipeline']} rows={[['Arben Hoxha', <Tag key="w" tone="sky">Web</Tag>, 'Electrician', <span key="n" className="text-slate-400">Not on a pipeline</span>], ['Ana Dodaj', 'Manual', '—', 'Sent CV']]} highlight={0} /></MockApp> },
      { step: 'Njoftimi', caption: 'Ekipi merr njoftim "New candidate". Kandidati NUK hyn vetë në pipeline: e shton një rekrutues me "Add to pipeline".', target: 'bell', screen: <MockApp active="Dashboard" title="Dashboard" action={<Bell id="bell" count={1} pulse />}><div className="rounded-xl border border-slate-200 bg-white p-4 text-[12px]"><p className="font-semibold">🔔 New candidate</p><p className="text-slate-500">Arben Hoxha applied for Electrician</p></div></MockApp> },
      { step: 'Plotësohet', caption: 'Kur të gjitha vendet e punës plotësohen (ose puna mbyllet) ajo zhduket vetë nga faqja publike.', target: 'job-1', screen: <Careers><p className="mt-4 rounded-lg bg-slate-100 px-3 py-2 text-[12px] text-slate-600">Electrician u plotësua dhe nuk shfaqet më.</p></Careers> },
    ],
  },

  // ------------------------------------------------------------------------------------------------ candidates
  'status-manual': {
    title: 'Statusi manual i kandidatit',
    scenes: [
      { step: 'Kolona Status', caption: 'Te Candidates, kolona Status e çdo kandidati ndryshohet direkt në tabelë.', target: 'status', screen: <MockApp active="Candidates" title="Candidates"><Table head={['Name', 'Phone', 'Source', 'Status']} rows={[['Ana Dodaj', '07700 900123', 'Web', <span key="s" data-demo="status" className="demo-pulse rounded-md border border-slate-300 bg-white px-2 py-0.5">Available ▾</span>], ['Besnik Krasniqi', '07700 900456', 'Manual', <Tag key="b" tone="green">Available</Tag>]]} /></MockApp> },
      { step: 'Zgjidh statusin', caption: 'Zgjidh një: Available, On hold, Not available ose Do not use.', target: 'option', ms: 4200, screen: <MockApp active="Candidates" title="Candidates"><Table head={['Name', 'Phone', 'Source', 'Status']} rows={[['Ana Dodaj', '07700 900123', 'Web', 'Available ▾'], ['Besnik Krasniqi', '07700 900456', 'Manual', <Tag key="b" tone="green">Available</Tag>]]} /><div className="absolute right-6 top-[130px] z-20 w-[170px] rounded-lg border border-slate-200 bg-white p-1 text-[12px] shadow-xl"><p className="rounded px-2 py-1.5">Available</p><p className="rounded px-2 py-1.5">On hold</p><p data-demo="option" className="rounded bg-blue-50 px-2 py-1.5 font-medium">Not available</p><p className="rounded px-2 py-1.5 text-red-600">Do not use</p></div></MockApp> },
      { step: 'Ndodh vetë', caption: 'Pa konfirmim: statusi ruhet dhe CRM bën pjesën tjetër. "Not available" e shndërron kandidatin në të punësuar.', target: 'row-0', screen: <MockApp active="Candidates" title="Candidates"><Table head={['Name', 'Phone', 'Source', 'Status']} rows={[['Ana Dodaj', '07700 900123', 'Web', <Tag key="s" tone="amber">Not available</Tag>], ['Besnik Krasniqi', '07700 900456', 'Manual', <Tag key="b" tone="green">Available</Tag>]]} highlight={0} /><Toast>Ana Dodaj u zhvendos te Placed (Active Employees)</Toast></MockApp> },
      { step: 'Pipeline', caption: 'Karta e saj ndryshon etapë vetë: On hold → Interview, Not available → Placed, Do not use → Rejected. "Back to automatic" e kthen te statusi nga pipeline.', target: 'card', screen: board(emptyBoard({ Placement: ana('Placement', 'green', 'card') })) },
    ],
  },

  // ------------------------------------------------------------------------------------------------ temporary pipeline
  'temp-screening': {
    title: 'Hyrja në pipeline-in Temporary',
    scenes: [
      { step: 'Add to pipeline', caption: 'Për punë Temporary nuk ka më Screening. Shëno kandidatin dhe shtyp "Add to pipeline".', target: 'bar', screen: <MockApp active="Candidates" title="Candidates"><Table head={CANDIDATE_HEAD} rows={candidateRows()} checks checked={[0]} /><div className="mt-3 flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-100 px-4 py-3 text-[12px]"><b>1 candidate selected</b><Btn id="bar" pulse>Add to pipeline</Btn></div></MockApp> },
      { step: 'Direkt te Active', caption: 'Zgjidh punën Temporary: karta hyn menjëherë te Active, pa dritare shtesë.', target: 'card', screen: <MockApp active="Pipeline Jobs" title="Pipeline Jobs"><Board><Column title="Active" count={1}><PCard id="card" name="Ana Dodaj" job="jobs2" tag="Active" tone="green" /></Column><Column title="Completed" count={0} /></Board></MockApp> },
    ],
  },
  'temp-active': {
    title: 'Faza Active',
    scenes: [
      { step: 'Karta', caption: 'Karta është te Active dhe personi shfaqet menjëherë te Active Employees.', target: 'card', screen: <MockApp active="Pipeline Jobs" title="Pipeline Jobs"><Board><Column title="Active" count={1}><PCard id="card" name="Ana Dodaj" job="jobs2" tag="Active" tone="green" /></Column><Column title="Completed" count={0} /></Board></MockApp> },
      { step: 'Active Jobs', caption: 'Puna del te Active Jobs Temporary, me njerëzit që punojnë.', target: 'row-0', screen: <MockApp active="Active Jobs Temporary" title="Active Jobs Temporary"><Table head={['Job title', 'Client', 'Active', 'Employees']} rows={[['jobs2', 'jobs2', '1 of 2', 'Ana Dodaj']]} highlight={0} /></MockApp> },
      { step: 'Problem', caption: 'Nëse nuk vjen për punë: hap kartën dhe shtyp "No Show" ose "Reject".', target: 'buttons', screen: <Overlay><Panel title="Ana Dodaj   ·   jobs2" width={520}><div data-demo="buttons" className="flex gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5"><Btn tone="green">Completed</Btn><Btn tone="amber">No Show</Btn><Btn tone="red">Reject</Btn></div></Panel></Overlay> },
    ],
  },
  temporary: {
    title: 'Pipeline Temporary',
    scenes: [
      { step: 'Dy faza', caption: 'Punët Temporary kanë vetëm Active dhe Completed. Kandidati hyn direkt te Active.', target: 'card', screen: <MockApp active="Pipeline Jobs" title="Pipeline Jobs"><div className="mb-2 flex gap-2 text-[11px]"><span className="rounded-md border border-slate-300 bg-white px-2.5 py-1">Permanent</span><span className="rounded-md bg-slate-900 px-2.5 py-1 font-semibold text-white">Temporary</span></div><Board><Column title="Active" count={1}><PCard id="card" name="Ana Dodaj" job="jobs2" tag="Active" tone="green" /></Column><Column title="Completed" count={0} /></Board></MockApp> },
      { step: 'Orari', caption: 'Çdo punë Temporary ka vetë orarin: e hënë–e premte, 08:00–17:00, 1 orë pushim.', target: 'sched', screen: <MockApp active="Jobs" title="Add Job" dim><Overlay side="right"><Panel title="Add Job" drawer width={420}><div data-demo="sched" className="space-y-2 text-[12px]"><Field label="Employment type" value="Temporary" /><Field label="Working days" value="Mon – Fri" /><div className="grid grid-cols-3 gap-2"><Field label="Start" value="08:00" /><Field label="End" value="17:00" /><Field label="Break" value="60 min" /></div></div></Panel></Overlay></MockApp> },
      { step: 'Completed', caption: 'Kur puna mbaron shtyp "Completed": karta kalon aty dhe personi mbetet te Active Employees.', target: 'row-0', screen: <MockApp active="Active Jobs Temporary" title="Active Jobs Temporary"><Table head={['Job title', 'Client', 'Active', 'Employees']} rows={[['jobs2', 'jobs2', '1 of 2', 'Ana Dodaj']]} highlight={0} /></MockApp> },
    ],
  },

  // ------------------------------------------------------------------------------------------------ hand-over
  handover: {
    title: 'Transferimi dhe njoftimet',
    scenes: [
      { step: 'Para transferit', caption: 'Rekrutuesi A ka njoftime për punën "Electrician" dhe për kandidatët e saj.', target: 'bell', screen: <MockApp active="Dashboard" title="Aurora (rekrutuesi A)" action={<Bell id="bell" count={3} />}><div className="space-y-2 text-[12px]"><p className="rounded-lg border border-slate-200 bg-white p-3">🔔 New candidate · Arben Hoxha → Electrician</p><p className="rounded-lg border border-slate-200 bg-white p-3">🔔 Interview tomorrow · Ana Dodaj</p><p className="rounded-lg border border-slate-200 bg-white p-3">🔔 Task due · Electrician</p></div></MockApp> },
      { step: 'Transfer', caption: 'Admini ose pronari ia transferon punën rekrutuesit B (Jobs → Transfer to another recruiter).', target: 'go', screen: <MockApp active="Jobs" title="Jobs" dim><Overlay><Panel title="Transfer jobs to another recruiter" width={520} footer={<Btn id="go" tone="outline" pulse>Transfer</Btn>}><p className="rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-[12px] font-medium">Electrician → Gabriela (rekrutuesi B)</p></Panel></Overlay></MockApp> },
      { step: 'Njoftimet kalojnë', caption: 'Njoftimet për atë punë dhe për njerëzit e saj shkojnë te pronari i ri, me shenjën e leximit. Rekrutuesi A nuk i sheh më.', target: 'bell', screen: <MockApp active="Dashboard" title="Gabriela (rekrutuesi B)" action={<Bell id="bell" count={3} pulse />}><div className="space-y-2 text-[12px]"><p className="rounded-lg border border-emerald-300 bg-emerald-50 p-3">🔔 New candidate · Arben Hoxha → Electrician</p><p className="rounded-lg border border-emerald-300 bg-emerald-50 p-3">🔔 Interview tomorrow · Ana Dodaj</p><p className="rounded-lg border border-emerald-300 bg-emerald-50 p-3">🔔 Task due · Electrician</p></div></MockApp> },
      { step: 'Në të njëjtën mënyrë', caption: 'Njësoj ndodh kur ndryshon pronarin e një kandidati: njoftimet e tij kalojnë te pronari i ri.', target: 'owner', screen: <MockApp active="Candidates" title="Ana Dodaj" ><div data-demo="owner" className="max-w-[320px]"><Field label="Owner" value="Gabriela" /></div></MockApp> },
    ],
  },

  // ------------------------------------------------------------------------------------------------ money
  currency: {
    title: 'Monedha dhe kursi automatik',
    scenes: [
      { step: 'Parazgjedhja', caption: 'Çdo pagesë hapet me GBP. Mund të zgjedhësh EUR, USD ose ALL (lek).', target: 'cur', screen: <MockApp active="Pipeline Jobs" title="Pipeline Jobs" dim><Overlay><Panel title="Placement — pay for Ana Dodaj" width={560}><div className="grid grid-cols-3 gap-2"><Field label="Rate / hour" value="18" /><div data-demo="cur"><Field label="Currency" value="GBP ▾" /></div><Field label="Hours / day" value="8" /></div></Panel></Overlay></MockApp> },
      { step: 'Zgjedh ALL', caption: 'Zgjidh një monedhë tjetër: shuma e shkruar konvertohet vetë me kursin e tregut.', target: 'conv', ms: 4400, screen: <MockApp active="Pipeline Jobs" title="Pipeline Jobs" dim><Overlay><Panel title="Placement — pay for Ana Dodaj" width={560}><div className="grid grid-cols-3 gap-2"><div data-demo="conv"><Field label="Rate / hour" value="1,740 ALL" /></div><Field label="Currency" value="ALL ▾" /><Field label="Hours / day" value="8" /></div><p className="mt-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-[12px]">18 GBP = 1,740 ALL · kursi i sotëm, shfaqet gjithmonë</p></Panel></Overlay></MockApp> },
      { step: 'Ruhet', caption: 'Pagesa ruhet në monedhën e zgjedhur dhe te raportet shfaqet e konvertuar në GBP.', target: 'row-0', screen: <MockApp active="Active Employees" title="Active Employees"><Table head={['Employee', 'Job', 'Rate', 'In GBP']} rows={[['Ana Dodaj', 'permanent job 2', '1,740 ALL/h', '£18/h']]} highlight={0} /></MockApp> },
    ],
  },
};

export const DEMO_BY_TOPIC_NEW: Record<string, string> = {
  'candidates/status': 'status-manual',
  'candidates/applicants': 'website',
  'jobs/handover': 'handover',
  'jobs/website': 'website',
  'pipeline-permanent/currency': 'currency',
};
