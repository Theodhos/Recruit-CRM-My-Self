'use client';

import { Button, Dialog, Label, Textarea } from '@crm/ui';
import { useState } from 'react';

import { useSaveCompanyPipelineRecord, useUpdateCompany } from '@/hooks/use-companies';

/**
 * Moving a company to Lost asks why: the reason is written to the Lost stage's notes (History). "Lost" only moves it;
 * "Do not contact" moves it to Lost too, with the Do not contact tag on its card.
 */
export function LostReasonDialog({
  company,
  beforeMove,
  onDone,
  onCancel,
}: {
  company: { id: string; name: string };
  /** Runs before the move — e.g. keeps what was typed in the pop-up. */
  beforeMove?: () => Promise<void>;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState<'LOST' | 'DO_NOT_CONTACT' | null>(null);
  const updateCompany = useUpdateCompany();
  const saveRecord = useSaveCompanyPipelineRecord();

  async function move(doNotContact: boolean) {
    if (!reason.trim()) return setError('Write the reason first.');
    setError(null);
    setWorking(doNotContact ? 'DO_NOT_CONTACT' : 'LOST');
    try {
      await beforeMove?.();
      await updateCompany.mutateAsync({ id: company.id, input: { pipelineStage: 'LOST', doNotContact } });
      await saveRecord.mutateAsync({ id: company.id, input: { stages: { LOST: { notes: reason.trim() } } } });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not move this company to Lost.');
    } finally {
      setWorking(null);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && !working && onCancel()}
      title={`Lost — ${company.name}`}
      description="Say why this company is lost. The reason is kept in its History."
      footer={
        <div className="flex w-full flex-wrap justify-end gap-2">
          <Button type="button" variant="ghost" disabled={working !== null} onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" variant="outline" className="border-red-300 text-red-700 hover:bg-red-50" disabled={working !== null} onClick={() => void move(true)} data-testid="lost-do-not-contact">
            {working === 'DO_NOT_CONTACT' ? 'Moving…' : 'Do not contact'}
          </Button>
          <Button type="button" disabled={working !== null} onClick={() => void move(false)} data-testid="lost-confirm">
            {working === 'LOST' ? 'Moving…' : 'Lost'}
          </Button>
        </div>
      }
    >
      <Label htmlFor="lost-reason" className="mb-1 block">
        Reason
      </Label>
      <Textarea id="lost-reason" rows={4} autoFocus placeholder="Why was this company lost?" value={reason} onChange={(event) => setReason(event.target.value)} />
      {error ? <p className="mt-2 text-sm text-red-600" role="alert">{error}</p> : null}
    </Dialog>
  );
}
