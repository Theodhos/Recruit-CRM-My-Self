jest.mock('../../../infrastructure/database/database.service', () => ({ DatabaseService: class DatabaseService {} }));

import { PERMISSIONS_KEY } from '@crm/auth';

import { AppException } from '../../../common/exceptions/app.exception';
import { CommunicationsController, DialpadIntegrationController, MessageTemplatesController } from '../controller/communications.controller';
import { DialpadError } from '../dialpad/dialpad.client';
import { signDialpadJwt } from '../lib/dialpad-jwt';

import { BulkSmsService } from './bulk-sms.service';
import { CommunicationsService } from './communications.service';
import { DialpadWebhookService } from './dialpad-webhook.service';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

const candidate = (extra: Row = {}): Row => ({
  id: 'cand1',
  firstName: 'Jamie',
  lastName: 'Smith',
  status: 'ACTIVE',
  phone: '07911 123456',
  email: 'j@x.com',
  smsConsent: 'GRANTED',
  emailConsent: 'UNKNOWN',
  callConsent: 'UNKNOWN',
  ...extra,
});

/** A tiny in-memory stand-in for the parts of Prisma these services use. */
function makeDb(candidates: Row[] = [candidate()]) {
  const comms: Row[] = [];
  let seq = 0;
  const matches = (row: Row, where: Row = {}): boolean =>
    Object.entries(where).every(([key, cond]) => {
      if (key === 'createdAt') return row.createdAt >= (cond as Row).gte;
      if (cond && typeof cond === 'object' && 'notIn' in (cond as Row)) return !(cond as Row).notIn.includes(row[key]);
      if (cond && typeof cond === 'object' && 'in' in (cond as Row)) return (cond as Row).in.includes(row[key]);
      return row[key] === cond;
    });
  const communication = {
    create: jest.fn(async ({ data }: Row) => {
      const row = { id: `comm${++seq}`, createdAt: new Date(), updatedAt: new Date(), providerId: null, errorMessage: null, ...data };
      comms.push(row);
      return row;
    }),
    findFirst: jest.fn(async ({ where }: Row) => comms.find((r) => matches(r, where)) ?? null),
    findMany: jest.fn(async ({ where }: Row) => comms.filter((r) => matches(r, where))),
    findUnique: jest.fn(async ({ where }: Row) => {
      const k = where.organisationId_provider_providerId;
      return comms.find((r) => r.providerId === k.providerId) ?? null;
    }),
    findUniqueOrThrow: jest.fn(async ({ where }: Row) => comms.find((r) => r.id === where.id)!),
    update: jest.fn(async ({ where, data }: Row) => Object.assign(comms.find((r) => r.id === where.id)!, data)),
    updateMany: jest.fn(async ({ where, data }: Row) => {
      const hit = comms.filter((r) => matches(r, where));
      hit.forEach((r) => Object.assign(r, data));
      return { count: hit.length };
    }),
  };
  const candidateModel = {
    findFirst: jest.fn(async ({ where }: Row) => candidates.find((c) => c.id === where.id) ?? null),
    findMany: jest.fn(async ({ where }: Row = {}) => candidates.filter((c) => !where?.id?.in || where.id.in.includes(c.id))),
    updateMany: jest.fn(async () => ({ count: 1 })),
  };
  const client = {
    communication,
    candidate: { ...candidateModel, findFirst: jest.fn(async () => ({ id: 'cand1' })) },
    user: { findFirst: jest.fn(async () => ({ id: 'user1', firstName: 'Alex', lastName: 'Recruiter' })) },
  };
  const db = { client, forTenant: () => ({ candidate: candidateModel, communication, job: { findFirst: jest.fn(async () => ({ title: 'Electrician' })) }, application: { findFirst: jest.fn(async () => null), findMany: jest.fn(async () => []) } }) };
  return { db: db as never, comms, client };
}

function makeDialpad(overrides: Row = {}) {
  const dialpadClient = {
    sendSms: jest.fn().mockResolvedValue({ id: 'sms1', message_status: 'pending' }),
    initiateCall: jest.fn().mockResolvedValue({ device: { id: 'd' } }),
    ...overrides,
  };
  const connection = {
    clientFor: jest.fn().mockResolvedValue({ client: dialpadClient, fromNumber: '+442071234567', config: {} }),
    dialpadUserId: jest.fn().mockResolvedValue('555'),
    asException: jest.fn((e: Error) => new AppException('DIALPAD_ERROR', e.message, 502)),
    status: jest.fn().mockResolvedValue({ connected: true, fromNumber: '+442071234567' }),
  };
  return { dialpadClient, connection: connection as never, raw: connection };
}

