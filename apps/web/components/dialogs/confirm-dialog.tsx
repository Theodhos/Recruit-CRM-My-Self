'use client';

import { Button } from '@crm/ui';
import { AlertTriangle, HelpCircle } from '@crm/ui/icons';
import { useEffect, useRef, useState } from 'react';

export interface ConfirmOptions {
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** `danger` (red) for deletions, `default` for everything else. Words like "delete" / "remove" switch it to danger on their own. */
  tone?: 'danger' | 'default';
  /** A notice with a single OK button (see `alertDialog`). */
  notice?: boolean;
}

type Request = ConfirmOptions & { message: string; resolve: (ok: boolean) => void };

let show: ((request: Request) => void) | null = null;
let lastNotice: { key: string; at: number } | null = null;

/**
 * Drop-in, nicer replacement for `window.confirm`: `if (!(await confirmDialog('Delete Ana?'))) return;`
 * Needs <ConfirmHost /> mounted once (the dashboard layout does); without it, falls back to the browser's box.
 */
export function confirmDialog(message: string, options: ConfirmOptions = {}): Promise<boolean> {
  if (!show) return Promise.resolve(window.confirm(message));
  return new Promise((resolve) => show!({ ...options, message, resolve }));
}

/**
 * A notice that cannot be missed: a pop-up in the middle of the screen with one OK button, shown over whatever is open
 * (a drawer, a form). `await alertDialog('This candidate is already in the system…')`. Without <ConfirmHost /> it uses the browser's alert.
 */
export function alertDialog(message: string, options: Pick<ConfirmOptions, 'title' | 'confirmLabel'> = {}): Promise<void> {
  // The same notice is said once: pressing OK does not bring it back (a form's Save and its close button can both trigger
  // it), until something else has been said or 15 seconds have passed.
  const key = `${options.title ?? ''}|${message}`;
  if (lastNotice && lastNotice.key === key && Date.now() - lastNotice.at < 15_000) return Promise.resolve();
  lastNotice = { key, at: Date.now() };
  if (!show) {
    window.alert(message);
    return Promise.resolve();
  }
  return new Promise((resolve) => show!({ ...options, notice: true, tone: 'danger', message, resolve: () => resolve() }));
}

export function ConfirmHost() {
  const [request, setRequest] = useState<Request | null>(null);
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    show = (next) => setRequest(next);
    return () => {
      show = null;
    };
  }, []);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (request && !node.open) node.showModal();
    if (!request && node.open) node.close();
  }, [request]);

  function finish(ok: boolean) {
    request?.resolve(ok);
    setRequest(null);
  }

  const danger = request ? (request.tone ? request.tone === 'danger' : /\b(delete|remove|cancel|deactivate|close)\b/i.test(request.message)) : false;
  const Icon = danger ? AlertTriangle : HelpCircle;

  return (
    <dialog
      ref={ref}
      onCancel={(event) => {
        event.preventDefault();
        finish(false);
      }}
      onClick={(event) => {
        if (event.target === ref.current) finish(false);
      }}
      className="w-full max-w-md rounded-xl border border-border bg-background p-0 text-foreground shadow-2xl backdrop:bg-black/50 backdrop:backdrop-blur-[2px]"
    >
      {request ? (
        <div className="flex flex-col items-center px-6 pb-5 pt-7 text-center">
          <div className={`flex h-14 w-14 items-center justify-center rounded-full ${danger ? 'bg-destructive/10 text-destructive' : 'bg-accent text-foreground/60'}`}>
            <Icon className="h-7 w-7" />
          </div>
          <h2 className="mt-4 text-lg font-semibold tracking-tight">{request.title ?? (request.notice ? 'Notice' : danger ? 'Are you sure?' : 'Please confirm')}</h2>
          <p className="mt-2 whitespace-pre-line text-sm text-foreground/60">{request.message}</p>
          <div className="mt-6 flex w-full gap-3">
            {request.notice ? null : (
              <Button type="button" variant="outline" className="flex-1" onClick={() => finish(false)}>
                {request.cancelLabel ?? 'Cancel'}
              </Button>
            )}
            <Button type="button" variant={danger ? 'destructive' : 'default'} className="flex-1" autoFocus onClick={() => finish(true)}>
              {request.confirmLabel ?? (request.notice ? 'OK' : danger ? 'Yes, continue' : 'Confirm')}
            </Button>
          </div>
        </div>
      ) : null}
    </dialog>
  );
}
