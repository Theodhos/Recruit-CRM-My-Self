import { signDialpadJwt, verifyDialpadJwt } from './dialpad-jwt';
import { inspectTemplate, isOptOutText, renderTemplate } from './placeholders';
import { decryptSecret, encryptSecret } from './secret-box';

describe('secret-box (stored credentials)', () => {
  it('round-trips and never stores the plain text', () => {
    const boxed = encryptSecret('dp_live_key_123', 'session-secret-value-1234');
    expect(boxed).not.toContain('dp_live_key_123');
    expect(decryptSecret(boxed, 'session-secret-value-1234')).toBe('dp_live_key_123');
  });

  it('uses a fresh nonce each time', () => {
    expect(encryptSecret('same', 'k'.repeat(20))).not.toBe(encryptSecret('same', 'k'.repeat(20)));
  });

  it('refuses a wrong key and a tampered value', () => {
    const boxed = encryptSecret('secret', 'right-key-right-key-1');
    expect(() => decryptSecret(boxed, 'wrong-key-wrong-key-1')).toThrow();
    const parts = boxed.split('.');
    parts[3] = Buffer.from('tampered').toString('base64url');
    expect(() => decryptSecret(parts.join('.'), 'right-key-right-key-1')).toThrow();
  });
});

describe('Dialpad webhook signature', () => {
  it('accepts a token signed with our secret', () => {
    const token = signDialpadJwt({ id: 1, text: 'hi' }, 's3cret');
    expect(verifyDialpadJwt(token, 's3cret')).toEqual({ id: 1, text: 'hi' });
  });

  it('rejects another secret, a changed payload, a non-HS256 header and junk', () => {
    const token = signDialpadJwt({ id: 1 }, 's3cret');
    expect(verifyDialpadJwt(token, 'other')).toBeNull();
    const [h, , s] = token.split('.') as [string, string, string];
    expect(verifyDialpadJwt(`${h}.${Buffer.from('{"id":2}').toString('base64url')}.${s}`, 's3cret')).toBeNull();
    const none = `${Buffer.from('{"alg":"none"}').toString('base64url')}.${Buffer.from('{}').toString('base64url')}.`;
    expect(verifyDialpadJwt(none, 's3cret')).toBeNull();
    expect(verifyDialpadJwt('not a token', 's3cret')).toBeNull();
    expect(verifyDialpadJwt('', 's3cret')).toBeNull();
  });
});

describe('message placeholders', () => {
  it('lists the placeholders used and the unknown ones', () => {
    expect(inspectTemplate('Hi {{firstName}}, {{ jobTitle }} {{nope}}')).toEqual({ used: ['firstName', 'jobTitle'], unknown: ['nope'] });
  });

  it('fills every placeholder', () => {
    expect(renderTemplate('Hi {{firstName}}, new {{jobTitle}} job in London. {{recruiterName}}', { firstName: 'Jamie', jobTitle: 'Electrician', recruiterName: 'Alex' })).toEqual({
      text: 'Hi Jamie, new Electrician job in London. Alex',
    });
  });

  it('refuses to render when a value is missing, instead of sending "a  job"', () => {
    expect(renderTemplate('Hi {{firstName}}, a {{jobTitle}} job', { firstName: 'Jamie', jobTitle: '  ' })).toEqual({ missing: ['jobTitle'] });
  });

  it('recognises opt-out replies', () => {
    for (const text of ['STOP', ' stop ', 'Unsubscribe', 'stop.', 'QUIT']) expect(isOptOutText(text)).toBe(true);
    for (const text of ['please stop calling at night', 'yes', '', null]) expect(isOptOutText(text as string | null)).toBe(false);
  });
});