describe('CommunicationsService — individual texts and calls', () => {
  it('sends a text from the company number, fills placeholders and records who sent it', async () => {
    const { db, comms } = makeDb();
    const { connection, dialpadClient } = makeDialpad();
    const service = new CommunicationsService(db, connection);

    const result = await service.sendSms('org1', 'user1', 'Alex Recruiter', 'cand1', 'Hi {{firstName}}, new job! {{recruiterName}}', null);

    expect(dialpadClient.sendSms).toHaveBeenCalledWith({ to: '+447911123456', text: 'Hi Jamie, new job! Alex Recruiter', fromNumber: '+442071234567' });
    expect(result.status).toBe('SENT');
    expect(comms[0]).toMatchObject({ candidateId: 'cand1', userId: 'user1', direction: 'OUTBOUND', type: 'SMS', providerId: 'sms1' });
  });

  it('does not text someone who opted out, never recorded consent, or is marked do-not-contact', async () => {
    for (const extra of [{ smsConsent: 'OPTED_OUT' }, { smsConsent: 'UNKNOWN' }, { status: 'DO_NOT_CONTACT' }]) {
      const { db } = makeDb([candidate(extra)]);
      const { connection, dialpadClient } = makeDialpad();
      await expect(new CommunicationsService(db, connection).sendSms('org1', 'u', 'A', 'cand1', 'Hello', null)).rejects.toMatchObject({ code: 'CONTACT_NOT_ALLOWED' });
      expect(dialpadClient.sendSms).not.toHaveBeenCalled();
    }
  });

  it('refuses unknown placeholders and a message that needs a job title nobody has', async () => {
    const { db } = makeDb();
    const { connection } = makeDialpad();
    const service = new CommunicationsService(db, connection);
    await expect(service.sendSms('org1', 'u', 'A', 'cand1', 'Hi {{nickname}}', null)).rejects.toMatchObject({ code: 'UNKNOWN_PLACEHOLDER' });
    await expect(service.sendSms('org1', 'u', 'A', 'cand1', 'A {{jobTitle}} job', null)).rejects.toMatchObject({ code: 'MISSING_PLACEHOLDER' });
  });

  it('stops a double click: the same words to the same person within a minute', async () => {
    const { db } = makeDb();
    const { connection, dialpadClient } = makeDialpad();
    const service = new CommunicationsService(db, connection);
    await service.sendSms('org1', 'u', 'A', 'cand1', 'Hello', null);
    await expect(service.sendSms('org1', 'u', 'A', 'cand1', 'Hello', null)).rejects.toMatchObject({ code: 'DUPLICATE_MESSAGE' });
    expect(dialpadClient.sendSms).toHaveBeenCalledTimes(1);
  });

  it('records a Dialpad failure on the history and tells the recruiter', async () => {
    const { db, comms } = makeDb();
    const { connection } = makeDialpad({ sendSms: jest.fn().mockRejectedValue(new DialpadError('invalid destination', 400)) });
    await expect(new CommunicationsService(db, connection).sendSms('org1', 'u', 'A', 'cand1', 'Hello', null)).rejects.toMatchObject({ code: 'SMS_FAILED' });
    expect(comms[0]).toMatchObject({ status: 'FAILED', errorMessage: 'invalid destination' });
  });

  it('puts a rate-limited text back in the queue and reports how long to wait', async () => {
    const { db, comms } = makeDb();
    const { connection } = makeDialpad({ sendSms: jest.fn().mockRejectedValue(new DialpadError('slow down', 429, 9000)) });
    const service = new CommunicationsService(db, connection);
    comms.push({ id: 'c1', organisationId: 'org1', candidateId: 'cand1', status: 'QUEUED', body: 'x', externalNumber: '+447911123456', createdAt: new Date() });
    const result = await service.deliver('c1');
    expect(result).toMatchObject({ status: 'QUEUED', retryAfterMs: 9000 });
    expect(comms[0]!.status).toBe('QUEUED');
  });

  it('never sends the same stored text twice (the row is claimed first)', async () => {
    const { db, comms } = makeDb();
    const { connection, dialpadClient } = makeDialpad();
    const service = new CommunicationsService(db, connection);
    comms.push({ id: 'c1', organisationId: 'org1', candidateId: 'cand1', status: 'QUEUED', body: 'x', externalNumber: '+447911123456', createdAt: new Date() });
    await Promise.all([service.deliver('c1'), service.deliver('c1')]);
    expect(dialpadClient.sendSms).toHaveBeenCalledTimes(1);
  });

  it('rings the recruiter\'s own Dialpad app and keeps the call against the candidate', async () => {
    const { db, comms } = makeDb();
    const { connection, dialpadClient } = makeDialpad();
    const result = await new CommunicationsService(db, connection).callCandidate('org1', 'user1', 'alex@dc.com', 'cand1');
    expect(dialpadClient.initiateCall).toHaveBeenCalledWith('555', { phoneNumber: '+447911123456', outboundCallerId: '+442071234567', customData: comms[0]!.id });
    expect(result.status).toBe('SENT');
    expect(comms[0]).toMatchObject({ type: 'CALL', direction: 'OUTBOUND', userId: 'user1', candidateId: 'cand1' });
  });

  it('records a failed call and explains it', async () => {
    const { db, comms } = makeDb();
    const { connection } = makeDialpad({ initiateCall: jest.fn().mockRejectedValue(new DialpadError('no device', 404)) });
    await expect(new CommunicationsService(db, connection).callCandidate('org1', 'user1', 'a@dc.com', 'cand1')).rejects.toBeInstanceOf(AppException);
    expect(comms[0]!.status).toBe('FAILED');
    expect(comms[0]!.errorMessage).toContain('Open the Dialpad app');
  });

  it('does not call someone who opted out of calls', async () => {
    const { db } = makeDb([candidate({ callConsent: 'OPTED_OUT' })]);
    const { connection, dialpadClient } = makeDialpad();
    await expect(new CommunicationsService(db, connection).callCandidate('org1', 'u', 'a@dc.com', 'cand1')).rejects.toMatchObject({ code: 'CONTACT_NOT_ALLOWED' });
    expect(dialpadClient.initiateCall).not.toHaveBeenCalled();
  });
});

