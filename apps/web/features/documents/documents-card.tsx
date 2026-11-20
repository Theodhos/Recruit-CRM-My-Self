'use client';

import { Button, Card, CardContent, CardHeader, CardTitle } from '@crm/ui';
import { Eye, FileText, Plus, Trash2 } from '@crm/ui/icons';
import { useRef, useState } from 'react';

import { confirmDialog } from '@/components/dialogs/confirm-dialog';
import { useDeleteDocument, useDocuments, useUploadDocument } from '@/hooks/use-documents';
import type { DocumentWithRelations, UploadDocumentInput } from '@/services/documents.service';

import { DocumentPreviewDialog } from './document-preview-dialog';

const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
const fileSize = (bytes: number) => (bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);
const label = (value: string) => (value === 'WIN_PROOF' ? 'Signed proof' : value).replaceAll('_', ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

/** What the documents belong to — the same keys filter the list and are stamped on what is added. */
export type DocumentsOwner = Pick<UploadDocumentInput, 'candidateId' | 'companyId' | 'jobId' | 'placementId'>;

/**
 * The documents of a candidate, a company or a job, on that record's own page: each one opens inside the platform
 * (Preview), more can be added (Add document) and removed. `skip` leaves some out of the list (a candidate's CVs
 * have their own card).
 */
export function DocumentsCard({
  title = 'Documents',
  owner,
  skip,
}: {
  title?: string;
  owner: DocumentsOwner;
  skip?: (document: DocumentWithRelations) => boolean;
}) {
  const { data, isLoading } = useDocuments({ ...owner, pageSize: 100 });
  const upload = useUploadDocument();
  const remove = useDeleteDocument();
  const input = useRef<HTMLInputElement>(null);
  const [previewing, setPreviewing] = useState<DocumentWithRelations | null>(null);
  const [error, setError] = useState<string | null>(null);

  const documents = (data?.items ?? []).filter((d) => !skip?.(d));

  // any kind of file — a photo, Word, PDF, text, Excel, a zip… — one or several at once
  async function add(files: File[]) {
    if (files.length === 0) return;
    setError(null);
    const failed: string[] = [];
    for (const file of files) {
      try {
        await upload.mutateAsync({ file, type: 'OTHER', ...owner });
      } catch (e) {
        failed.push(`${file.name}: ${e instanceof Error ? e.message : 'could not be uploaded'}`);
      }
    }
    if (failed.length > 0) setError(failed.join(' · '));
  }

  return (
    <Card data-testid="documents-card">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-4 w-4 text-foreground/50" /> {title} ({documents.length})
        </CardTitle>
        <input
          ref={input}
          type="file"
          multiple
          className="hidden"
          data-testid="documents-card-input"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = '';
            void add(files);
          }}
        />
        <Button type="button" size="sm" disabled={upload.isPending} onClick={() => input.current?.click()}>
          <Plus className="mr-1 h-3.5 w-3.5" /> {upload.isPending ? 'Uploading…' : 'Add document'}
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-foreground/50">Loading…</p>
        ) : documents.length === 0 ? (
          <p className="text-sm text-foreground/50">No documents yet — add the first one.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border text-sm">
            {documents.map((document) => (
              <li key={document.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div className="min-w-0">
                  <p className="truncate font-medium">{document.name}</p>
                  <p className="text-xs text-foreground/50">
                    {label(document.type)} · {fileSize(document.fileSize)} · {day(document.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button type="button" size="sm" onClick={() => setPreviewing(document)}>
                    <Eye className="mr-1 h-3.5 w-3.5" /> Preview
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    aria-label="Delete document"
                    disabled={remove.isPending}
                    onClick={async () => {
                    if (await confirmDialog(`Delete ${document.name}?`)) remove.mutate(document.id);
                  }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {error ? (
          <p className="mt-2 text-xs text-red-600" role="alert">
            {error}
          </p>
        ) : null}
      </CardContent>
      {previewing ? <DocumentPreviewDialog document={previewing} onClose={() => setPreviewing(null)} /> : null}
    </Card>
  );
}
