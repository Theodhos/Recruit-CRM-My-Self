'use client';

import { Button, Input } from '@crm/ui';
import {
  BookOpen,
  Briefcase,
  Building2,
  ChevronDown,
  CircleDollarSign,
  Film,
  GitBranch,
  LayoutDashboard,
  Lightbulb,
  List,
  Loader2,
  Rocket,
  Search,
  Settings,
  Trash2,
  Upload,
  Users,
  type AppIcon,
} from '@crm/ui/icons';
import { useEffect, useMemo, useRef, useState } from 'react';

import { confirmDialog } from '@/components/dialogs/confirm-dialog';
import { isAdminSession } from '@/components/navigation';
import { useDeleteDocument, useDocuments, useUploadDocument } from '@/hooks/use-documents';
import { useSession } from '@/hooks/use-session';

import { CrmFlowMap } from './crm-logic';
import { DEMO_BY_TOPIC, DEMOS } from './demo/demos';
import { DEMO_BY_TOPIC_MORE, DEMOS_MORE } from './demo/demos-more';
import { DEMO_BY_TOPIC_NEW, DEMOS_NEW } from './demo/demos-new';
import { DemoPlayer } from './demo/player';
import { MANUAL, type ManualSection, type ManualTopic } from './manual-content';

/** Every topic has a demo: the main ones in demos.tsx, the rest in demos-more.tsx. */
const ALL_DEMOS = { ...DEMOS, ...DEMOS_MORE, ...DEMOS_NEW };
const DEMO_OF_TOPIC: Record<string, string> = { ...DEMO_BY_TOPIC, ...DEMO_BY_TOPIC_MORE, ...DEMO_BY_TOPIC_NEW };

const SECTION_ICON: Record<string, AppIcon> = {
  start: Rocket,
  dashboard: LayoutDashboard,
  candidates: Users,
  jobs: Briefcase,
  companies: Building2,
  'pipeline-permanent': GitBranch,
  'pipeline-temporary': GitBranch,
  'pipeline-companies': GitBranch,
  lists: List,
  revenue: CircleDollarSign,
  administration: Settings,
};

/** Uploaded videos are kept as ordinary files whose name says which topic they belong to: "manual:<section>/<topic>|<file name>". */
const PREFIX = 'manual:';
const MAX_VIDEO_MB = 25;
const mimeOf = (fileName: string) => {
  const extension = fileName.split('.').pop()?.toLowerCase();
  return extension === 'webm' ? 'video/webm' : extension === 'mov' ? 'video/quicktime' : extension === 'ogv' ? 'video/ogg' : 'video/mp4';
};

/**
 * The video of one topic. If a recording was uploaded for it, that is played; otherwise the animated demo of the
 * platform for that topic. An administrator can drop a recording on it (or choose a file) to replace the demo.
 */
