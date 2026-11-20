/**
 * Every stage of a pipeline has a colour of its own, the same everywhere it appears: the column on the board, the
 * edge of the cards in it, the stage's status badge, the stage chip in the pop-up and the button that moves a card
 * into it. Moving a card to another column therefore changes its colour — the move is visible without reading
 * anything — and a button always has the colour of where it leads.
 *
 *   New deep blue · Screening violet · Interview sky blue · Offer light green · hired green · Rejected red · Completed slate
 *
 * Outcomes inside a stage keep their own meaning on top of that (see stageStatus): green = good, amber = waiting,
 * red = stopped. The class names are written out in full — Tailwind only ships the classes it can read in the source.
 */
export type StageTone = 'navy' | 'sky' | 'lightgreen' | 'blue' | 'violet' | 'orange' | 'teal' | 'green' | 'red' | 'amber' | 'slate';

export type ToneBadge = 'default' | 'navy' | 'sky' | 'green' | 'violet' | 'orange' | 'teal' | 'success' | 'destructive' | 'warning' | 'slate';

export interface ToneClasses {
  /** Badge variant of @crm/ui. */
  badge: ToneBadge;
  /** Solid fill: the bar on top of a column, the dot next to a name. */
  solid: string;
  /** Column header background, and the fill of the cards in the column. */
  soft: string;
  /** Column border. */
  border: string;
  /** Left edge of a card. */
  edge: string;
  /** The count chip in a column header. */
  chip: string;
  /** A button that moves a card into the stage, or sets the status this colour stands for. */
  button: string;
}

export const TONES: Record<StageTone, ToneClasses> = {
  navy: { badge: 'navy', solid: 'bg-blue-900', soft: 'bg-blue-50', border: 'border-blue-200', edge: 'border-l-blue-900', chip: 'bg-blue-700 text-white', button: 'bg-blue-900 text-white hover:bg-blue-800' },
  sky: { badge: 'sky', solid: 'bg-sky-500', soft: 'bg-sky-50', border: 'border-sky-200', edge: 'border-l-sky-500', chip: 'bg-sky-600 text-white', button: 'bg-sky-500 text-white hover:bg-sky-600' },
  lightgreen: { badge: 'green', solid: 'bg-green-500', soft: 'bg-green-50', border: 'border-green-200', edge: 'border-l-green-500', chip: 'bg-green-600 text-white', button: 'bg-green-500 text-white hover:bg-green-600' },
  blue: { badge: 'default', solid: 'bg-blue-600', soft: 'bg-blue-50', border: 'border-blue-200', edge: 'border-l-blue-600', chip: 'bg-blue-600 text-white', button: 'bg-blue-600 text-white hover:bg-blue-700' },
  violet: { badge: 'violet', solid: 'bg-violet-600', soft: 'bg-violet-50', border: 'border-violet-200', edge: 'border-l-violet-600', chip: 'bg-violet-600 text-white', button: 'bg-violet-600 text-white hover:bg-violet-700' },
  orange: { badge: 'orange', solid: 'bg-orange-600', soft: 'bg-orange-50', border: 'border-orange-200', edge: 'border-l-orange-600', chip: 'bg-orange-700 text-white', button: 'bg-orange-600 text-white hover:bg-orange-700' },
  teal: { badge: 'teal', solid: 'bg-teal-600', soft: 'bg-teal-50', border: 'border-teal-200', edge: 'border-l-teal-600', chip: 'bg-teal-700 text-white', button: 'bg-teal-600 text-white hover:bg-teal-700' },
  green: { badge: 'success', solid: 'bg-emerald-600', soft: 'bg-emerald-50', border: 'border-emerald-200', edge: 'border-l-emerald-600', chip: 'bg-emerald-700 text-white', button: 'bg-emerald-600 text-white hover:bg-emerald-700' },
  red: { badge: 'destructive', solid: 'bg-red-600', soft: 'bg-red-50', border: 'border-red-200', edge: 'border-l-red-600', chip: 'bg-red-600 text-white', button: 'bg-red-600 text-white hover:bg-red-700' },
  amber: { badge: 'warning', solid: 'bg-amber-400', soft: 'bg-amber-50', border: 'border-amber-200', edge: 'border-l-amber-400', chip: 'bg-amber-400 text-slate-950', button: 'bg-amber-400 text-slate-950 hover:bg-amber-500' },
  slate: { badge: 'slate', solid: 'bg-slate-500', soft: 'bg-slate-50', border: 'border-slate-200', edge: 'border-l-slate-500', chip: 'bg-slate-600 text-white', button: 'bg-slate-600 text-white hover:bg-slate-700' },
};

const BY_NAME: Record<string, StageTone> = {
  new: 'navy',
  'job applicants': 'navy',
  'sent cv': 'navy',
  'interview 1': 'violet',
  'interview 2': 'sky',
  active: 'green',
  screening: 'violet',
  'phone screening': 'violet',
  interview: 'sky',
  'trial day': 'orange',
  'client interview': 'amber',
  offer: 'lightgreen',
  completed: 'slate',
};

