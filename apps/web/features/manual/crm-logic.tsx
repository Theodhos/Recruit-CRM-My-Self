'use client';

import {
  ArrowDown,
  ArrowRight,
  Bell,
  Briefcase,
  Building2,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  ClipboardCheck,
  FileText,
  Globe,
  Handshake,
  KeyRound,
  Percent,
  Receipt,
  Repeat,
  ShieldCheck,
  Trophy,
  UserX,
  Users,
  Wallet,
  Zap,
  type AppIcon,
} from '@crm/ui/icons';
import { useMemo, useState } from 'react';

/* ------------------------------------------------------------------------------------------------------------------ */
/* 1. The map: how the CRM hangs together                                                                             */
/* ------------------------------------------------------------------------------------------------------------------ */

interface MapNode {
  id: string;
  label: string;
  note: string;
  icon: AppIcon;
  /** The manual section this opens. */
  section: string;
  accent: string;
}

const MAIN: MapNode[] = [
  { id: 'companies', label: 'Companies', note: 'Klienti që kërkon njerëz', icon: Building2, section: 'companies', accent: 'border-t-indigo-500' },
  { id: 'jobs', label: 'Jobs', note: 'Vendi i llirë i klientit', icon: Briefcase, section: 'jobs', accent: 'border-t-sky-500' },
  { id: 'candidates', label: 'Candidates', note: 'Njerëzit që kërkojnë punë', icon: Users, section: 'candidates', accent: 'border-t-teal-500' },
  { id: 'pipeline', label: 'Pipeline Jobs', note: 'Fazë pas faze deri te vendimi', icon: Repeat, section: 'pipeline-permanent', accent: 'border-t-blue-500' },
  { id: 'employees', label: 'Active Employees', note: 'Personi punon te klienti', icon: Trophy, section: 'lists', accent: 'border-t-violet-500' },
  { id: 'completed', label: 'Completed Jobs', note: 'Të gjitha vendet u plotësuan', icon: CheckCircle2, section: 'lists', accent: 'border-t-emerald-500' },
];

const MONEY: MapNode[] = [
  { id: 'fees', label: 'Fees', note: 'Tarifa që paguan klienti për një person të vendosur', icon: CircleDollarSign, section: 'revenue', accent: 'border-t-lime-500' },
  { id: 'retainers', label: 'Retainers', note: 'Marrëveshje mujore me klientin', icon: Wallet, section: 'revenue', accent: 'border-t-yellow-500' },
  { id: 'timesheets', label: 'Timesheets', note: 'Orët javore të punëtorëve të përkohshëm', icon: ClipboardCheck, section: 'revenue', accent: 'border-t-purple-500' },
  { id: 'payroll', label: 'Weekly payroll', note: 'Kush paguhet këtë javë', icon: CalendarClock, section: 'revenue', accent: 'border-t-pink-500' },
  { id: 'payslips', label: 'Payslips', note: 'Fletëpagesa PDF', icon: Receipt, section: 'revenue', accent: 'border-t-stone-500' },
  { id: 'commission', label: 'Commission', note: 'Çfarë fiton çdo rekrutues', icon: Percent, section: 'revenue', accent: 'border-t-red-500' },
];

function Node({ node, onOpen }: { node: MapNode; onOpen: (section: string) => void }) {
  const Icon = node.icon;
  return (
    <button
      type="button"
      onClick={() => onOpen(node.section)}
      className={`group flex min-w-[9.5rem] flex-1 flex-col items-start gap-2 rounded-xl border border-border border-t-2 ${node.accent} bg-background p-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md`}
      title={`Hap në manual: ${node.label}`}
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Icon className="h-5 w-5" />
      </span>
      <span>
        <span className="block text-sm font-semibold">{node.label}</span>
        <span className="block text-xs leading-snug text-foreground/55">{node.note}</span>
      </span>
    </button>
  );
}

