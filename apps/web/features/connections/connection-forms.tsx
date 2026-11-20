'use client';

import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Select } from '@crm/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { HardDrive, Loader2, Lock, Video } from '@crm/ui/icons';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';

import { ApiClientError, apiClient } from '@/lib/api-client';

const messageOf = (error: unknown, fallback: string) => (error instanceof ApiClientError ? error.message : fallback);
const when = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

function Panel({ icon: Icon, title, description, testId, children }: { icon: typeof Video; title: string; description: string; testId: string; children: ReactNode }) {
  return (
    <Card data-testid={testId}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-4 w-4 text-foreground/50" /> {title}
        </CardTitle>
        <p className="mt-0.5 text-xs text-foreground/50">{description}</p>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

/** A secret that is already saved: shown masked and locked; "Change" opens an empty box for a new value. */
function SecretField({ id, label, masked, value, onChange, placeholder, help }: { id: string; label: string; masked: string | null; value: string; onChange: (value: string) => void; placeholder?: string; help?: string }) {
  const [changing, setChanging] = useState(false);
  const locked = Boolean(masked) && !changing;
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {locked ? (
        <div className="flex gap-2">
          <div className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-md border border-border bg-accent/30 px-3 font-mono text-sm text-foreground/70" title="Stored encrypted. It is never shown in full.">
            <Lock className="h-3.5 w-3.5 shrink-0 text-foreground/40" /> <span className="truncate">{masked}</span>
          </div>
          <Button type="button" variant="outline" onClick={() => setChanging(true)}>
            Change
          </Button>
        </div>
      ) : (
        <div className="flex gap-2">
          <Input id={id} type="password" autoComplete="new-password" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder ?? 'Paste it here'} />
          {masked ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setChanging(false);
                onChange('');
              }}
            >
              Keep
            </Button>
          ) : null}
        </div>
      )}
      {help ? <p className="text-xs text-foreground/55">{help}</p> : null}
    </div>
  );
}

function Feedback({ notice, error }: { notice: string | null; error: string | null }) {
  if (error) return <p className="text-sm text-destructive" role="alert">{error}</p>;
  return notice ? <p className="text-sm text-emerald-700" role="status">{notice}</p> : null;
}

const sourceNote = (source: 'settings' | 'server' | 'none') =>
  source === 'settings' ? 'Set here in the platform.' : source === 'server' ? 'Set on the server. Saving here replaces it, and Remove goes back to the server’s own.' : 'Not set yet.';

// ---- Zoom ------------------------------------------------------------------------------------------------------

interface ZoomView {
  connected: boolean;
  source: 'settings' | 'server' | 'none';
  accountId: string;
  clientId: string;
  clientSecret: string | null;
  savedAt: string | null;
}

export function ZoomConnection() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['connections', 'zoom'], queryFn: () => apiClient<ZoomView>('/connections/zoom') });
  const [accountId, setAccountId] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;
    setAccountId(data.accountId);
    setClientId(data.clientId);
    setClientSecret('');
  }, [data]);

  const done = (view: ZoomView) => queryClient.setQueryData(['connections', 'zoom'], view);
  const save = useMutation({ mutationFn: () => apiClient<ZoomView>('/connections/zoom', { method: 'PUT', body: { accountId: accountId.trim(), clientId: clientId.trim(), ...(clientSecret.trim() ? { clientSecret: clientSecret.trim() } : {}) } }), onSuccess: done });
  const remove = useMutation({ mutationFn: () => apiClient<ZoomView>('/connections/zoom', { method: 'DELETE' }), onSuccess: done });

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    try {
      await save.mutateAsync();
      setNotice('Connected to Zoom. Interview meetings are now created automatically.');
    } catch (e) {
      setError(messageOf(e, 'Could not connect to Zoom.'));
    }
  }

  return (
    <Panel
      icon={Video}
      title="Zoom"
      description="Interview meetings are created in Zoom straight from the pipeline. The credentials are checked with Zoom before they are saved, and stored encrypted."
      testId="settings-connection-zoom"
    >
      {isLoading || !data ? (
        <p className="text-sm text-foreground/50">Loading…</p>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={data.connected ? 'success' : 'warning'} data-testid="zoom-status">
              {data.connected ? 'Connected' : 'Not connected'}
            </Badge>
            <span className="text-xs text-foreground/60">{sourceNote(data.source)}</span>
            {data.savedAt ? <span className="text-xs text-foreground/50">· saved {when(data.savedAt)}</span> : null}
          </div>

          <div className="rounded-lg border border-border bg-accent/20 p-3 text-xs text-foreground/70">
            <p className="mb-1 font-semibold text-foreground">What you need from Zoom</p>
            <ol className="list-decimal space-y-0.5 pl-4">
              <li>
                Open the Zoom App Marketplace (marketplace.zoom.us) → <b>Develop → Build App → Server-to-Server OAuth</b>.
              </li>
              <li>
                Under <b>Scopes</b> add <b>meeting:write:admin</b> (or <b>meeting:write</b>), then activate the app.
              </li>
              <li>
                Copy the <b>Account ID</b>, <b>Client ID</b> and <b>Client Secret</b> from the app’s <b>App Credentials</b> and put them below.
              </li>
            </ol>
          </div>

          <form noValidate onSubmit={(event) => void submit(event)} className="flex flex-col gap-3 sm:max-w-xl">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="zoom-account">Account ID</Label>
              <Input id="zoom-account" value={accountId} onChange={(event) => setAccountId(event.target.value)} autoComplete="off" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="zoom-client">Client ID</Label>
              <Input id="zoom-client" value={clientId} onChange={(event) => setClientId(event.target.value)} autoComplete="off" />
            </div>
            <SecretField id="zoom-secret" label="Client Secret" masked={data.clientSecret} value={clientSecret} onChange={setClientSecret} />
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={save.isPending || !accountId.trim() || !clientId.trim() || (!data.clientSecret && !clientSecret.trim())} data-testid="zoom-save">
                {save.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
                {data.connected ? 'Save changes' : 'Connect Zoom'}
              </Button>
              {data.source === 'settings' ? (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={remove.isPending}
                  onClick={() => {
                    if (window.confirm('Remove the Zoom credentials saved here? If the server has its own, those are used; otherwise meetings are no longer created.')) {
                      setError(null);
                      setNotice(null);
                      remove.mutate(undefined, { onError: (e) => setError(messageOf(e, 'Could not remove.')) });
                    }
                  }}
                >
                  Remove
                </Button>
              ) : null}
            </div>
            <Feedback notice={notice} error={error} />
          </form>
        </div>
      )}
    </Panel>
  );
}

