'use client';

import { useApplications } from '@/hooks/use-applications';
import type { JobWithCompany } from '@/services/jobs.service';

/** Shown above the edit form of a Temporary job: how many candidates are on it, the working hours, days off and each person's shift — side by side. */
export function JobScheduleTable({ job }: { job: JobWithCompany }) {
  const { data: cards } = useApplications({ jobId: job.id, pageSize: 1 });
  const shifts = job.shifts ?? [];
  const people = Math.max(job.candidatesNeeded ?? 0, shifts.length);
  const columns: [string, string][] = [
    ['Candidates on this job', `${cards?.totalItems ?? 0}${job.candidatesNeeded ? ` of ${job.candidatesNeeded} needed` : ''}`],
    // older Temporary jobs still carry these; new ones no longer ask for them
    ...(job.workingHours ? ([['Working hours', job.workingHours]] as [string, string][]) : []),
    ...(job.daysOff ? ([['Days off', job.daysOff]] as [string, string][]) : []),
    ...Array.from({ length: shifts.some(Boolean) ? people : 0 }, (_, index): [string, string] => [`Person ${index + 1} · shift`, shifts[index] || '—']),
  ];
  return (
    <div className="mb-4 overflow-x-auto rounded-md border border-border text-sm" data-testid="job-schedule-table">
      <table className="w-full min-w-max border-collapse">
        <thead>
          <tr className="bg-accent/40">
            {columns.map(([label]) => (
              <th key={label} className="whitespace-nowrap border-r border-border px-3 py-2 text-left font-medium last:border-r-0">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr className="border-t border-border">
            {columns.map(([label, value]) => (
              <td key={label} className="whitespace-nowrap border-r border-border px-3 py-2 last:border-r-0">
                {value}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
