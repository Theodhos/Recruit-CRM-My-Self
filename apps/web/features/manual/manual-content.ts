/**
 * The user manual: one section for each category of the menu, and in it a topic for each process. Written for the
 * people who use the CRM every day, in the words the screens use (buttons and pages keep their English names).
 * Every topic has a video slot — an administrator uploads the recording for it (see ManualVideo).
 */
export interface ManualTopic {
  id: string;
  title: string;
  /** What this is for, in a few lines. */
  what: string;
  /** What to press, in order. */
  steps: string[];
  /** Things worth knowing: rules, shortcuts, what the system does by itself. */
  tips?: string[];
}

export interface ManualSection {
  id: string;
  title: string;
  /** Where it is in the menu. */
  where: string;
  summary: string;
  topics: ManualTopic[];
}

export const MANUAL: ManualSection[] = [
  {
    id: 'start',
    title: 'Si funksionon CRM-ja (pamje e përgjithshme)',
    where: 'E gjithë platforma',
    summary: 'Rruga e plotë nga një kompani deri te një i punësuar, dhe rregullat që vlejnë kudo.',
    topics: [
      {
        id: 'flow',
        title: 'Rruga e një pune dhe e një kandidati',
        what: 'Çdo gjë nis nga një kompani (klienti) dhe një punë të hapur, dhe përfundon me një person të punësuar.',
        steps: [
          'Shto kompaninë te Companies (ose zgjidhe kur shton punën).',
          'Shto punën te Jobs: titulli, kompania, Permanent ose Temporary, sa kandidatë duhen.',
          'Shto kandidatët te Candidates (me dorë, duke hedhur CV-në, ose nga Excel). Të aplikuarit nga faqja e internetit vijnë vetë.',
          'Vendos kandidatët te pipeline-i i punës me "Add to pipeline". Ata hyjnë te faza e parë.',
          'Në Pipeline Jobs i çon fazë pas faze: Sent CV, Interview 1, Interview 2, pastaj Hire (Placement) ose Reject.',
          'Kur punësohet, kandidati shfaqet te Active Employees. Kur kontrata mbaron shtyp Completed (ose Terminated).',
          'Kur plotësohen të gjitha vendet e punës, puna kalon te Completed Jobs.',
        ],
        tips: ['Pipeline Permanent dhe Temporary janë të ndara: lloji i punës vendos cili pipeline përdoret.', 'Çdo veprim në pipeline mund të kthehet me Undo (butoni lart djathtas).'],
      },
      {
        id: 'rules',
        title: 'Rregullat që vlejnë kudo',
        what: 'Disa rregulla zbatohen automatikisht në çdo faqe.',
        steps: [
          'Të gjithë përdoruesit shohin të gjithë kandidatët, kompanitë dhe punët. Filtri "Added by" tregon çfarë ka shtuar secili.',
          'Kur shton një kompani, punë ose kandidat, mund të zgjedhësh te "Added by" cilit rekrutues i jepet.',
          'Nëse shton diçka që ekziston tashmë (i njëjti kandidat, kompani ose punë), nuk ruhet dhe del njoftimi "Already in the system".',
          'Asgjë nuk fshihet vetvetiu: fshirja bëhet vetëm me koshin ose me butonat e konfirmuar.',
          'Njoftimet (kambana lart) tregojnë kandidatë të rinj, detyra, kujtesa dhe paralajmërime.',
        ],
      },
    ],
  },
  {
    id: 'dashboard',
    title: 'Dashboard',
    where: 'Menuja → Overview → Dashboard',
    summary: 'Pamja e shpejtë e punës: numrat kryesorë dhe çfarë kërkon vëmendje.',
    topics: [
      {
        id: 'overview',
        title: 'Leximi i Dashboard-it',
        what: 'Karta me numra për kandidatët, punët, pipeline-in dhe të ardhurat, dhe lista me atë që duhet bërë së shpejti.',
        steps: ['Hap Dashboard nga menuja.', 'Shiko kartat lart: tregojnë numrat kryesorë të punës.', 'Përdor listat poshtë për të parë çfarë ka ndodhur së fundi dhe çfarë pret veprim.'],
        tips: ['Admini sheh numrat e të gjithë organizatës; çdo rekrutues sheh po të njëjtat të dhëna të përbashkëta.'],
      },
    ],
  },
  {
    id: 'candidates',
    title: 'Candidates',
    where: 'Menuja → Lists → Candidates',
    summary: 'Të gjithë kandidatët, nga çdo burim, me filtra, eksport dhe veprime në masë.',
    topics: [
      {
        id: 'add',
        title: 'Shtimi i një kandidati',
        what: 'Një kandidat shtohet me formular të shkurtër, ose duke hedhur dokumentin e tij (CV).',
        steps: [
          'Shtyp "Add Candidate".',
          'Hidh CV-në në kutinë "Drag and drop a document here" (çdo lloj dokumenti). Platforma lexon dokumentin dhe plotëson First name, Last name, Phone, Location, Job title dhe Trade.',
          'Kontrollo çfarë u plotësua dhe korrigjo me dorë ato që nuk janë të sakta.',
          'Zgjidh Source (nga erdhi) dhe, nëse do, "Added by" (cilit rekrutues i jepet).',
          'Shtyp "Create candidate". CV-ja ruhet me kandidatin.',
        ],
        tips: [
          'Kandidati duhet të ketë të paktën një emër, një telefon ose një e-mail.',
          'Nëse personi është tashmë në sistem (i njëjti telefon, e-mail ose emër), nuk ruhet dhe del njoftimi "Already in the system".',
          'Butoni X mbyll formularin; çfarë ke shkruar ruhet vetëm nëse është e vlefshme.',
        ],
      },
      {
        id: 'import',
        title: 'Importi nga Excel',
        what: 'Shton shumë kandidatë njëherësh nga një skedar Excel.',
        steps: ['Shtyp "Import Excel".', 'Zgjidh skedarin dhe përputh kolonat me fushat.', 'Konfirmo. Rreshtat që janë dublikatë ose bosh refuzohen dhe tregohen me arsyen.'],
      },
      {
        id: 'filters',
        title: 'Kërkimi dhe filtrat',
        what: 'Gjen shpejt një kandidat ose një grup kandidatësh.',
        steps: [
          'Shkruaj te kutitë Name, Location, Number ose Job title për të filtruar.',
          'Përdor Availability, Added dhe "Added by" për të ngushtuar listën.',
          '"More filters" hap filtrat e avancuar (zanati, përvoja, aftësitë, kualifikimet, kontaktimi i fundit).',
        ],
      },
      {
        id: 'status',
        title: 'Statusi manual i kandidatit',
        what: 'Statusin e një kandidati e ndryshon direkt në tabelë; CRM bën vetë pjesën tjetër.',
        steps: [
          'Te Candidates, shtyp kolonën Status të kandidatit.',
          'Zgjidh Available, On hold, Not available ose Do not use. Nuk kërkohet konfirmim.',
          'CRM e lëviz kartën e pipeline-it vetë: On hold te Interview, Not available te Placed (Active Employees), Do not use te Rejected.',
          'Shtyp "Back to automatic" që statusi të ndiqet sërish nga pipeline.',
        ],
        tips: ['Një kandidat "Do not use" nuk hyn në eksporte, SMS masivë ose lista kontakti.'],
      },
      {
        id: 'applicants',
        title: 'Aplikantët nga faqja publike',
        what: 'Kush aplikon në faqen e punëve hyn vetëm te Candidates, jo në pipeline.',
        steps: [
          'Aplikanti plotëson formën dhe ngarkon CV-në në faqen publike.',
          'Krijohet një kandidat me burim Web; CV-ja ruhet te Documents dhe puna te "Interested in".',
          'Ekipi merr njoftim "New candidate". Te Dashboard, butoni "Website applications" i liston.',
          'Nëse vendos ta marrësh në konsideratë, e shton me "Add to pipeline".',
        ],
        tips: ['I njëjti person (i njëjti email ose telefon dhe emër) nuk bëhet dy herë: aplikimi i ri shton vetëm punën dhe CV-në.'],
      },
      {
        id: 'pipeline',
        title: 'Vendosja e kandidatëve te pipeline',
        what: 'Askush nuk hyn te Pipeline Jobs vetë: kandidatët vendosen me dorë te një punë.',
        steps: [
          'Shënoje kandidatin me kutinë në fillim të rreshtit (ose disa kandidatë).',
          'Shtyp "Add to pipeline" në rresht, ose në shiritin e zgjedhjes për të gjithë të shënuarit.',
          'Zgjidh punën (ose disa punë) nga lista; ka kërkim dhe ndarje Permanent / Temporary.',
          'Konfirmo. Kandidati hyn vetë te faza e parë: Sent CV për punë Permanent, direkt te Active për punë Temporary (pa dritare shtesë).',
        ],
      },
      {
        id: 'export',
        title: 'Eksporti dhe mesazhet në masë',
        what: 'Nxjerr një listë kandidatësh (CSV, Excel) ose u dërgon tekst shumë personave.',
        steps: ['Shënoji kandidatët (ose lëri të gjithë të listuarit).', 'Shtyp "Export" dhe zgjidh formatin. Respektohet pëlqimi i çdo personi për SMS, e-mail dhe thirrje.', 'Për tekst në masë përdor opsionin SMS të shiritit; vetëm kandidatët me pëlqim marrin mesazh.'],
      },
      {
        id: 'detail',
        title: 'Faqja e kandidatit',
        what: 'Të gjitha të dhënat e një personi: kontakti, CV-ja, historiku, thirrjet dhe tekstet.',
        steps: ['Klikoje emrin e kandidatit.', 'Ndrysho të dhënat me lapsin.', 'Shiko CV-në me Preview, shto dokumente, dhe lexo historikun e pipeline-it.', 'Thirre ose dërgo tekst me Dialpad (kur është lidhur).'],
      },
    ],
  },
  {
    id: 'jobs',
    title: 'Jobs',
    where: 'Menuja → Lists → Jobs (Permanent / Temporary)',
    summary: 'Të gjitha punët e hapura, për Permanent dhe Temporary.',
    topics: [
      {
        id: 'add',
        title: 'Shtimi i një pune',
        what: 'Një punë i përket një kompanie dhe ka një lloj: Permanent ose Temporary.',
        steps: [
          'Shtyp "Add Job".',
          'Zgjidh Company (ose "No company (link later)").',
          'Zgjidh Job title nga lista (shih "Titujt e punës"); mund të shënosh më shumë se një.',
          'Shkruaj Job Description, Location, zgjidh Employment type dhe Candidates needed (sa vende ka puna).',
          'Vendos "Find candidates between" (datat e kërkimit), Salary range, Pay package, Status dhe, nëse do, publikimin në faqen e internetit.',
          'Për punë Temporary plotëso edhe orarin: datat, zonën kohore, javor ose model, dhe ditët e punës.',
          'Shtyp Save.',
        ],
        tips: ['"Candidates needed" vendos kur puna është e plotë dhe kalon te Completed Jobs.', 'E njëjta punë (titull, kompani, lloj) nuk shtohet dy herë.'],
      },
      {
        id: 'titles',
        title: 'Titujt e punës',
        what: 'Lista e titujve nga e cila zgjidhet titulli i çdo pune. Një titull mund të ketë disa emërtime.',
        steps: [
          'Shtyp "Add job title".',
          'Shkruaj një emër dhe shtyp Enter; shto emra të tjerë për të njëjtën punë (p.sh. Electrician, Electrical engineer) dhe shtyp Save.',
          'Poshtë shfaqen titujt e ruajtur, me kërkim. Lapsi i ndryshon, koshi i fshin.',
          'Te Add Job zgjidhi nga lista me kutitë; mund të shënosh disa.',
        ],
        tips: ['Fshirja ose ndryshimi i një titulli nuk prek punët që e kanë tashmë.'],
      },
      {
        id: 'handover',
        title: 'Transferi dhe njoftimet',
        what: 'Kur një punë ose kandidat kalon te një rekrutues tjetër, njoftimet e tij shkojnë me të.',
        steps: [
          'Transfero punën (ose ndrysho pronarin e kandidatit).',
          'Njoftimet për atë punë dhe për njerëzit e saj kalojnë te pronari i ri, me shenjën e leximit.',
          'Rekrutuesit e rinj që punojnë bashkë me të marrin kopje.',
        ],
      },
      {
        id: 'transfer',
        title: 'Transferimi i punëve te një rekrutues tjetër',
        what: 'Kalon një ose disa punë nga një rekrutues te tjetri, për Permanent dhe Temporary.',
        steps: [
          'Shënoji punët në tabelë (ose shtyp direkt butonin poshtë).',
          'Shtyp "Transfer to another recruiter" në fund të faqes.',
          'Në dritare kontrollo ose zgjidh punët nga lista (me kërkim).',
          'Zgjidh rekrutuesin. Me disa punë mund të zgjedhësh disa rekrutues: punët ndahen mes tyre.',
          'Shtyp Transfer.',
        ],
      },
      {
        id: 'detail',
        title: 'Faqja e punës',
        what: 'Përshkrimi, detyrat, kërkesat, aftësitë dhe udhëzimet e aplikimit, dhe kandidatët në pipeline.',
        steps: ['Klikoje titullin e punës.', 'Plotëso seksionet "What the job is", "What the candidate will do", "What is required", Skills, Qualifications dhe "How to apply" me "Add".', 'Për punë Temporary ndrysho kalendarin dhe ditët e punës të çdo personi.'],
      },
      {
        id: 'website',
        title: 'Publikimi në faqen e internetit',
        what: 'Një punë e hapur mund të shfaqet në faqen e kompanisë dhe të marrë aplikime.',
        steps: ['Te Add/Edit Job shëno "Publish this job on the company website".', 'Vendos, nëse do, datën e skadimit dhe nëse shfaqet paga.', 'Aplikimet vijnë vetë te Candidates (me burim Web, CV-ja te profili dhe njoftim për ekipin). Nuk hyjnë te pipeline: një rekrutues i shton me "Add to pipeline".'],
        tips: ['Puna mbyllet vetë kur skadon data.'],
      },
    ],
  },
  {
    id: 'companies',
    title: 'Companies',
    where: 'Menuja → Lists → Companies',
    summary: 'Klientët: kompanitë për të cilat rekrutoni.',
    topics: [
      {
        id: 'add',
        title: 'Shtimi i një kompanie',
        what: 'Një kompani ka emër, industri, status dhe të dhëna kontakti.',
        steps: ['Shtyp "Add Company".', 'Shkruaj emrin, industrinë, statusin (Prospect, Active client…), e-mail, telefon, website, qytet, shtet, adresë.', 'Zgjidh te "Added by" cilit rekrutues i jepet.', 'Shtyp Create.'],
        tips: ['Një kompani me të njëjtin emër ose website nuk shtohet përsëri.'],
      },
      {
        id: 'detail',
        title: 'Faqja e kompanisë',
        what: 'Kontaktet, punët, punonjësit dhe dokumentet e kompanisë.',
        steps: ['Klikoje emrin e kompanisë.', 'Shto kontakte te seksioni Contacts.', 'Shiko punët dhe punonjësit aktivë të saj.'],
      },
    ],
  },
  {
    id: 'pipeline-permanent',
    title: 'Pipeline Jobs — Permanent',
    where: 'Menuja → CRM → Pipeline Jobs → Permanent',
    summary: 'Kolonat e rekrutimit të përhershëm dhe çfarë bën secila fazë.',
    topics: [
      {
        id: 'stages',
        title: 'Fazat',
        what: 'Çdo kolonë është një fazë; çdo kartë është një kandidat për një punë.',
        steps: [
          'Sent CV: kandidati vendoset te puna dhe CV-ja i dërgohet klientit. Këtu mund të shtosh CV-në me "Add CV".',
          'Interview 1: intervista e parë (rishikimi i dytë i kandidatit).',
          'Interview 2: intervista e dytë; këtu merret vendimi të punësohet.',
          'Rejected: kush refuzohet nuk qëndron në kolonë, shkon te faqja Rejected Applicants.',
          'Placement: kandidati është punësuar dhe është te Active Employees.',
          'Completed: kontrata ka mbaruar; kartat qëndrojnë këtu derisa puna të mbushet.',
        ],
        tips: ['Mund t’i lëvizësh kartat me drag and drop nga çdo fazë në çdo fazë.', 'Undo / Redo lart djathtas kthen dhe përsërit veprimin e fundit.'],
      },
      {
        id: 'card',
        title: 'Karta dhe pop-up-i i saj',
        what: 'Klikimi i kartës hap pop-up-in me të dhënat e kandidatit, shënimet dhe butonat e fazës.',
        steps: ['Klikoje kartën ose "Stage notes & pay".', 'Lexo emrin, telefonin, e-mail-in dhe shiko CV-në me "Preview CV".', 'Shkruaj shënime për fazën dhe ruaji me Save.', 'Përdor butonat lart për ta çuar kandidatin në fazën tjetër.'],
        tips: ['Në Sent CV ka "Add CV": pas ngarkimit, CV-ja hapet në anë.', 'History tregon udhëtimin e kandidatit dhe shënimet e çdo faze.'],
      },
      {
        id: 'move',
        title: 'Lëvizja e kandidatit',
        what: 'Një kandidat lëviz me butonat e pop-up-it ose me drag and drop.',
        steps: [
          'Nga Sent CV: butonat Interview 1, Interview 2 ose Rejected.',
          'Nga Interview 1: Interview 2, No Show ose Reject.',
          'Nga Interview 2: Hire, No Show ose Reject.',
          'Me drag and drop: tërhiqe kartën te kolona tjetër; për disa faza hapet një dritare e vogël për shënim dhe datë.',
        ],
      },
      {
        id: 'noshow',
        title: 'No Show dhe Reject',
        what: 'Refuzimi i një kandidati, me shënim që mbetet.',
        steps: [
          '"No Show": kandidati nuk erdhi te intervista. Hapet një dritare ku shkruan pse (shënimi është i detyrueshëm); pastaj refuzohet me statusin "No Show" dhe shpjegimi ruhet te History.',
          '"Reject": kërkon një shënim (arsyen) para se të refuzohet.',
          'Të dy shfaqen te faqja Rejected Applicants dhe te History.',
        ],
        tips: ['Një kandidat i refuzuar kthehet nga Rejected Applicants me "Open in pipeline" dhe Reconsider.'],
      },
      {
        id: 'currency',
        title: 'Monedha dhe kursi automatik',
        what: 'Pagesat hapen në GBP; mund të zgjedhësh EUR, USD ose ALL.',
        steps: [
          'Te dritarja e pagës, zgjidh monedhën te Currency.',
          'Shuma e shkruar konvertohet vetë me kursin e tregut, dhe kursi shfaqet.',
          'Pagesa ruhet në monedhën e zgjedhur; raportet e shfaqin të konvertuar në GBP.',
        ],
      },
      {
        id: 'hire',
        title: 'Punësimi (Hire) dhe paga',
        what: 'Punësimi kërkon pagën e kandidatit dhe e çon te Placement dhe Active Employees.',
        steps: [
          'Shtyp "Hire" (ose tërhiq kartën te Placement).',
          'Në tabelën e pagës vendos Rate / hour, Currency, Hours / day, Days / month dhe Fee %. Llogaritjet për ditë, muaj dhe tarifën shfaqen vetë.',
          'Shtyp "Confirm pay — hire".',
          'Kandidati shfaqet te Active Employees.',
        ],
        tips: ['Puna duhet të ketë një kompani, përndryshe punësimi refuzohet me një mesazh.', 'Nëse anulon tabelën, kandidati nuk lëviz.'],
      },
      {
        id: 'completed',
        title: 'Completed dhe Terminated',
        what: 'Mbyllja e kontratës së një personi të punësuar.',
        steps: [
          'Hap kartën te Placement.',
          '"Completed": kontrata ka mbaruar normalisht. Karta shkon te faza Completed dhe personi mbetet te Active Employees.',
          '"Terminated": kontrata mbyllet para kohe; kërkohet arsyeja. Personi shënohet "Do not use".',
          'Kartat te Completed qëndrojnë derisa të plotësohen të gjitha vendet e punës; atëherë dalin nga pipeline dhe puna kalon te Completed Jobs.',
        ],
      },
      {
        id: 'sentcv',
        title: 'Faza Sent CV',
        what: 'Faza e parë: kandidati vendoset te puna dhe CV-ja i dërgohet klientit.',
        steps: [
          'Kandidati hyn këtu kur e vendos te puna me "Add to pipeline" (ose kur aplikon nga faqja e internetit).',
          'Hap kartën dhe shtyp "Add CV" për ta shtuar CV-në; pas ngarkimit hapet menjëherë në anë.',
          'Shkruaj shënimet e fazës dhe shtyp Save.',
          'Shtyp "Interview 1", "Interview 2" ose "Rejected" për ta çuar më tej.',
        ],
      },
      {
        id: 'interview1',
        title: 'Faza Interview 1',
        what: 'Intervista e parë: rishikimi i dytë i kandidatit.',
        steps: [
          'Hap kartën te Interview 1; lart ka një kujtesë që të rishikosh të dhënat dhe CV-në.',
          'Ruaj shënimet dhe, nëse duhet, datën dhe linkun e takimit.',
          'Shtyp "Interview 2" për ta çuar te intervista e dytë.',
          '"No Show" (kandidati nuk erdhi) kërkon një shënim që ruhet te History; "Reject" kërkon një arsye.',
        ],
      },
      {
        id: 'interview2',
        title: 'Faza Interview 2',
        what: 'Intervista e dytë: këtu merret vendimi të punësohet.',
        steps: [
          'Hap kartën te Interview 2.',
          '"Hire" hap tabelën e pagës dhe e çon kandidatin te Placement.',
          '"No Show" kërkon një shënim (pse nuk erdhi) dhe e refuzon me statusin "No Show"; "Reject" kërkon një arsye.',
          'Me butonin "WhatsApp" hapet biseda në WhatsApp me numrin e kandidatit për të shkruar një mesazh (CRM-ja nuk bën thirrje me zë).',
        ],
      },
      {
        id: 'rejected',
        title: 'Faza Rejected',
        what: 'Kush refuzohet nuk qëndron në pipeline: shkon te Rejected Applicants.',
        steps: [
          'Refuzo me "Reject" (shënim i detyrueshëm), me "No Show", ose duke tërhequr kartën te kolona Rejected.',
          'Kolona Rejected mbetet bosh: kandidati largohet menjëherë nga tabela.',
          'Gjeje te Rejected Applicants, me arsyen dhe etiketën.',
          'Për ta kthyer shtyp "Open in pipeline" dhe Reconsider.',
        ],
      },
      {
        id: 'placement',
        title: 'Faza Placement',
        what: 'Kandidati është punësuar dhe punon te klienti.',
        steps: [
          'Karta hyn këtu pasi konfirmon pagën me Hire; personi shfaqet te Active Employees.',
          'Hap kartën: sheh pagën e vendosur dhe butonat Completed dhe Terminated.',
          'Karta nuk largohet vetë: qëndron derisa të shtypësh Completed ose Terminated.',
        ],
      },
      {
        id: 'completedstage',
        title: 'Faza Completed',
        what: 'Kontratat e mbyllura normalisht.',
        steps: [
          'Karta vjen këtu kur shtyp "Completed" te Placement.',
          'Personi mbetet te Active Employees; karta qëndron në kolonë.',
          'Kur plotësohen të gjitha vendet e punës, kartat dalin nga pipeline (nuk fshihen) dhe puna kalon te Completed Jobs.',
        ],
      },
    ],
  },
  {
    id: 'pipeline-temporary',
    title: 'Pipeline Jobs — Temporary',
    where: 'Menuja → CRM → Pipeline Jobs → Temporary',
    summary: 'Pipeline-i i shkurtër për punët e përkohshme.',
    topics: [
      {
        id: 'flow',
        title: 'Active dhe Completed',
        what: 'Punët Temporary kanë vetëm fazat Active dhe Completed.',
        steps: [
          'Me "Add to pipeline" nga Candidates kandidati hyn direkt te Active dhe shfaqet te Active Employees.',
          'Nga Active shtyp "Completed" kur puna mbaron: karta shkon te Completed, puna del te Active Jobs Temporary dhe personi mbetet te Active Employees.',
        ],
        tips: ['Te Active mund të përdorësh edhe Reject ose No Show.'],
      },
      {
        id: 'screening',
        title: 'Hyrja në pipeline-in Temporary',
        what: 'Punët Temporary nuk kanë më fazën Screening: kandidati hyn direkt te Active.',
        steps: ['Shtyp "Add to pipeline" për kandidatin dhe zgjidh punën Temporary.', 'Karta hyn vetë te Active, pa dritare.', 'Hap kartën për të parë të dhënat dhe CV-në; "No Show" ose "Reject" e refuzojnë.'],
      },
      {
        id: 'active',
        title: 'Faza Active',
        what: 'Personi që punon tani në një punë Temporary.',
        steps: ['Karta hyn këtu menjëherë dhe personi shfaqet te Active Employees.', 'Puna del te Active Jobs Temporary.', 'Kur puna mbaron shtyp "Completed".'],
      },
      {
        id: 'completedtemp',
        title: 'Faza Completed (Temporary)',
        what: 'Kontratat e përkohshme të mbyllura.',
        steps: ['Karta shkon këtu kur shtyp "Completed" te Active.', 'Personi mbetet te Active Employees.', 'Kur puna mbushet, kartat dalin nga pipeline dhe puna kalon te Completed Jobs.'],
      },
    ],
  },
  {
    id: 'pipeline-companies',
    title: 'Pipeline Companies',
    where: 'Menuja → CRM → Pipeline Companies',
    summary: 'Pipeline-i i kompanive: nga kontakti i parë deri te klienti i nënshkruar.',
    topics: [
      {
        id: 'flow',
        title: 'Lëvizja e kompanive',
        what: 'Çdo kolonë është një fazë e marrëdhënies me kompaninë.',
        steps: ['Hap Pipeline Companies.', 'Tërhiq kartën e kompanisë te fazën tjetër ose hape me klikim.', 'Shkruaj shënimet e çdo faze në pop-up. Për të kaluar te "Signed" duhet një dokument si provë.'],
      },
    ],
  },
  {
    id: 'lists',
    title: 'Lists: Active Employees, Active Jobs Temporary, Completed Jobs, Rejected Applicants',
    where: 'Menuja → Lists',
    summary: 'Listat që plotësohen vetë nga pipeline-i.',
    topics: [
      {
        id: 'employees',
        title: 'Active Employees',
        what: 'Çdo person i punësuar tani, i ndarë në Permanent dhe Temporary.',
        steps: ['Hap Active Employees dhe zgjidh Permanent / Temporary.', 'Klikoje një rresht për të parë punën, kompaninë, fillimin dhe pagën.', 'Ndrysho një kontratë me lapsin, ose fshije me koshin kur nuk duhet më.'],
        tips: ['Personi shfaqet këtu menjëherë pasi punësohet nga pipeline-i dhe qëndron derisa ta fshish ti.'],
      },
      {
        id: 'active-temporary',
        title: 'Active Jobs Temporary',
        what: 'Punët Temporary që kanë njerëz që punojnë tani.',
        steps: ['Hap Active Jobs Temporary.', 'Klikoje punën për të parë orarin, turnet dhe njerëzit e saj.', 'Zëvendëso një person nga paneli i punës kur nevojitet.'],
      },
      {
        id: 'completed-jobs',
        title: 'Completed Jobs',
        what: 'Punët me të gjitha vendet e mbushura.',
        steps: ['Hap Completed Jobs.', 'Kontrollo kush punon në çdo punë.', 'Shto ose hiq një person nga puna me butonat e panelit (kur është i lejuar).'],
        tips: ['Puna vjen këtu vetë kur numri i vendeve të mbushura arrin "Candidates needed".'],
      },
      {
        id: 'rejected',
        title: 'Rejected Applicants',
        what: 'Të gjithë të refuzuarit nga çdo pipeline, me arsyen.',
        steps: ['Hap Rejected Applicants.', 'Kolona Reason tregon shënimin dhe etiketat "No Show" ose "Terminated".', '"Open in pipeline" hap kartën; aty shtyp Reconsider për ta kthyer kandidatin në pipeline.'],
      },
    ],
  },
  {
    id: 'revenue',
    title: 'Revenue (vetëm admini ose kush e ka të lejuar)',
    where: 'Menuja → Revenue',
    summary: 'Tarifat, kontratat, orët, pagat dhe komisionet.',
    topics: [
      {
        id: 'fees',
        title: 'Fees',
        what: 'Tarifat që faturohen klientëve për punësimet.',
        steps: [
          'Hap Fees. Lart janë kartat: Permanent placements, Draft invoices, Sent awaiting payment, Overdue, Paid this year.',
          'Seksioni "Permanent placements without a fee" liston njerëzit e punësuar pa tarifë; shtyp "Add fee terms" për ta vendosur.',
          'Me "Add fee" krijon një tarifë me dorë.',
          'Ndiq statusin: Mark sent, pastaj Mark paid.',
        ],
      },
      {
        id: 'retainers',
        title: 'Retainers',
        what: 'Marrëveshjet me para paraprakisht me klientët.',
        steps: ['Hap Retainers dhe shtyp për të shtuar një marrëveshje.', 'Vendos klientin, shumën, datat dhe afatin.', 'Marrëveshja skadon vetë kur mbaron data.'],
      },
      {
        id: 'timesheets',
        title: 'Timesheets',
        what: 'Orët ose ditët që ka bërë një punonjës për një klient, që pastaj aprovohen.',
        steps: ['Hap Timesheets dhe zgjidh javën.', 'Shtyp "Add timesheet", zgjidh punonjësin, klientin dhe vendos orët ose ditët.', 'Hape një timesheet për të parë llogaritjet: bruto, neto, tarifa e klientit dhe fitimi.', 'Aprovoje (nëse ke leje) që të kalojë te paga.'],
      },
      {
        id: 'payroll',
        title: 'Weekly payroll',
        what: 'Pagat e javës për të gjithë punonjësit Temporary.',
        steps: ['Hap Weekly payroll dhe zgjidh javën.', 'Kontrollo përmbledhjen: kush është aprovuar, kush pret dhe paralajmërimet.', 'Shëno rreshtat, autorizo pagesat dhe shëno si të paguara.', 'Shkarko payslips për të shënuarit.'],
      },
      {
        id: 'payslips',
        title: 'Payslips',
        what: 'Fletët e pagës të çdo punonjësi.',
        steps: ['Hap Payslips dhe kërko punonjësin.', 'Hape një payslip për ta parë ose shkarkuar.', 'Kur ta dërgosh, shëno si të lëshuar.'],
      },
      {
        id: 'commission',
        title: 'Commission',
        what: 'Komisioni që fitojnë rekrutuesit nga punësimet.',
        steps: ['Hap Commission dhe zgjidh muajin.', 'Shiko tabelën për çdo rekrutues: faturimi, fitimi, përqindja dhe komisioni.', 'Regjistro pagesat e komisionit që janë bërë.', 'Përqindjet e çdo rekrutuesi vendosen në seksionin e normave (vetëm admini).'],
      },
    ],
  },
  {
    id: 'administration',
    title: 'Administration: Profile, Notifications, Settings',
    where: 'Menuja → Administration',
    summary: 'Llogaria, përdoruesit, njoftimet dhe lidhjet.',
    topics: [
      {
        id: 'profile',
        title: 'My Profile dhe përdoruesit',
        what: 'Llogaria jote, dhe për adminin lista e të gjithë përdoruesve.',
        steps: [
          'Hap My Profile për të parë llogarinë tënde.',
          'Admini sheh listën e përdoruesve me numrat e secilit: kompani, punë, kandidatë dhe të punësuar.',
          'Për të shtuar një përdorues shtyp "Add Instructor" dhe zgjidh rolin: Admin, Recruiter ose Manager, dhe statusin Active ose Deactivated.',
          '"Set new & show" vendos një fjalëkalim të ri dhe e tregon një herë.',
          'Klikimi i një përdoruesi hap faqen e tij me tre skeda: Companies, Jobs, Candidates që ka shtuar.',
        ],
      },
      {
        id: 'notifications',
        title: 'Notifications',
        what: 'Çdo gjë që ka ndodhur dhe kërkon vëmendje, e grupuar sipas llojit.',
        steps: ['Hap Notifications ose kambanën lart.', 'Zgjidh një kategori: Candidates, Hires & placements, Tasks, Calendar & reminders, Needs attention, Pay & fees.', 'Klikoje një njoftim për të shkuar te vendi përkatës; "Mark read" ose "Mark all read" i heq të palexuarat.'],
      },
      {
        id: 'settings',
        title: 'Settings',
        what: 'Llogaria jote, organizata dhe lidhjet me shërbimet e jashtme.',
        steps: [
          'My account: ndrysho emrin dhe nis ndryshimin e fjalëkalimit (një lidhje shkon në e-mail).',
          'Organisation: emri i agjencisë (vetëm admini).',
          'Connections & API: Dialpad, Zoom dhe File storage (vetëm admini).',
          'Manual përdorimi: ky manual.',
        ],
      },
      {
        id: 'dialpad',
        title: 'Lidhja me Dialpad (thirrje dhe tekste)',
        what: 'Rekrutuesit thërrasin dhe dërgojnë tekst kandidatëve nga CRM-ja, përmes llogarisë së kompanisë në Dialpad.',
        steps: ['Hap Settings → Connections & API → Dialpad.', 'Ngjit çelësin API nga Dialpad admin console dhe vendos numrin e biznesit (p.sh. +442071234567).', 'Shtyp "Connect Dialpad" dhe pastaj "Check connection".', 'Te faqja e kandidatit përdor Call dhe SMS.'],
        tips: ['SMS dhe thirrjet respektojnë pëlqimin e kandidatit.'],
      },
      {
        id: 'zoom',
        title: 'Lidhja me Zoom',
        what: 'Takimet e intervistave krijohen në Zoom nga pipeline-i.',
        steps: ['Te Zoom App Marketplace krijo një aplikacion Server-to-Server OAuth me leje "meeting:write:admin".', 'Hap Settings → Connections & API → Zoom.', 'Vendos Account ID, Client ID dhe Client Secret dhe shtyp "Connect Zoom". Kontrollohen para ruajtjes.'],
      },
      {
        id: 'storage',
        title: 'File storage',
        what: 'Ku ruhen CV-të dhe dokumentet (Google Drive, S3 ose disku i serverit).',
        steps: ['Hap Settings → Connections & API → File storage.', 'Zgjidh ruajtjen dhe vendos të dhënat e saj; secretet shfaqen të maskuara.', 'Shtyp "Test and save": provohet lidhja para ruajtjes.'],
        tips: ['Nëse ruajtja kryesore dështon, skedarët ruhen përkohësisht në diskun e serverit dhe del një paralajmërim këtu.'],
      },
    ],
  },
];