// ---- File storage ----------------------------------------------------------------------------------------------

type Provider = 'gdrive' | 's3' | 'r2' | 'minio' | 'local';

interface StorageView {
  source: 'settings' | 'server';
  provider: Provider;
  bucket: string;
  region: string;
  endpoint: string;
  forcePathStyle: boolean;
  accessKeyId: string;
  secretAccessKey: string | null;
  driveClientId: string;
  driveClientSecret: string | null;
  driveRefreshToken: string | null;
  driveFolderId: string;
  savedAt: string | null;
  fallback: { at: string; message: string } | null;
}

const PROVIDER_LABEL: Record<Provider, string> = {
  gdrive: 'Google Drive',
  s3: 'Amazon S3',
  r2: 'Cloudflare R2',
  minio: 'MinIO (S3-compatible)',
  local: 'This server’s disk',
};

export function StorageConnection() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['connections', 'storage'], queryFn: () => apiClient<StorageView>('/connections/storage') });
  const [form, setForm] = useState<Record<string, string>>({});
  const [provider, setProvider] = useState<Provider>('gdrive');
  const [pathStyle, setPathStyle] = useState(false);
  const [secrets, setSecrets] = useState({ secretAccessKey: '', driveClientSecret: '', driveRefreshToken: '' });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;
    setProvider(data.provider);
    setPathStyle(data.forcePathStyle);
    setForm({ bucket: data.bucket, region: data.region, endpoint: data.endpoint, accessKeyId: data.accessKeyId, driveClientId: data.driveClientId, driveFolderId: data.driveFolderId });
    setSecrets({ secretAccessKey: '', driveClientSecret: '', driveRefreshToken: '' });
  }, [data]);

  const set = (field: string) => (event: { target: { value: string } }) => setForm((current) => ({ ...current, [field]: event.target.value }));
  const done = (view: StorageView) => queryClient.setQueryData(['connections', 'storage'], view);
  const save = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = { provider, forcePathStyle: pathStyle };
      for (const [key, value] of Object.entries(form)) body[key] = value.trim();
      for (const [key, value] of Object.entries(secrets)) if (value.trim()) body[key] = value.trim();
      return apiClient<StorageView>('/connections/storage', { method: 'PUT', body });
    },
    onSuccess: done,
  });
  const remove = useMutation({ mutationFn: () => apiClient<StorageView>('/connections/storage', { method: 'DELETE' }), onSuccess: done });

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (data && provider !== data.provider && !window.confirm('Change where files are kept? Files saved before this stay in the old place and will not open from the new one.')) return;
    setError(null);
    setNotice(null);
    try {
      await save.mutateAsync();
      setNotice('Saved. New files go to this storage from now on.');
    } catch (e) {
      setError(messageOf(e, 'Could not save the storage settings.'));
    }
  }

  const text = (id: string, label: string, help?: string, placeholder?: string) => (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={`storage-${id}`}>{label}</Label>
      <Input id={`storage-${id}`} value={form[id] ?? ''} onChange={set(id)} placeholder={placeholder} autoComplete="off" />
      {help ? <p className="text-xs text-foreground/55">{help}</p> : null}
    </div>
  );

  return (
    <Panel
      icon={HardDrive}
      title="File storage"
      description="Where CVs and documents are kept. What is set is shown here; secrets are stored encrypted and only their last characters are shown. Everything can be changed."
      testId="settings-connection-storage"
    >
      {isLoading || !data ? (
        <p className="text-sm text-foreground/50">Loading…</p>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="success" data-testid="storage-status">
              In use: {PROVIDER_LABEL[data.provider]}
            </Badge>
            <span className="text-xs text-foreground/60">{data.source === 'settings' ? 'Set here in the platform.' : 'Set on the server. Saving here replaces it, and Remove goes back to the server’s own.'}</span>
            {data.savedAt ? <span className="text-xs text-foreground/50">· saved {when(data.savedAt)}</span> : null}
          </div>

          {data.fallback ? (
            <div className="rounded-lg border border-amber-400 bg-amber-50 p-3 text-sm text-amber-950" role="alert" data-testid="storage-fallback">
              <p className="font-semibold">The storage refused the last file, so it was kept on this server’s disk.</p>
              <p className="mt-0.5 text-xs">
                {when(data.fallback.at)} — {data.fallback.message}
              </p>
              <p className="mt-1 text-xs">Uploads keep working and every file opens. To save new files in {PROVIDER_LABEL[data.provider]} again, reconnect it below: enter the new credentials (for Google Drive, a new refresh token) and press “Test and save”.</p>
            </div>
          ) : null}

          <form noValidate onSubmit={(event) => void submit(event)} className="flex flex-col gap-3 sm:max-w-xl">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="storage-provider">Storage</Label>
              <Select id="storage-provider" value={provider} onChange={(event) => setProvider(event.target.value as Provider)}>
                {(Object.keys(PROVIDER_LABEL) as Provider[]).map((value) => (
                  <option key={value} value={value}>
                    {PROVIDER_LABEL[value]}
                  </option>
                ))}
              </Select>
            </div>

            {provider === 'gdrive' ? (
              <>
                {text('driveClientId', 'Client ID', 'Google Cloud console → APIs & Services → Credentials → OAuth client.')}
                <SecretField id="storage-driveClientSecret" label="Client secret" masked={provider === data.provider ? data.driveClientSecret : null} value={secrets.driveClientSecret} onChange={(value) => setSecrets((s) => ({ ...s, driveClientSecret: value }))} />
                <SecretField id="storage-driveRefreshToken" label="Refresh token" masked={provider === data.provider ? data.driveRefreshToken : null} value={secrets.driveRefreshToken} onChange={(value) => setSecrets((s) => ({ ...s, driveRefreshToken: value }))} help="Made once with the project’s google-drive-auth script, signing in with the Google account that owns the folder." />
                {text('driveFolderId', 'Folder ID', 'The Drive folder files are kept in: the last part of its address (drive.google.com/drive/folders/…).')}
              </>
            ) : null}

            {provider === 's3' || provider === 'r2' || provider === 'minio' ? (
              <>
                {text('bucket', 'Bucket')}
                {text('endpoint', 'Endpoint', 'Leave empty for Amazon S3. R2 and MinIO need their address.', 'https://…')}
                {text('region', 'Region', 'Use “auto” for Cloudflare R2.')}
                {text('accessKeyId', 'Access key ID')}
                <SecretField id="storage-secretAccessKey" label="Secret access key" masked={provider === data.provider ? data.secretAccessKey : null} value={secrets.secretAccessKey} onChange={(value) => setSecrets((s) => ({ ...s, secretAccessKey: value }))} />
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" className="h-4 w-4 rounded border-border accent-primary" checked={pathStyle} onChange={(event) => setPathStyle(event.target.checked)} /> Use path-style addresses (MinIO)
                </label>
              </>
            ) : null}

            {provider === 'local' ? <p className="text-sm text-foreground/60">Files are kept on this server’s disk. Fine for one machine; with more than one server they would not be shared.</p> : null}

            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={save.isPending} data-testid="storage-save">
                {save.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
                Test and save
              </Button>
              {data.source === 'settings' ? (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={remove.isPending}
                  onClick={() => {
                    if (window.confirm('Remove the storage saved here and go back to the server’s own settings?')) {
                      setError(null);
                      setNotice(null);
                      remove.mutate(undefined, { onError: (e) => setError(messageOf(e, 'Could not remove.')) });
                    }
                  }}
                >
                  Remove
                </Button>
              ) : null}
            </div>
            <p className="text-xs text-foreground/50">The storage is reached with these settings before anything is saved; settings that do not work are refused.</p>
            <Feedback notice={notice} error={error} />
          </form>
        </div>
      )}
    </Panel>
  );
}