function TopicVideo({ slot, canEdit }: { slot: string; canEdit: boolean }) {
  const { data, isLoading } = useDocuments({ search: `${PREFIX}${slot}|`, pageSize: 10 });
  const upload = useUploadDocument();
  const remove = useDeleteDocument();
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [playable, setPlayable] = useState<{ id: string; url: string } | null>(null);
  const [loadingVideo, setLoadingVideo] = useState(false);

  const demoId = DEMO_OF_TOPIC[slot];
  const demo = demoId ? ALL_DEMOS[demoId] : undefined;
  const video = (data?.items ?? []).filter((doc) => doc.name.startsWith(`${PREFIX}${slot}|`)).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const fileName = video?.name.slice(`${PREFIX}${slot}|`.length) ?? '';

  // the file is fetched with the person's sign-in and played from memory
  useEffect(() => {
    setPlayable(null);
    if (!video) return;
    let objectUrl: string | null = null;
    let cancelled = false;
    setLoadingVideo(true);
    fetch(video.downloadUrl, { credentials: 'include' })
      .then((response) => (response.ok ? response.blob() : Promise.reject(new Error('The video could not be opened.'))))
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(new Blob([blob], { type: mimeOf(fileName) }));
        setPlayable({ id: video.id, url: objectUrl });
      })
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : 'The video could not be opened.'))
      .finally(() => !cancelled && setLoadingVideo(false));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reloads when another video replaces it
  }, [video?.id]);

  async function pick(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (!file.type.startsWith('video/')) return setError('Choose a video file (MP4, WebM or MOV).');
    if (file.size > MAX_VIDEO_MB * 1024 * 1024) return setError(`The video is ${(file.size / 1024 / 1024).toFixed(0)} MB; the most is ${MAX_VIDEO_MB} MB. Shorten it or lower its quality.`);
    try {
      const previous = video;
      await upload.mutateAsync({ file, type: 'OTHER', name: `${PREFIX}${slot}|${file.name}` });
      if (previous) await remove.mutateAsync(previous.id).catch(() => undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The video could not be uploaded.');
    }
  }

  async function take() {
    if (!video || !(await confirmDialog('Remove this video? The animated demo is shown again.'))) return;
    setError(null);
    try {
      await remove.mutateAsync(video.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The video could not be removed.');
    }
  }

  return (
    <div className="flex flex-col gap-2" data-testid="manual-video">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-foreground/50">
        <Film className="h-3.5 w-3.5" /> Video {video ? '' : demo ? '· demo e animuar' : ''}
      </p>

      {/* a drop on it replaces the demo with a recording (administrator) */}
      <div
        className={`relative rounded-xl ${dragging ? 'ring-2 ring-primary ring-offset-2' : ''}`}
        onDragOver={(event) => {
          if (!canEdit) return;
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          if (!canEdit) return;
          event.preventDefault();
          setDragging(false);
          void pick(event.dataTransfer.files?.[0]);
        }}
      >
        {isLoading ? (
          <div className="flex aspect-video items-center justify-center rounded-xl border border-border bg-accent/30 text-sm text-foreground/50">Loading…</div>
        ) : video ? (
          playable ? (
            <video key={playable.id} src={playable.url} controls preload="metadata" className="aspect-video w-full rounded-xl bg-black" />
          ) : (
            <div className="flex aspect-video w-full items-center justify-center rounded-xl bg-black/80 text-sm text-white/70">
              {loadingVideo ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading the video…
                </span>
              ) : (
                'The video could not be opened.'
              )}
            </div>
          )
        ) : demo ? (
          <DemoPlayer title={demo.title} scenes={demo.scenes} />
        ) : (
          <div className="flex aspect-video flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border bg-accent/20 px-4 text-center text-sm text-foreground/55">
            <Film className="h-6 w-6 text-foreground/30" />
            {canEdit ? 'No video yet. Drop a recording here, or choose a file.' : 'A video for this topic is coming.'}
          </div>
        )}
        {dragging ? <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl bg-primary/10 text-sm font-semibold text-primary">Lëshoje videon këtu</div> : null}
      </div>

      {canEdit ? (
        <div className="flex flex-wrap items-center gap-2">
          <input ref={input} type="file" accept="video/*" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; void pick(file); }} />
          <Button type="button" size="sm" variant="outline" disabled={upload.isPending} onClick={() => input.current?.click()}>
            <Upload className="mr-1.5 h-3.5 w-3.5" /> {upload.isPending ? 'Uploading…' : video ? 'Replace video' : demo ? 'Upload a recording' : 'Upload video'}
          </Button>
          {video ? (
            <Button type="button" size="sm" variant="ghost" disabled={remove.isPending} onClick={() => void take()}>
              <Trash2 className="mr-1.5 h-3.5 w-3.5 text-destructive" /> Remove
            </Button>
          ) : null}
          <span className="text-xs text-foreground/45">Tërhiqe një video këtu ose zgjidhe: MP4, WebM ose MOV, deri në {MAX_VIDEO_MB} MB.</span>
        </div>
      ) : null}
      {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
    </div>
  );
}

