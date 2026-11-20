'use client';

import { Input, Label } from '@crm/ui';
import { CheckCircle2 } from '@crm/ui/icons';
import { useState } from 'react';

import { PageBanner } from '@/components/tables/page-banner';
import { CompletedJobsView } from '@/features/jobs/completed-jobs-view';

/**
 * Completed Jobs: the jobs whose every place is filled (Candidates needed reached on Active Employees), each in a
 * block of its own with the people who fill it and "5 of 5 filled". One filter, for jobs: it matches the job's
 * title, client or location.
 */
export default function CompletedJobsPage() {
  const [job, setJob] = useState('');

  return (
    <div className="flex flex-col gap-6">
      <PageBanner tone="emerald" icon={CheckCircle2} title="Completed Jobs" description="Jobs with every place filled, each with the people who fill it." />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="completed-job">Job</Label>
        <Input
          id="completed-job"
          className="w-72"
          placeholder="Job title, client or location"
          value={job}
          onChange={(event) => setJob(event.target.value)}
        />
      </div>

      <CompletedJobsView search={job} />
    </div>
  );
}
