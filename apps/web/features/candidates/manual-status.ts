import type { PipelineStage } from '@crm/types';

import { updateApplication } from '@/services/applications.service';
import { updateCandidate, type CandidateWithCompany } from '@/services/candidates.service';
import { getPipeline } from '@/services/pipelines.service';
import { listPlacements, updatePlacement } from '@/services/placements.service';
import { upsertStageNote } from '@/services/stage-notes.service';

import type { StatusChoice } from './columns';

/** The candidate's own status that goes with each choice: what contact lists, exports and SMS read. */
const OWN_STATUS = { AVAILABLE: 'ACTIVE', ON_HOLD: 'PASSIVE', NOT_AVAILABLE: 'PLACED', DO_NOT_USE: 'DO_NOT_CONTACT' } as const;

const isInterview = (stage: PipelineStage) => stage.type === 'STANDARD' && /interview/i.test(stage.name);

/**
 * A status chosen by hand does what the same status does by itself on Pipeline Jobs, and the pipeline carries on from there:
 *  - On hold       -> the card goes to the Interview stage
 *  - Not available -> the card goes to the Placed stage: the person becomes an Active Employee (the job's placement is made)
 *  - Do not use    -> the card goes to Rejected, marked Terminated, and an active contract is ended
 *  - Available     -> a card at Interview / Placed / Rejected goes back to the first stage (Job Applicants)
 * A candidate who is not on a pipeline yet only gets the status. Resolves to a short description of what was done.
 */
export async function applyManualStatus(candidate: CandidateWithCompany, status: StatusChoice | null): Promise<string> {
  if (status === null) {
    await updateCandidate(candidate.id, { manualStatus: null });
    return 'Back to the automatic status.';
  }
  const current = candidate.currentApplication;
  let moved: string | null = null;
  let keepManual = !current;

  if (current) {
    const pipeline = await getPipeline(current.pipelineId);
    const stages = [...pipeline.stages].sort((a, b) => a.order - b.order);
    const here = stages.find((stage) => stage.name === current.stage);
    let target: PipelineStage | undefined;

    if (status === 'ON_HOLD') target = stages.find(isInterview);
    else if (status === 'NOT_AVAILABLE') target = stages.find((stage) => stage.type === 'PLACED');
    else if (status === 'DO_NOT_USE') target = stages.find((stage) => stage.type === 'REJECTED');
    else if (here && (here.type !== 'STANDARD' || isInterview(here))) target = stages.find((stage) => stage.type === 'STANDARD');

    if ((status === 'ON_HOLD' || status === 'NOT_AVAILABLE' || status === 'DO_NOT_USE') && !target) {
      throw new Error(`This candidate's pipeline has no ${status === 'ON_HOLD' ? 'Interview' : status === 'NOT_AVAILABLE' ? 'Placed' : 'Rejected'} stage to move the card to.`);
    }
    if (target && target.id !== here?.id) {
      await updateApplication(current.applicationId, { pipelineStageId: target.id });
      moved = target.name;
    }
    if (status === 'DO_NOT_USE' && target) {
      // like Terminated: the contract ends and the card is marked, which is what Do not use is read from
      const contracts = await listPlacements({ candidateId: candidate.id, status: 'ACTIVE', pageSize: 50 });
      for (const placement of contracts.items) {
        await updatePlacement(placement.id, { status: 'CANCELLED', endDate: new Date().toISOString().slice(0, 10) });
      }
      await upsertStageNote(current.applicationId, target.id, { notes: 'Set to Do not use by hand in Candidates.', fields: { reason: 'Terminated' } });
    }
    // the pipeline now says it; only a "Terminated" mark would still read as Do not use, so Available then has to stay set by hand
    keepManual = status === 'AVAILABLE' && Boolean(candidate.terminated);
  }

  await updateCandidate(candidate.id, { status: OWN_STATUS[status], manualStatus: keepManual ? status : null });
  return moved ? `Card moved to ${moved}.` : 'Status saved.';
}