/** The CRM on one picture: from a client to a person at work, and from there to the money. Every box opens its part of the manual. */
export function CrmFlowMap({ onOpen }: { onOpen: (section: string) => void }) {
  return (
    <div className="flex flex-col gap-5" data-testid="crm-map">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground/50">1 · Nga klienti te personi në punë</p>
        <div className="flex flex-wrap items-stretch gap-2">
          {MAIN.map((node, index) => (
            <div key={node.id} className="flex min-w-[9.5rem] flex-1 items-stretch gap-2">
              <Node node={node} onOpen={onOpen} />
              {index < MAIN.length - 1 ? <ArrowRight className="hidden h-5 w-5 shrink-0 self-center text-foreground/30 xl:block" aria-hidden="true" /> : null}
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-border bg-accent/20 px-3 py-2 text-xs text-foreground/65">
          <UserX className="h-4 w-4 shrink-0" />
          Në çdo fazë të pipeline-it kandidati mund të <strong className="font-semibold">refuzohet</strong>: shkon te{' '}
          <button type="button" className="font-semibold underline" onClick={() => onOpen('lists')}>
            Rejected Applicants
          </button>{' '}
          dhe del nga pipeline. Vetëm <strong className="font-semibold">Reconsider</strong> e kthen në fazën e parë.
        </div>
      </div>

      <div className="flex items-center gap-2 text-foreground/40">
        <ArrowDown className="h-4 w-4" aria-hidden="true" />
        <span className="text-xs">kur personi vendoset, fillon pjesa e parave</span>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground/50">2 · Paratë (Revenue)</p>
        <div className="flex flex-wrap items-stretch gap-2">
          {MONEY.map((node) => (
            <Node key={node.id} node={node} onOpen={onOpen} />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {[
          { icon: Globe, title: 'Faqja e punëve', text: 'Çdo punë e hapur del vetë në faqen publike. Kush aplikon hyn vetëm te Candidates, jo në pipeline.' },
          { icon: Bell, title: 'Njoftimet', text: 'Kambana lart tregon kandidatë të rinj, detyra, kujtesa dhe paralajmërime. Ndjekin punën kur ajo transferohet.' },
          { icon: ShieldCheck, title: 'Qasja', text: 'Admini sheh gjithçka. Çdo rekrutues sheh vetëm faqet që i jepen dhe punon me rekordet e veta.' },
        ].map(({ icon: Icon, title, text }) => (
          <div key={title} className="flex gap-3 rounded-xl border border-border bg-background p-3.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-foreground/70">
              <Icon className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-sm font-semibold">{title}</span>
              <span className="block text-xs leading-snug text-foreground/60">{text}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* 2. The events: when this happens, the CRM does that                                                                */
/* ------------------------------------------------------------------------------------------------------------------ */

interface CrmEvent {
  area: string;
  when: string;
  then: string[];
}

const AREAS: { key: string; label: string; icon: AppIcon }[] = [
  { key: 'website', label: 'Faqja e punëve', icon: Globe },
  { key: 'candidates', label: 'Kandidatët', icon: Users },
  { key: 'jobs', label: 'Punët', icon: Briefcase },
  { key: 'companies', label: 'Kompanitë', icon: Building2 },
  { key: 'pipeline', label: 'Pipeline', icon: Repeat },
  { key: 'people', label: 'Të punësuarit', icon: Trophy },
  { key: 'money', label: 'Paratë dhe monedha', icon: CircleDollarSign },
  { key: 'notifications', label: 'Njoftimet', icon: Bell },
  { key: 'access', label: 'Përdoruesit dhe qasja', icon: KeyRound },
  { key: 'files', label: 'Dokumentet', icon: FileText },
];

/** Everything the CRM does by itself or because of a button, in the words of "when this → this happens". */
export const CRM_EVENTS: CrmEvent[] = [
  // website
  { area: 'website', when: 'Dikush plotëson formën e aplikimit në faqen publike', then: ['Krijohet një kandidat te Candidates me burim "Web".', 'Puna që zgjodhi ruhet te "Interested in" i kandidatit.', 'CV-ja ruhet te profili i tij (karta CV).', 'Ekipi merr njoftim ("New candidate"). Kandidati NUK hyn në pipeline: e shton një rekrutues me "Add to pipeline".'] },
  { area: 'website', when: 'I njëjti person (i njëjti email ose telefon dhe i njëjti emër) aplikon përsëri', then: ['Nuk krijohet profil i dytë.', 'Puna e re shtohet si "Interested in" dhe një CV e re ruhet.', 'Aplikimi i dytë për të njëjtën punë nuk dërgon njoftim të dyfishtë.'] },
  { area: 'website', when: 'Aplikon dikush me të njëjtin email por emër tjetër', then: ['Trajtohet si person tjetër: krijohet kandidat i ri te Candidates.'] },
  { area: 'website', when: 'Puna plotësohet (të gjitha vendet), mbyllet, arkivohet ose skadon', then: ['Del vetë nga faqja publike (brenda një minute) dhe nuk pranon më aplikime.', 'Nëse lirohet një vend, puna rikthehet.'] },
  { area: 'website', when: 'Shton një punë të re në CRM', then: ['Ajo shfaqet menjëherë në faqen publike (Draft, Closed dhe Archived nuk shfaqen), pa asnjë buton shtesë.'] },

  // candidates
  { area: 'candidates', when: 'Shton një kandidat me dorë (Add Candidate)', then: ['Duhen plotësuar: First name, Last name, Phone (07…), Location, Source, Trades, Job title dhe CV.', 'Telefoni pranohet vetëm si 07xxx xxxxxx; +44 refuzohet.', 'Nëse telefoni ose email-i ekziston tashmë, nuk ruhet dhe del "Already in the system".', 'Fushat e zbrazëta bëhen të kuqe me tekstin "Required".'] },
  { area: 'candidates', when: 'Hedh një CV në formën e kandidatit', then: ['Fushat plotësohen vetë nga CV-ja (emri, telefoni, email-i, vendndodhja, puna, trades).', 'Një telefon me +44 kthehet në 07.'] },
  { area: 'candidates', when: 'Shtyp "Add to pipeline" për një kandidat', then: ['Karta hyn në pipeline-in e punës: te Sent CV për punët Permanent, te Active për ato Temporary.', 'Kandidati merr statusin sipas etapës.'] },
  { area: 'candidates', when: 'Ndryshon statusin me dorë te kolona Status', then: ['On hold: karta lëviz te Interview. Not available: lëviz te Placed (bëhet Active Employee). Do not use: lëviz te Rejected si Terminated dhe kontrata aktive mbyllet. Available: një kartë te Interview/Placed/Rejected kthehet te etapa e parë.', 'Statusi i brendshëm ruhet (ACTIVE, PASSIVE, PLACED, DO_NOT_CONTACT): lexohet nga filtrat, eksportet dhe SMS.', '"Back to automatic" e kthen te statusi nga pipeline.'] },
  { area: 'candidates', when: 'Një kandidat është "Do not use"', then: ['Nuk del në asnjë listë kontakti, eksport ose SMS masiv.'] },
  { area: 'candidates', when: 'Eksporton kandidatët', then: ['Butoni Export është vetëm për adminin, ose për rekrutuesin që admini e ka shënuar me "Can export candidates".', 'Eksportohen vetëm ata që shfaq filtri aktual, dhe kush ka opt-out nuk hyn.'] },
  { area: 'candidates', when: 'Ndryshon një kandidat nga një rekrutues te tjetri', then: ['Njoftimet për atë kandidat kalojnë te pronari i ri, me shenjën e leximit.'] },
  { area: 'candidates', when: 'Kërkon sipas një vendndodhjeje dhe distance (Distance range)', then: ['Vendndodhja gjendet në hartë dhe shfaqen vetëm kandidatët (ose punët) brenda atyre miljeve. Distanca zgjidhet në milje dhe shiriti arrin deri në 200 milje maksimumi.'] },

  // jobs
  { area: 'jobs', when: 'Shton një punë (Add Job)', then: ['Duhen plotësuar: Company, Job title, Description, Location, Employment type, Candidates needed, Find candidates between dhe Added by.', 'Çdo punë e re merr statusin Published vetë.'] },
  { area: 'jobs', when: 'Zgjedh Temporary', then: ['Orari plotësohet vetë: e hënë deri e premte, 08:00 deri 17:00, 1 orë pushim, timezone Europe/London.', 'Kur zgjedh datat, kalendari mbushet me çdo ditë të hënë–të premte. Ndryshon vetëm çfarë ndryshon për punën.'] },
  { area: 'jobs', when: 'Shton një titull pune (Add job title) ose e ndryshon', then: ['Titulli ruhet në listën e përbashkët. Ndryshimi i emrit ndikon vetëm te lista, jo te punët që e kanë tashmë.'] },
  { area: 'jobs', when: 'Transferon punë te rekrutues (Transfer)', then: ['Mund të jetë një punë te shumë rekrutues, shumë punë te një, ose shumë te shumë. Rekrutuesi i parë bëhet "Added by", të tjerët punojnë bashkë.', 'Njoftimet e punës dhe të kandidatëve të saj kalojnë te pronari i ri; bashkë-punuesit e rinj marrin kopje.'] },
  { area: 'jobs', when: 'Puna plotëson të gjitha vendet', then: ['Del nga Jobs dhe shkon te Completed Jobs, nga faqja publike zhduket.', 'Nëse lirohet një vend (Release places ose një kontratë fshihet), puna kthehet te Jobs.'] },
  { area: 'jobs', when: 'Filtron punët sipas kandidatit ose vendndodhjes', then: ['Zgjedh një kandidat si pikë nisjeje dhe kërkon punët brenda x km nga vendi i tij.'] },

  // companies
  { area: 'companies', when: 'Shton një kompani', then: ['Duhen plotësuar: Company name, Status, Email, Phone, Website, City, Added by dhe Source.', 'Mund të shtosh sa persona kontakti të duash (HR, Manager, CEO…): çdo person ruhet si kontakt i kompanisë.'] },
  { area: 'companies', when: 'Hap profilin e një kompanie', then: ['Katër seksione: Overview, People, Jobs & employees, Pipeline & files.', 'Marrëveshja e tarifës (Agreed fee) ruhet në Overview.'] },

  // pipeline
  { area: 'pipeline', when: 'Karta lëviz te etapa Interview', then: ['Kandidati del "On hold" te Candidates.'] },
  { area: 'pipeline', when: 'Shtyp Hire / lëviz kartën te Placement ose Active', then: ['Krijohet kontrata (placement) dhe kandidati shfaqet te Active Employees.', 'Duhet që puna të ketë klient dhe vend të lirë, përndryshe del një mesazh gabimi.', 'Kandidati merr statusin Not available.'] },
  { area: 'pipeline', when: 'Shtyp Reject (ose No Show)', then: ['Karta del nga pipeline dhe shfaqet te Rejected Applicants me arsyen.', 'Te Rejected Applicants, "Open in pipeline" hap dritaren e etapës: vetëm Reconsider e kthen kandidatin në fazën e parë.'] },
  { area: 'pipeline', when: 'Heq kartën nga pipeline dhe e shton përsëri', then: ['Historia e asaj pune fillon nga zero: shënimet, pagesa e llogaritur dhe lëvizjet nuk mbahen. Undo e kthen menjëherë me gjithçka.'] },
  { area: 'pipeline', when: 'Shtyp Undo / Redo', then: ['Kthen ose ribën hapin e fundit në kartat (lëvizje, hire, completed, heqje).'] },
  { area: 'pipeline', when: 'Kalon miun mbi një kartë', then: ['Dritarja e saj përgatitet në sfond, kështu hapet e plotë me një klikim.'] },

  // people
  { area: 'people', when: 'Shtyp Completed për një punonjës', then: ['Kontrata kalon te Completed, por personi mbetet te Active Employees.', 'Kur plotësohen të gjitha vendet, puna shkon te Completed Jobs.'] },
  { area: 'people', when: 'Shtyp Terminated', then: ['Kontrata mbyllet para kohe me arsyen, personi shënohet "Do not use" dhe karta shkon te Rejected.'] },

  // money
  { area: 'money', when: 'Ndryshon monedhën në një formë pagese', then: ['Parazgjedhja është GBP; mund të zgjedhësh EUR, USD ose ALL.', 'Shumat e shkruara konvertohen vetë me kursin e tregut dhe shfaqet kursi i përdorur.'] },
  { area: 'money', when: 'Miraton një timesheet', then: ['CRM llogarit pagën, CIS, payroll fee, pagesën neto, tarifën për klientin dhe fitimin, dhe shkruan fletëpagesën PDF.'] },
  { area: 'money', when: 'Autorizon Weekly payroll', then: ['Pagesat shënohen të autorizuara, pastaj ti i regjistron si të paguara.'] },
  { area: 'money', when: 'Një rekrutues zgjidhet për një placement të përkohshëm', then: ['Fitimi i atij placement ndahet sipas përqindjes së tij dhe shfaqet te Commission të muajit.'] },

  // notifications
  { area: 'notifications', when: 'Ndodh diçka që të takon (kandidat i ri, detyrë, kujtesë, paralajmërim)', then: ['Del në kambanë dhe në Notifications, e grupuar sipas temës; merr edhe kopje me email.', 'Klikimi mbi të të çon te vendi i saktë dhe e shënon të lexuar.'] },
  { area: 'notifications', when: 'Një punë ose kandidat kalon te një rekrutues tjetër', then: ['Njoftimet përkatëse kalojnë bashkë me të.'] },

  // access
  { area: 'access', when: 'Admini shton një rekrutues (Add instructor)', then: ['Zgjedh rolin, faqet që sheh dhe mund të shënojë "Can export candidates".', 'Rekrutuesi sheh Dashboard dhe të gjitha faqet e dhëna, me rekordet e përbashkëta; te Settings ka vetëm Dialpad dhe manualin.'] },
  { area: 'access', when: 'Një rekrutues hap My Profile', then: ['Mund të ndryshojë emrin dhe mbiemrin me Edit. Email-i, roli dhe statusi ndryshohen vetëm nga admini.'] },
  { area: 'access', when: 'Lidh Dialpad (Settings → Connections & API)', then: ['Thirrjet dhe SMS bëhen nga profili i kandidatit. Lidhja është një për gjithë organizatën; vetëm admini mund ta heqë.'] },

  // files
  { area: 'files', when: 'Ngarkon një dokument', then: ['Pranohet çdo lloj skedari (foto, Word, PDF, tekst…), një ose disa njëherësh, deri në 25 MB.', 'Mund ta shohësh në Preview ose ta fshish aty ku e ke ngarkuar, p.sh. te paneli i pipeline-it.'] },
];

/** The events, by area: a search box, the areas as filters, and for each event "when" → "then". */
export function EventsCatalog({ initialSearch = '' }: { initialSearch?: string }) {
  const [area, setArea] = useState<string>('all');
  const [search, setSearch] = useState(initialSearch);
  const words = search.toLowerCase().split(/\s+/).filter(Boolean);

  const shown = useMemo(
    () =>
      CRM_EVENTS.filter((event) => (area === 'all' || event.area === area) && words.every((word) => `${event.when} ${event.then.join(' ')}`.toLowerCase().includes(word))),
    [area, words.join(' ')], // eslint-disable-line react-hooks/exhaustive-deps
  );

  return (
    <div className="flex flex-col gap-4" data-testid="crm-events">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-60 flex-1 sm:max-w-sm">
          <Zap className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />
          <input
            className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm"
            placeholder="Kërko një ngjarje (p.sh. transfer, Reject, monedhë)…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search events"
          />
        </div>
        <span className="text-xs text-foreground/50">{shown.length} ngjarje</span>
      </div>

      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Fushat">
        {[{ key: 'all', label: 'Të gjitha', icon: Handshake }, ...AREAS].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={area === key}
            onClick={() => setArea(key)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${area === key ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-foreground/70 hover:bg-accent'}`}
          >
            <Icon className="h-3.5 w-3.5" /> {label}
          </button>
        ))}
      </div>

      {shown.length === 0 ? <p className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-foreground/55">Asnjë ngjarje nuk përputhet.</p> : null}

      <ul className="flex flex-col gap-3">
        {shown.map((event, index) => {
          const meta = AREAS.find((item) => item.key === event.area);
          const Icon = meta?.icon ?? Zap;
          return (
            <li key={`${event.area}-${index}`} className="overflow-hidden rounded-xl border border-border bg-background shadow-sm">
              <div className="flex items-start gap-3 border-b border-border bg-accent/30 px-4 py-2.5">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground/50">{meta?.label} · kur</p>
                  <p className="text-sm font-semibold">{event.when}</p>
                </div>
              </div>
              <ul className="flex flex-col gap-1.5 px-4 py-3">
                {event.then.map((effect) => (
                  <li key={effect} className="flex gap-2.5 text-sm">
                    <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                    <span className="text-foreground/80">{effect}</span>
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