function Topic({ section, topic, canEdit, open, onToggle, index }: { section: ManualSection; topic: ManualTopic; canEdit: boolean; open: boolean; onToggle: () => void; index: number }) {
  const slot = `${section.id}/${topic.id}`;
  const hasDemo = Boolean(DEMO_OF_TOPIC[slot]);
  return (
    <li className={`overflow-hidden rounded-2xl border bg-background transition-shadow ${open ? 'border-primary/40 shadow-md' : 'border-border hover:shadow-sm'}`}>
      <button type="button" aria-expanded={open} onClick={onToggle} className="flex w-full items-center gap-3 px-4 py-3.5 text-left" data-testid="manual-topic">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">{index + 1}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold">{topic.title}</span>
          <span className="block truncate text-xs text-foreground/55">{topic.what}</span>
        </span>
        {hasDemo ? <span className="hidden shrink-0 items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 sm:inline-flex"><Film className="h-3 w-3" /> Video</span> : null}
        <ChevronDown className={`h-4 w-4 shrink-0 text-foreground/40 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open ? (
        <div className="grid grid-cols-1 gap-5 border-t border-border bg-accent/10 px-4 py-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <div className="flex flex-col gap-3">
            <p className="text-sm text-foreground/75">{topic.what}</p>
            <ol className="flex flex-col gap-2.5">
              {topic.steps.map((step, position) => (
                <li key={step} className="flex gap-3 text-sm">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">{position + 1}</span>
                  <span className="pt-0.5">{step}</span>
                </li>
              ))}
            </ol>
            {topic.tips?.length ? (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
                <p className="mb-1 flex items-center gap-1.5 font-semibold">
                  <Lightbulb className="h-4 w-4" /> Mirë është ta dish
                </p>
                <ul className="list-disc space-y-1 pl-5">
                  {topic.tips.map((tip) => (
                    <li key={tip}>{tip}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
          <TopicVideo slot={slot} canEdit={canEdit} />
        </div>
      ) : null}
    </li>
  );
}

/**
 * Settings → Manual përdorimi: how every part of the CRM works, section by section, with the steps of every process
 * and a video for it — an animated demo of the platform, or the recording an administrator uploaded in its place.
 */
export function UserManual() {
  const { data: session } = useSession();
  const canEdit = isAdminSession(session);
  const [sectionId, setSectionId] = useState<string>(MANUAL[0]!.id);
  const [search, setSearch] = useState('');
  const [openTopic, setOpenTopic] = useState<string | null>(null);
  const [view, setView] = useState<'map' | 'guide'>('map');

  const words = search.toLowerCase().split(/\s+/).filter(Boolean);
  const results = useMemo(() => {
    if (words.length === 0) return null;
    return MANUAL.flatMap((section) =>
      section.topics
        .filter((topic) => words.every((word) => `${section.title} ${topic.title} ${topic.what} ${topic.steps.join(' ')} ${(topic.tips ?? []).join(' ')}`.toLowerCase().includes(word)))
        .map((topic) => ({ section, topic })),
    );
  }, [words.join(' ')]); // eslint-disable-line react-hooks/exhaustive-deps

  const section = MANUAL.find((item) => item.id === sectionId) ?? MANUAL[0]!;
  const toggle = (key: string) => setOpenTopic((current) => (current === key ? null : key));

  return (
    <div className="flex flex-col gap-5" data-testid="user-manual">
      {/* the top: what this is, and the search */}
      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-gradient-to-br from-primary/5 to-background p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <BookOpen className="h-5 w-5" />
          </span>
          <div>
            <h3 className="text-xl font-semibold tracking-tight">Manual përdorimi</h3>
            <p className="text-sm text-foreground/65">Së pari harta e gjithë CRM-së, pastaj udhëzuesi hap pas hapi me video për çdo proces.</p>
          </div>
        </div>
        <div className={`relative sm:max-w-lg ${view === 'guide' ? '' : 'hidden'}`}>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />
          <Input className="h-10 pl-9" placeholder="Kërko në manual (p.sh. No Show, transfer, tarifë, CV)…" value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-background p-1 shadow-sm" role="tablist" aria-label="Pamjet e manualit">
        {([
          { key: 'map', label: '1 · Harta e CRM-së', icon: GitBranch },
          { key: 'guide', label: '2 · Udhëzuesi hap pas hapi', icon: BookOpen },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={view === key}
            onClick={() => setView(key)}
            className={`flex shrink-0 items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${view === key ? 'bg-primary text-primary-foreground shadow-sm' : 'text-foreground/70 hover:bg-accent'}`}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {view === 'map' ? (
        <CrmFlowMap
          onOpen={(id) => {
            setSectionId(id);
            setOpenTopic(null);
            setSearch('');
            setView('guide');
          }}
        />
      ) : results ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-foreground/60">{results.length} rezultat{results.length === 1 ? '' : 'e'}</p>
          {results.length === 0 ? <p className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-foreground/55">Asgjë nuk përputhet me “{search}”.</p> : null}
          {results.map(({ section: found, topic }, position) => (
            <div key={`${found.id}/${topic.id}`}>
              <p className="mb-1 text-xs font-medium text-foreground/50">{found.title}</p>
              <ul>
                <Topic section={found} topic={topic} canEdit={canEdit} index={position} open={openTopic === `${found.id}/${topic.id}`} onToggle={() => toggle(`${found.id}/${topic.id}`)} />
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* the sections, as tiles */}
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4" role="tablist" aria-label="Seksionet e manualit">
            {MANUAL.map((item) => {
              const Icon = SECTION_ICON[item.id] ?? BookOpen;
              const active = item.id === section.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    setSectionId(item.id);
                    setOpenTopic(null);
                  }}
                  className={`flex items-start gap-2.5 rounded-xl border p-3 text-left transition-colors ${active ? 'border-primary bg-primary/5 shadow-sm' : 'border-border bg-background hover:bg-accent/40'}`}
                >
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${active ? 'bg-primary text-primary-foreground' : 'bg-accent text-foreground/60'}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[13px] font-semibold leading-tight">{item.title}</span>
                    <span className="text-[11px] text-foreground/50">{item.topics.length} tema</span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex min-w-0 flex-col gap-3">
            <div>
              <h4 className="text-lg font-semibold">{section.title}</h4>
              <p className="text-xs font-medium text-foreground/50">{section.where}</p>
              <p className="mt-1 text-sm text-foreground/70">{section.summary}</p>
            </div>
            <ul className="flex flex-col gap-2.5">
              {section.topics.map((topic, position) => (
                <Topic key={topic.id} section={section} topic={topic} canEdit={canEdit} index={position} open={openTopic === `${section.id}/${topic.id}`} onToggle={() => toggle(`${section.id}/${topic.id}`)} />
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
