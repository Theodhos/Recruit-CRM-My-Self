'use client';

import type { Company } from '@crm/types';
import { Button, Dialog } from '@crm/ui';
import { Upload } from '@crm/ui/icons';
import { useRef, useState } from 'react';

import { useSaveCompanyPipelineRecord } from '@/hooks/use-companies';
import { useUploadDocument } from '@/hooks/use-documents';
import { useOrganisation } from '@/hooks/use-organisation';

import { AgreedFeeFields, agreedFeeDraft, agreedFeeValue } from './agreed-fee';

/**
 * A company only moves to Win with the fee agreed and with proof: the recruiter sets the fee (kept on the company's
 * profile, in its "Fee agreed" card) and uploads a screenshot or any document, which is saved on the profile in its
 * own category (Documents → Win proof). `onUploaded` then makes the move.
 */
export function WinProofDialog({
  company,
  onUploaded,
  onCancel,
}: {
  company: Pick<Company, 'id' | 'name'> & Partial<Pick<Company, 'pipelineRecord'>>;
  onUploaded: () => Promise<void> | void;
  onCancel: () => void;
}) {
  const upload = useUploadDocument();
  const saveRecord = useSaveCompanyPipelineRecord();
  const { data: organisation } = useOrganisation();
  const input = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(() => agreedFeeDraft(company, organisation?.payDefaults?.currency ?? 'GBP'));
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  /** The button: the fee must be filled in first, then the file picker opens. */
  function start() {
    if (agreedFeeValue(draft) === null) {
      setError('Enter the fee agreed with the company first.');
      return;
    }
    setError(null);
    input.current?.click();
  }

  async function choose(file: File | undefined) {
    if (!file) return;
    const fee = agreedFeeValue(draft);
    if (fee === null) return;
    setError(null);
    setWorking(true);
    try {
      // the fee first (it is required to move), then the proof, then the move itself
      await saveRecord.mutateAsync({ id: company.id, input: { win: { fee, currency: draft.currency, terms: draft.terms.trim() } } });
      await upload.mutateAsync({ file, type: 'WIN_PROOF', companyId: company.id });
      await onUploaded();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not move the company to Win.');
    } finally {
      setWorking(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && !working && onCancel()}
      title={`Move ${company.name} to Win`}
      description="Set the fee agreed with the company and upload a screenshot or any file (any format) as proof. Both are saved on the company's profile: the fee in its Fee agreed card, the file under Documents, in the Win proof category."
      footer={
        <Button type="button" variant="ghost" disabled={working} onClick={onCancel}>
          Cancel
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <AgreedFeeFields draft={draft} onChange={setDraft} disabled={working} idPrefix="win-fee" />
        <input
          ref={input}
          type="file"
          className="hidden"
          data-testid="win-proof-input"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            void choose(file);
          }}
        />
        <Button type="button" className="w-full" disabled={working} onClick={start} data-testid="win-proof-choose">
          <Upload className="mr-1.5 h-4 w-4" /> {working ? 'Saving…' : 'Choose a file and move to Win'}
        </Button>
        {error ? (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </Dialog>
  );
}
