import { PERMISSIONS_KEY } from '@crm/auth';

import { CandidatesController } from './candidates.controller';

const required = (method: keyof CandidatesController) => Reflect.getMetadata(PERMISSIONS_KEY, CandidatesController.prototype[method]) as string[] | undefined;

describe('CandidatesController — who may export and record consent', () => {
  it('previewing and downloading a contact list needs the export permission', () => {
    expect(required('previewExport')).toEqual(['candidate:export']);
    expect(required('exportCandidates')).toEqual(['candidate:export']);
  });

  it('recording consent for many people is for administrators only', () => {
    expect(required('setConsent')).toEqual(['users:manage']);
  });

  it('listing candidates still only needs to read them (the export permission is separate)', () => {
    expect(required('list')).toEqual(['candidate:read']);
  });
});