describe('BulkSmsService — safety before and while sending', () => {
  const people = [candidate({ id: 'a', firstName: 'Ann', phone: '07911 123401' }), candidate({ id: 'b', firstName: 'Ben', phone: '07911 123402', smsConsent: 'OPTED_OUT' }), candidate({ id: 'c', firstName: 'Cat', phone: '07911 123403', smsConsent: 'UNKNOWN' }), candidate({ id: 'd', firstName: 'Dan', phone: 'n/a' }), candidate({ id: 'e', firstName: 'Eve', phone: '07911 123405' })];

  function bulk(extraComms: Row[] = []) {
    const { db, comms } = makeDb(people);
    comms.push(...extraComms);
    const { connection } = makeDialpad();
    const service = new CommunicationsService(db, connection);
    const repo = { selectionWhere: jest.fn(async (_org: string, sel: Row) => ({ id: { in: sel.ids } })) } as never;
    const audit = { record: jest.fn() } as never;
    const lock = { runExclusive: jest.fn() } as never;
    return { service: new BulkSmsService(db, repo, service, connection, audit, lock), comms };
  }

  it('shows the real recipient count and why the others are left out', async () => {
    const { service } = bulk();
    const preview = await service.preview('org1', 'Alex', { mode: 'IDS', ids: people.map((p) => p.id) }, 'Hi {{firstName}}, vacancy in London');
    expect(preview.matching).toBe(5);
    expect(preview.eligible).toBe(2);
    expect(preview.excluded).toEqual({ OPTED_OUT: 1, NO_CONSENT: 1, NO_PHONE: 1 });
    expect(preview.sample).toMatchObject({ name: 'Ann Smith', text: 'Hi Ann, vacancy in London' });
    expect(preview.connected).toBe(true);
  });

  it('leaves out people who already got the exact same message in the last day', async () => {
    const { service } = bulk([{ id: 'old', organisationId: 'org1', type: 'SMS', direction: 'OUTBOUND', status: 'SENT', candidateId: 'a', body: 'Hi Ann, vacancy in London', createdAt: new Date() }]);
    const preview = await service.preview('org1', 'Alex', { mode: 'IDS', ids: people.map((p) => p.id) }, 'Hi {{firstName}}, vacancy in London');
    expect(preview.eligible).toBe(1);
    expect(preview.excluded.DUPLICATE).toBe(1);
  });

  it('queues exactly the eligible people and refuses to send when nobody is eligible', async () => {
    const { service } = bulk();
    jest.spyOn(service, 'drain').mockResolvedValue();
    (service as unknown as { db: { client: Row } }).db.client.communicationBatch = {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'batch1' }),
      findFirst: jest.fn().mockResolvedValue({ id: 'batch1', status: 'RUNNING', matching: 5, eligible: 2, excluded: {}, createdAt: new Date(), finishedAt: null }),
    };
    (service as unknown as { db: { client: Row } }).db.client.communication.groupBy = jest.fn().mockResolvedValue([]);
    (service as unknown as { db: { client: Row } }).db.client.communication.createMany = jest.fn().mockResolvedValue({ count: 2 });

    await service.send('org1', 'user1', 'Alex', { selection: { mode: 'IDS', ids: people.map((p) => p.id) }, template: 'Hi {{firstName}}', idempotencyKey: 'key-12345678' });
    const created = ((service as unknown as { db: { client: Row } }).db.client.communication.createMany as jest.Mock).mock.calls[0]![0].data as Row[];
    expect(created.map((r) => r.candidateId)).toEqual(['a', 'e']);
    expect(created.every((r) => r.status === 'QUEUED' && r.fromNumber === '+442071234567')).toBe(true);

    await expect(service.send('org1', 'user1', 'Alex', { selection: { mode: 'IDS', ids: ['b', 'c'] }, template: 'Hi', idempotencyKey: 'key-87654321' })).rejects.toMatchObject({ code: 'NOBODY_TO_TEXT' });
  });

  it('returns the existing batch for a repeated idempotency key instead of texting twice', async () => {
    const { service } = bulk();
    const client = (service as unknown as { db: { client: Row } }).db.client;
    client.communicationBatch = {
      findUnique: jest.fn().mockResolvedValue({ id: 'batch1' }),
      create: jest.fn(),
      findFirst: jest.fn().mockResolvedValue({ id: 'batch1', status: 'RUNNING', matching: 5, eligible: 2, excluded: {}, createdAt: new Date(), finishedAt: null }),
    };
    client.communication.groupBy = jest.fn().mockResolvedValue([]);
    const result = await service.send('org1', 'user1', 'Alex', { selection: { mode: 'IDS', ids: ['a'] }, template: 'Hi', idempotencyKey: 'same-key-1' });
    expect(result.alreadySubmitted).toBe(true);
    expect(client.communicationBatch.create).not.toHaveBeenCalled();
  });

  it('records each person\'s outcome while sending: one failure does not stop the rest, and a 429 is waited out', async () => {
    const { db, comms } = makeDb(people);
    const sendSms = jest.fn().mockRejectedValueOnce(new DialpadError('invalid destination', 400)).mockResolvedValue({ id: 'ok', message_status: 'pending' });
    const { connection } = makeDialpad({ sendSms });
    const service = new CommunicationsService(db, connection);
    for (const id of ['a', 'e']) comms.push({ id: `c-${id}`, organisationId: 'org1', candidateId: id, batchId: 'batch1', status: 'QUEUED', body: 'x', externalNumber: '+447911123456', createdAt: new Date() });

    const first = await service.deliver('c-a');
    const second = await service.deliver('c-e');
    expect(first.status).toBe('FAILED');
    expect(second.status).toBe('SENT');
  });
});

