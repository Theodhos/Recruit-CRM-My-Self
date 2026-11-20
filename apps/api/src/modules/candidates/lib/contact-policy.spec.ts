import { checkContactPolicy, toE164, type PolicyCandidate } from './contact-policy';

const person = (extra: Partial<PolicyCandidate> = {}): PolicyCandidate => ({
  status: 'ACTIVE',
  phone: '07911 123456',
  email: 'ana@example.com',
  smsConsent: 'GRANTED',
  emailConsent: 'GRANTED',
  callConsent: 'UNKNOWN',
  ...extra,
});

describe('toE164', () => {
  it.each([
    ['07911 123456', '+447911123456'],
    ['+44 7911 123456', '+447911123456'],
    ['0044 7911 123456', '+447911123456'],
    ['+355 69 123 4567', '+355691234567'],
  ])('%s -> %s', (raw, expected) => expect(toE164(raw)).toBe(expected));

  it.each([null, undefined, '', '123', 'not a number', '07700'])('%p is not a usable mobile number', (raw) => expect(toE164(raw as string)).toBeNull());
});

describe('checkContactPolicy', () => {
  it('SMS: needs recorded consent, a valid number, and no opt-out', () => {
    expect(checkContactPolicy(person(), 'SMS')).toBeNull();
    expect(checkContactPolicy(person({ smsConsent: 'UNKNOWN' }), 'SMS')).toBe('NO_CONSENT');
    expect(checkContactPolicy(person({ smsConsent: 'OPTED_OUT' }), 'SMS')).toBe('OPTED_OUT');
    expect(checkContactPolicy(person({ phone: null }), 'SMS')).toBe('NO_PHONE');
    expect(checkContactPolicy(person({ phone: '12345' }), 'SMS')).toBe('NO_PHONE');
  });

  it('e-mail: needs recorded consent and an address', () => {
    expect(checkContactPolicy(person(), 'EMAIL')).toBeNull();
    expect(checkContactPolicy(person({ emailConsent: 'UNKNOWN' }), 'EMAIL')).toBe('NO_CONSENT');
    expect(checkContactPolicy(person({ emailConsent: 'OPTED_OUT' }), 'EMAIL')).toBe('OPTED_OUT');
    expect(checkContactPolicy(person({ email: '  ' }), 'EMAIL')).toBe('NO_EMAIL');
  });

  it('call: only an opt-out stops it (nothing recorded is fine), and a number is needed', () => {
    expect(checkContactPolicy(person({ callConsent: 'UNKNOWN' }), 'CALL')).toBeNull();
    expect(checkContactPolicy(person({ callConsent: 'GRANTED' }), 'CALL')).toBeNull();
    expect(checkContactPolicy(person({ callConsent: 'OPTED_OUT' }), 'CALL')).toBe('OPTED_OUT');
    expect(checkContactPolicy(person({ phone: null }), 'CALL')).toBe('NO_PHONE');
  });

  it('an opt-out in ONE channel does not block another channel', () => {
    const smsOnlyOptOut = person({ smsConsent: 'OPTED_OUT' });
    expect(checkContactPolicy(smsOnlyOptOut, 'SMS')).toBe('OPTED_OUT');
    expect(checkContactPolicy(smsOnlyOptOut, 'EMAIL')).toBeNull();
    expect(checkContactPolicy(smsOnlyOptOut, 'CALL')).toBeNull();
  });

  it('"do not contact" blocks every purpose, whatever consent says', () => {
    const blocked = person({ status: 'DO_NOT_CONTACT', smsConsent: 'GRANTED', emailConsent: 'GRANTED', callConsent: 'GRANTED' });
    for (const purpose of ['SMS', 'EMAIL', 'CALL'] as const) expect(checkContactPolicy(blocked, purpose)).toBe('DO_NOT_CONTACT');
  });

  it('an opt-out is reported as such, ahead of a missing number', () => {
    expect(checkContactPolicy(person({ smsConsent: 'OPTED_OUT', phone: null }), 'SMS')).toBe('OPTED_OUT');
  });
});