/** For stages the scheme does not know by name: by their place in the pipeline, so neighbours still differ. */
const BY_ORDER: StageTone[] = ['navy', 'violet', 'sky', 'lightgreen', 'amber', 'slate'];

export function stageTone(stage: { name: string; type: string; order?: number }): StageTone {
  if (stage.type === 'PLACED') return 'green';
  if (stage.type === 'REJECTED') return 'red';
  return BY_NAME[stage.name.trim().toLowerCase()] ?? BY_ORDER[((stage.order ?? 1) - 1) % BY_ORDER.length]!;
}

export const stageColors = (stage: { name: string; type: string; order?: number }): ToneClasses => TONES[stageTone(stage)];

/** Pipeline Companies: the four fixed stages. */
export const COMPANY_STAGE_TONE: Record<'NEW' | 'IN_CONVERSATION' | 'WIN' | 'LOST', StageTone> = {
  NEW: 'navy',
  IN_CONVERSATION: 'orange',
  WIN: 'green',
  LOST: 'red',
};

/**
 * Pipeline Candidates: every column is white and so are its cards — the stage's colour shows only as the bar along the
 * top of the column (with its count chip) and the left edge of its cards. Interview is sky blue and Offer light green
 * here (New deep blue, Screening violet, hired green, Rejected red, Completed slate come from the stage's own tone).
 */
export interface ColumnFill {
  /** The column's outline and body. */
  box: string;
  /** The heading row. */
  header: string;
  /** The coloured bar on top. */
  bar: string;
  /** The count chip. */
  chip: string;
  /** The left edge of the cards in the column. */
  edge: string;
  /** The stage buttons in a card's pop-up: filled with the colour of the bar on top. */
  button: string;
  /** The button on a card on the board (Stage notes & pay): the same colour, and it stays that colour under the mouse. */
  cardButton: string;
}

/**
 * The colour of the bar on top as a filled button — written out in full, so Tailwind ships the classes.
 *  - `POPUP_BUTTON`: the stage buttons in a card's pop-up; they darken a little when the mouse is over them.
 *  - `CARD_BUTTON`: the button on a card on the board ("Stage notes & pay"): white, outlined in the stage's colour, and it does not change under the mouse.
 */
const POPUP_BUTTON: Record<StageTone, string> = {
  navy: 'border-blue-900 bg-blue-900 text-white hover:bg-blue-800 hover:text-white',
  sky: 'border-sky-500 bg-sky-500 text-white hover:bg-sky-600 hover:text-white',
  lightgreen: 'border-green-500 bg-green-500 text-white hover:bg-green-600 hover:text-white',
  blue: 'border-blue-600 bg-blue-600 text-white hover:bg-blue-700 hover:text-white',
  violet: 'border-violet-600 bg-violet-600 text-white hover:bg-violet-700 hover:text-white',
  orange: 'border-orange-600 bg-orange-600 text-white hover:bg-orange-700 hover:text-white',
  teal: 'border-teal-600 bg-teal-600 text-white hover:bg-teal-700 hover:text-white',
  green: 'border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700 hover:text-white',
  red: 'border-red-600 bg-red-600 text-white hover:bg-red-700 hover:text-white',
  amber: 'border-amber-400 bg-amber-400 text-slate-950 hover:bg-amber-500 hover:text-slate-950',
  slate: 'border-slate-500 bg-slate-500 text-white hover:bg-slate-600 hover:text-white',
};
const CARD_BUTTON: Record<StageTone, string> = {
  navy: 'border-2 border-blue-900 bg-background text-foreground hover:bg-background hover:text-foreground',
  sky: 'border-2 border-sky-500 bg-background text-foreground hover:bg-background hover:text-foreground',
  lightgreen: 'border-2 border-green-500 bg-background text-foreground hover:bg-background hover:text-foreground',
  blue: 'border-2 border-blue-600 bg-background text-foreground hover:bg-background hover:text-foreground',
  violet: 'border-2 border-violet-600 bg-background text-foreground hover:bg-background hover:text-foreground',
  orange: 'border-2 border-orange-600 bg-background text-foreground hover:bg-background hover:text-foreground',
  teal: 'border-2 border-teal-600 bg-background text-foreground hover:bg-background hover:text-foreground',
  green: 'border-2 border-emerald-600 bg-background text-foreground hover:bg-background hover:text-foreground',
  red: 'border-2 border-red-600 bg-background text-foreground hover:bg-background hover:text-foreground',
  amber: 'border-2 border-amber-400 bg-background text-foreground hover:bg-background hover:text-foreground',
  slate: 'border-2 border-slate-500 bg-background text-foreground hover:bg-background hover:text-foreground',
};

const WHITE = { box: 'border-border bg-background', header: 'border-border bg-background' } as const;

/** The column design for a stage colour — Pipeline Candidates and Pipeline Companies use the same one. */
export function fillForTone(key: StageTone): ColumnFill {
  const tone = TONES[key];
  return { ...WHITE, bar: tone.solid, chip: tone.chip, edge: tone.edge, button: POPUP_BUTTON[key], cardButton: CARD_BUTTON[key] };
}

export const columnFill = (stage: { name: string; type: string; order?: number }): ColumnFill => fillForTone(stageTone(stage));