describe('DialpadWebhookService — what comes back from Dialpad', () => {
  function webhook(rows: Row[] = [], candidateId: string | null = 'cand1') {
    const { db, comms, client } = makeDb();
    comms.push(...rows);
    (client.candidate as Row).updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const connection = { webhookSecretFor: jest.fn().mockResolvedValue({ organisationId: 'org1', secret: 's3cret', config: {} }), touchWebhook: jest.fn() } as never;
    const comm = { findCandidateByNumber: jest.fn().mockResolvedValue(candidateId), findCrmUserByEmail: jest.fn().mockResolvedValue('user1') } as never;
    return { service: new DialpadWebhookService(db, connection, comm), comms, client };
  }

  it('rejects an event that was not signed with our secret', async () => {
    const { service, comms } = webhook();
    const outcome = await service.handle('a'.repeat(48), signDialpadJwt({ id: 1, direction: 'inbound', from_number: '+447911123456' }, 'wrong'));
    expect(outcome).toBe('bad_signature');
    expect(comms).toHaveLength(0);
  });

  it('records an incoming text against the matching candidate', async () => {
    const { service, comms } = webhook();
    await service.handle('a'.repeat(48), signDialpadJwt({ id: 77, direction: 'inbound', from_number: '+447911123456', to_number: ['+442071234567'], text: 'Yes interested' }, 's3cret'));
    expect(comms[0]).toMatchObject({ direction: 'INBOUND', type: 'SMS', status: 'RECEIVED', candidateId: 'cand1', body: 'Yes interested', providerId: '77' });
  });

  it('keeps an incoming text from an unknown number apart, with no candidate', async () => {
    const { service, comms } = webhook([], null);
    await service.handle('a'.repeat(48), signDialpadJwt({ id: 78, direction: 'inbound', from_number: '+447700911111', to_number: ['+442071234567'], text: 'who is this' }, 's3cret'));
    expect(comms[0]!.candidateId).toBeNull();
  });

  it('honours a STOP reply by opting the candidate out of texts', async () => {
    const { service, client } = webhook();
    await service.handle('a'.repeat(48), signDialpadJwt({ id: 79, direction: 'inbound', from_number: '+447911123456', to_number: ['+442071234567'], text: 'STOP' }, 's3cret'));
    expect((client.candidate as Row).updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { organisationId: 'org1', normalizedPhone: '447911123456' }, data: expect.objectContaining({ smsConsent: 'OPTED_OUT' }) }));
  });

  it('updates the delivery status of our own message and never moves it backwards', async () => {
    const { service, comms } = webhook([{ id: 'c1', organisationId: 'org1', providerId: '55', status: 'SENT', candidateId: 'cand1', createdAt: new Date() }]);
    await service.handle('a'.repeat(48), signDialpadJwt({ id: 55, direction: 'outbound', from_number: '+442071234567', to_number: ['+447911123456'], message_status: 'delivered' }, 's3cret'));
    expect(comms[0]!.status).toBe('DELIVERED');
    await service.handle('a'.repeat(48), signDialpadJwt({ id: 55, direction: 'outbound', from_number: '+442071234567', to_number: ['+447911123456'], message_status: 'pending' }, 's3cret'));
    expect(comms[0]!.status).toBe('DELIVERED');
  });

  it('binds a call started from the CRM to its history row and completes it', async () => {
    const { service, comms } = webhook([{ id: 'callrow', organisationId: 'org1', type: 'CALL', providerId: null, status: 'SENT', candidateId: 'cand1', userId: 'user1', createdAt: new Date() }]);
    // Row lookup by custom_data uses findFirst on the fake
    await service.handle('a'.repeat(48), signDialpadJwt({ call_id: 900, state: 'connected', direction: 'outbound', external_number: '+447911123456', internal_number: '+442071234567', custom_data: 'callrow', event_timestamp: 1000 }, 's3cret'));
    await service.handle('a'.repeat(48), signDialpadJwt({ call_id: 900, state: 'hangup', direction: 'outbound', external_number: '+447911123456', date_connected: 1, duration: 42000, custom_data: 'callrow', event_timestamp: 2000 }, 's3cret'));
    expect(comms.find((c) => c.id === 'callrow')).toMatchObject({ providerId: '900', status: 'COMPLETED', durationSeconds: 42 });
  });
});

