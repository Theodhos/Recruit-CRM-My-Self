'use client';

import { ChevronLeft, ChevronRight, Gauge, Maximize2, Minimize2, Pause, Play, RotateCcw } from '@crm/ui/icons';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';

/** One moment of a demo: a screen of the platform, where the pointer goes (an element marked data-demo="…"), and what is said. */
export interface DemoScene {
  caption: string;
  screen: ReactNode;
  /** The element the pointer moves to and presses (`data-demo` in the screen). */
  target?: string;
  /** Something the pointer is carrying (a file or a card being dragged). */
  carry?: string;
  /** How long the scene lasts, in ms (3800 by default). */
  ms?: number;
  /** A short name for the step, shown above the caption ("Zgjidh punën"). */
  step?: string;
}

export const STAGE_WIDTH = 960;
export const STAGE_HEIGHT = 540;

const SPEEDS = [1, 1.5, 0.75] as const;

/**
 * An animated walkthrough of the platform that plays like a video: a browser window shows the CRM's own screens one after
 * another, a pointer moves and presses, and a subtitle says what is done. Play, pause, step back and forward, change the
 * speed, go full screen, or jump to any step. It is built from the platform's own screens and labels, so what is shown is
 * what is on the screen.
 */
export function DemoPlayer({ title, scenes }: { title: string; scenes: DemoScene[] }) {
  const root = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.6);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speedAt, setSpeedAt] = useState(0);
  const [full, setFull] = useState(false);
  const [pointer, setPointer] = useState<{ x: number; y: number }>({ x: STAGE_WIDTH * 0.7, y: STAGE_HEIGHT * 0.8 });
  const scene = scenes[index]!;
  const speed = SPEEDS[speedAt]!;
  const duration = (scene.ms ?? 3800) / speed;

  // people who asked their system for less motion start paused
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) setPlaying(false);
  }, []);

  // the stage is drawn at a fixed size and scaled to the room there is
  useEffect(() => {
    const node = box.current;
    if (!node) return;
    const measure = () => setScale(node.clientWidth / STAGE_WIDTH);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [full]);

  useEffect(() => {
    if (!playing) return;
    const timer = setTimeout(() => setIndex((current) => (current + 1) % scenes.length), duration);
    return () => clearTimeout(timer);
  }, [index, playing, duration, scenes.length]);

  useEffect(() => {
    const onChange = () => setFull(document.fullscreenElement === root.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  // the pointer goes to the centre of the element the scene points at
  useLayoutEffect(() => {
    const host = stage.current;
    if (!host || !scene.target) return;
    const element = host.querySelector<HTMLElement>(`[data-demo="${scene.target}"]`);
    if (!element) return;
    const outer = host.getBoundingClientRect();
    const inner = element.getBoundingClientRect();
    setPointer({ x: (inner.left - outer.left + inner.width / 2) / scale, y: (inner.top - outer.top + inner.height / 2) / scale });
  }, [index, scale, scene.target]);

  const go = useCallback((next: number) => setIndex((next + scenes.length) % scenes.length), [scenes.length]);
  const toggleFull = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void root.current?.requestFullscreen?.();
  };

  return (
    <div
      ref={root}
      className={`flex flex-col overflow-hidden border border-slate-700 bg-slate-900 shadow-lg ${full ? 'justify-center' : 'rounded-xl'}`}
      data-testid="demo-player"
      aria-label={`Demo: ${title}`}
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'ArrowRight') go(index + 1);
        else if (event.key === 'ArrowLeft') go(index - 1);
        else if (event.key === ' ') {
          event.preventDefault();
          setPlaying((current) => !current);
        }
      }}
    >
      <style>{`
        @keyframes demo-fade { from { opacity: 0; transform: translateY(6px) scale(0.995); } to { opacity: 1; transform: none; } }
        @keyframes demo-click { 0% { transform: translate(-50%, -50%) scale(0.2); opacity: 0.9; } 100% { transform: translate(-50%, -50%) scale(2.4); opacity: 0; } }
        @keyframes demo-pulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.55); } 50% { box-shadow: 0 0 0 6px rgba(59, 130, 246, 0); } }
        @keyframes demo-fill { from { width: 0%; } to { width: 100%; } }
        @keyframes demo-ring { 0% { transform: translate(-50%, -50%) scale(0.4); opacity: 0.9; } 100% { transform: translate(-50%, -50%) scale(2.2); opacity: 0; } }
        .demo-scene { animation: demo-fade 0.45s ease both; }
        .demo-pulse { animation: demo-pulse 1.4s ease-in-out infinite; }
      `}</style>

      {/* the window the platform is shown in */}
      <div className="flex items-center gap-3 border-b border-slate-700 bg-slate-800 px-3 py-2">
        <span className="flex gap-1.5" aria-hidden="true">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
        </span>
        <span className="min-w-0 flex-1 truncate rounded-md bg-slate-900/70 px-3 py-1 text-center text-[11px] text-slate-300">{title}</span>
        <span className="rounded bg-blue-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-300">Demo</span>
      </div>

      <div ref={box} className="relative w-full overflow-hidden" style={{ height: STAGE_HEIGHT * scale }}>
        <div ref={stage} className="absolute left-0 top-0 origin-top-left bg-white" style={{ width: STAGE_WIDTH, height: STAGE_HEIGHT, transform: `scale(${scale})` }}>
          <div key={index} className="demo-scene absolute inset-0">
            {scene.screen}
          </div>

          {/* the pointer */}
          <div className="pointer-events-none absolute left-0 top-0 z-50" style={{ transform: `translate(${pointer.x}px, ${pointer.y}px)`, transition: 'transform 0.95s cubic-bezier(0.4, 0, 0.2, 1)' }}>
            <svg width="26" height="26" viewBox="0 0 24 24" style={{ marginLeft: -4, marginTop: -3, filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))' }}>
              <path d="M5 3l14 8-6 1.5L10.5 19z" fill="#111827" stroke="#fff" strokeWidth="1.5" strokeLinejoin="round" />
            </svg>
            {scene.carry ? <span className="absolute left-4 top-4 whitespace-nowrap rounded-md border border-primary bg-white px-2 py-1 text-[12px] font-medium shadow-lg">{scene.carry}</span> : null}
            {scene.target ? <span key={`click-${index}`} className="absolute left-0 top-0 h-8 w-8 rounded-full bg-blue-500/40" style={{ animation: 'demo-click 0.6s ease-out 1s both' }} /> : null}
            {scene.target ? <span key={`ring-${index}`} className="absolute left-0 top-0 h-8 w-8 rounded-full border-2 border-blue-500" style={{ animation: 'demo-ring 0.8s ease-out 1s both' }} /> : null}
          </div>
        </div>

        {/* the subtitle, over the foot of the picture */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/90 via-slate-950/70 to-transparent px-4 pb-3 pt-10">
          <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-wider text-blue-300">
            Hapi {index + 1} nga {scenes.length}
            {scene.step ? ` · ${scene.step}` : ''}
          </p>
          <p className="text-sm font-medium leading-snug text-white sm:text-[15px]" aria-live="polite">
            {scene.caption}
          </p>
        </div>
      </div>

      {/* the controls: the steps are the progress */}
      <div className="flex flex-col gap-2 bg-slate-900 px-3 py-2.5 text-white">
        <div className="flex gap-1" role="tablist" aria-label="Hapat">
          {scenes.map((item, position) => (
            <button
              key={item.caption}
              type="button"
              role="tab"
              aria-selected={position === index}
              aria-label={`Hapi ${position + 1}`}
              onClick={() => {
                setIndex(position);
                setPlaying(false);
              }}
              className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-white/20"
            >
              {position < index ? <span className="absolute inset-0 bg-white/70" /> : null}
              {position === index ? (
                <span key={`${index}-${speedAt}`} className="absolute inset-y-0 left-0 bg-blue-400" style={{ animation: `demo-fill ${duration}ms linear both`, animationPlayState: playing ? 'running' : 'paused', width: playing ? undefined : '100%' }} />
              ) : null}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <button type="button" aria-label="Hapi i mëparshëm" className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 hover:bg-white/20" onClick={() => go(index - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button type="button" aria-label={playing ? 'Pauzë' : 'Luaj'} className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-500 hover:bg-blue-400" onClick={() => setPlaying((current) => !current)}>
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
          <button type="button" aria-label="Hapi tjetër" className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 hover:bg-white/20" onClick={() => go(index + 1)}>
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Nga fillimi"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
            onClick={() => {
              setIndex(0);
              setPlaying(true);
            }}
          >
            <RotateCcw className="h-4 w-4" />
          </button>
          <span className="ml-1 text-xs text-white/50">
            {index + 1} / {scenes.length}
          </span>
          <span className="flex-1" />
          <button type="button" aria-label="Shpejtësia" className="flex h-8 items-center gap-1 rounded-full bg-white/10 px-2.5 text-xs font-medium hover:bg-white/20" onClick={() => setSpeedAt((current) => (current + 1) % SPEEDS.length)}>
            <Gauge className="h-3.5 w-3.5" /> {speed}×
          </button>
          <button type="button" aria-label={full ? 'Dil nga ekrani i plotë' : 'Ekran i plotë'} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 hover:bg-white/20" onClick={toggleFull}>
            {full ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}

export type { ReactNode };
