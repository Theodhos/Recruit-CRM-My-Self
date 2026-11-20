import { applyOwnerScope, OWNER_SCOPED_MODELS } from './owner-scope';

const U = 'user_1';

describe('applyOwnerScope', () => {
  it('leaves the shared book untouched — reads AND writes — for every user', () => {
    for (const model of ['Candidate', 'Company', 'Job', 'Contact', 'Application', 'ApplicationStageNote', 'Interview', 'Document', 'Placement']) {
      for (const op of ['findMany', 'count', 'groupBy', 'aggregate', 'findFirst', 'findUnique', 'update', 'updateMany', 'delete', 'deleteMany']) {
        const args = { where: { id: 'x' }, data: { a: 1 } };
        expect(applyOwnerScope(model, op, args, U)).toBe(args);
      }
    }
  });

  it('still limits calendar, calling lists and messages to the user\'s own', () => {
    expect(applyOwnerScope('CalendarEvent', 'findMany', {}, U)).toEqual({ where: { AND: [{ userId: U }] } });
    expect(applyOwnerScope('Phone', 'findMany', {}, U)).toEqual({ where: { AND: [{ ownerId: U }] } });
    expect(applyOwnerScope('PhoneCall', 'update', { where: { id: 'p' } }, U)).toEqual({ where: { id: 'p', AND: [{ phone: { ownerId: U } }] } });
    expect(applyOwnerScope('Communication', 'findMany', {}, U)).toEqual({ where: { AND: [{ OR: [{ userId: U }, { candidate: { ownerId: U } }] }] } });
  });

  it('keeps an existing filter on the same field instead of overwriting it', () => {
    expect(applyOwnerScope('Phone', 'updateMany', { where: { ownerId: { not: null } } }, U)).toEqual({
      where: { ownerId: { not: null }, AND: [{ ownerId: U }] },
    });
    expect(applyOwnerScope('CalendarEvent', 'findMany', { where: { AND: [{ type: 'MEETING' }] } }, U)).toEqual({
      where: { AND: [{ type: 'MEETING' }, { userId: U }] },
    });
  });

  it('makes the acting user the owner of what they create unless a candidate, company or job names another instructor', () => {
    expect(applyOwnerScope('Candidate', 'create', { data: { firstName: 'A' } }, U)).toEqual({ data: { firstName: 'A', ownerId: U } });
    expect(applyOwnerScope('Candidate', 'create', { data: { firstName: 'A', ownerId: 'someone_else' } }, U)).toEqual({
      data: { firstName: 'A', ownerId: 'someone_else' },
    });
    expect(applyOwnerScope('Company', 'createMany', { data: [{ name: 'A' }, { name: 'B', ownerId: 'x' }] }, U)).toEqual({
      data: [{ name: 'A', ownerId: U }, { name: 'B', ownerId: 'x' }],
    });
    // dependent records are always the actor's own
    expect(applyOwnerScope('Application', 'create', { data: { ownerId: 'x' } }, U)).toEqual({ data: { ownerId: U } });
  });

  it('leaves models that are not owner-scoped untouched (users, pipelines, notifications, ...)', () => {
    for (const model of ['User', 'Pipeline', 'PipelineStage', 'Notification', 'AuditLog', 'Role']) {
      const args = { where: { id: 'x' } };
      expect(applyOwnerScope(model, 'findMany', args, U)).toBe(args);
    }
    expect(OWNER_SCOPED_MODELS).not.toContain('user');
  });
});