describe('who may do what', () => {
  const required = (controller: { prototype: object }, method: string) => Reflect.getMetadata(PERMISSIONS_KEY, (controller.prototype as Row)[method]) as string[] | undefined;

  it('whoever can send messages sets up the Dialpad connection; only an administrator removes it', () => {
    for (const m of ['status', 'connect', 'setNumber', 'numbers', 'health']) expect(required(DialpadIntegrationController, m)).toEqual(['communication:send']);
    expect(required(DialpadIntegrationController, 'disconnect')).toEqual(['settings:manage']);
  });

  it('calling and texting need the send permission; bulk texting needs its own', () => {
    expect(required(CommunicationsController, 'call')).toEqual(['communication:send']);
    expect(required(CommunicationsController, 'sms')).toEqual(['communication:send']);
    expect(required(CommunicationsController, 'bulkPreview')).toEqual(['communication:bulk']);
    expect(required(CommunicationsController, 'bulkSend')).toEqual(['communication:bulk']);
    expect(required(CommunicationsController, 'history')).toEqual(['candidate:read']);
  });

  it('anyone who can text may use templates, only authorised users change them', () => {
    expect(required(MessageTemplatesController, 'list')).toEqual(['communication:send']);
    for (const m of ['create', 'update', 'remove']) expect(required(MessageTemplatesController, m)).toEqual(['template:manage']);
  });
});
