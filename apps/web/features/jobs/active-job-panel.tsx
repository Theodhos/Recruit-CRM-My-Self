'use client';

import { Button, Drawer } from '@crm/ui';
import type { JobSchedule } from '@crm/types';
import { useState } from 'react';

import { useJob, useUpdateJob } from '@/hooks/use-jobs';
import { usePlacements } from '@/hooks/use-placements';

import { PeopleWhoFilledIt } from './completed-jobs-view';
import { PersonCalendar } from './person-calendar';
import { ShiftDetailsFields } from './shift-details';

/**
* A running Temporary job opened from Active Jobs Temporary — only what changes while it runs: each person's working
 * days and hours (the calendar beside the panel), the shifts, and the people on it, any of whom can be taken off or
 * replaced by another candidate (same contract, pipeline stage and shift).
 */
export function ActiveJobPanel({ jobId, onClose }: { jobId: string; onClose: () => void }) {
  const { data: job } = useJob(jobId);
  const updateJob = useUpdateJob();
  const { data: jobPlacements } = usePlacements({ jobId, pageSize: 100 });
  const [people, setPeople] = useState<NonNullable<JobSchedule['people']> | null>(null);
  const [assignments, setAssignments] = useState<NonNullable<JobSchedule['assignments']> | null>(null);
  const [schedule, setSchedule] = useState<JobSchedule | null>(null);

  if (!job) return null;
  const currentPeople = people ?? job.schedule?.people ?? {};
  const currentAssignments = assignments ?? job.schedule?.assignments ?? {};
  const candidates = [
    ...new Map(
      (jobPlacements?.items ?? [])
        .filter((placement) => placement.status !== 'CANCELLED')
        .map((placement) => [placement.candidate.id, { id: placement.candidate.id, name: `${placement.candidate.firstName} ${placement.candidate.lastName}`.trim() }]),
    ).values(),
  ];

  // the weekdays (mon…sun) the calendar's dates fall on
  const weekdays = () => {
    const keys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const found = new Set<string>();
    for (const days of Object.values(currentPeople)) for (const date of Object.keys(days)) found.add(keys[new Date(`${date}T00:00:00`).getDay()]!);
    return ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].filter((key) => found.has(key));
  };

  // hours (the calendar) and shifts (the table) are saved together
  async function save() {
    const next = { ...job!.schedule, ...schedule, people: currentPeople, assignments: currentAssignments };
    if (!next.workDays?.length) next.workDays = weekdays();
    await updateJob.mutateAsync({ id: jobId, input: { schedule: next } });
  }


  return (
    <Drawer
      open
      onOpenChange={(open) => !open && onClose()}
      title={job.title}
      className="max-w-[90rem]"
      side={
        (
          <PersonCalendar
            people={currentPeople}
            count={Math.max(schedule?.shiftCount ?? job.schedule?.shiftCount ?? 1, 1)}
            shifts={[]}
            startDate={schedule?.startDate ?? job.schedule?.startDate}
            endDate={schedule?.endDate ?? job.schedule?.endDate}
            saving={updateJob.isPending}
            onChange={setPeople}
            candidates={candidates}
            assignments={currentAssignments}
            onAssignmentsChange={setAssignments}
            onSave={() => void save()}
          />
        )
      }
    >
      <PeopleWhoFilledIt job={job} replaceable removable addable />
      <ShiftDetailsFields value={schedule ?? job.schedule ?? undefined} onChange={setSchedule} />
      <Button type="button" className="mt-4" disabled={updateJob.isPending} onClick={() => void save()}>
        {updateJob.isPending ? 'Saving…' : 'Save hours and shifts'}
      </Button>
    </Drawer>
  );
}
