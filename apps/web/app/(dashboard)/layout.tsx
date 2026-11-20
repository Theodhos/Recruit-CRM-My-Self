import { ConfirmHost } from '@/components/dialogs/confirm-dialog';
import { DashboardShell } from '@/components/layout/dashboard-shell';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardShell>
      {children}
      <ConfirmHost />
    </DashboardShell>
  );
}
