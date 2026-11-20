import { DialpadClient, DialpadError } from './dialpad.client';

const json = (status: number, body: unknown, headers: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers });

describe('DialpadClient', () => {
  it('sends a text with the documented body and the Bearer key', async () => {
    const fetchMock = jest.fn().mockResolvedValue(json(200, { id: 99, message_status: 'pending' }));
    const client = new DialpadClient('KEY', 'https://dialpad.test/api/v2', fetchMock as never);

    const sms = await client.sendSms({ to: '+447700900123', text: 'Hello', fromNumber: '+442071234567' });

    expect(sms.id).toBe(99);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit & { headers: Record<string, string> }];
    expect(url).toBe('https://dialpad.test/api/v2/sms');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer KEY');
    expect(JSON.parse(init.body as string)).toEqual({ to_numbers: ['+447700900123'], text: 'Hello', from_number: '+442071234567' });
  });

  it('asks the user\'s Dialpad app to place a call, carrying our id as custom data', async () => {
    const fetchMock = jest.fn().mockResolvedValue(json(200, { device: { id: 'd1' } }));
    await new DialpadClient('K', 'https://x/api/v2', fetchMock as never).initiateCall('555', { phoneNumber: '+447700900123', outboundCallerId: '+442071234567', customData: 'comm1' });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://x/api/v2/users/555/initiate_call');
    expect(JSON.parse(init.body as string)).toEqual({ phone_number: '+447700900123', outbound_caller_id: '+442071234567', custom_data: 'comm1' });
  });

  it('turns a 429 into a rate-limit error that says how long to wait', async () => {
    const client = new DialpadClient('K', 'https://x', jest.fn().mockResolvedValue(json(429, {}, { 'retry-after': '7' })) as never);
    const error = await client.company().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DialpadError);
    expect((error as DialpadError).isRateLimit).toBe(true);
    expect((error as DialpadError).retryAfterMs).toBe(7000);
  });

  it('marks 401/403 as auth problems and network failures as transient', async () => {
    const auth = await new DialpadClient('K', 'https://x', jest.fn().mockResolvedValue(json(401, { error: { message: 'bad key' } })) as never).company().then(() => { throw new Error('expected a failure'); }, (e: unknown) => e as DialpadError);
    expect(auth.isAuth).toBe(true);
    expect(auth.message).toBe('bad key');

    const down = await new DialpadClient('K', 'https://x', jest.fn().mockRejectedValue(new Error('ECONNRESET')) as never).company().then(() => { throw new Error('expected a failure'); }, (e: unknown) => e as DialpadError);
    expect(down.isTransient).toBe(true);
    expect(down.status).toBe(0);
  });

  it('finds the Dialpad user by exact e-mail and pages through numbers', async () => {
    const users = new DialpadClient('K', 'https://x', jest.fn().mockResolvedValue(json(200, { items: [{ id: 1, emails: ['other@x.com'] }, { id: 2, emails: ['Alex@Example.com'] }] })) as never);
    expect((await users.findUserByEmail('alex@example.com'))?.id).toBe(2);

    const fetchMock = jest.fn().mockResolvedValueOnce(json(200, { items: [{ number: '+1' }], cursor: 'c2' })).mockResolvedValueOnce(json(200, { items: [{ number: '+2' }] }));
    const numbers = await new DialpadClient('K', 'https://x', fetchMock as never).numbers();
    expect(numbers.map((n) => n.number)).toEqual(['+1', '+2']);
    expect((fetchMock.mock.calls[1] as [string])[0]).toBe('https://x/numbers?cursor=c2');
  });
});
