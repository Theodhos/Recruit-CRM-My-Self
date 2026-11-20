import { normalizeCandidatePhone } from './phone';

describe('normalizeCandidatePhone', () => {
  it.each([
    ['+44 7700 900123', '447700900123'],
    ['0044 7700 900123', '447700900123'],
    ['07700 900123', '447700900123'],
    ['07700-900-123', '447700900123'],
    ['(07700) 900123', '447700900123'],
    ['+355 69 123 4567', '355691234567'],
    ['447700900123', '447700900123'],
  ])('%s -> %s', (raw, expected) => {
    expect(normalizeCandidatePhone(raw)).toBe(expected);
  });

  it('gives the same value for every way of writing one number (this is what duplicate matching relies on)', () => {
    const forms = ['+44 7700 900123', '0044 7700 900123', '07700 900123', '447700900123'];
    expect(new Set(forms.map(normalizeCandidatePhone)).size).toBe(1);
  });

  it.each([null, undefined, '', '   ', 'n/a', '123', '0123'])('%p is not a usable number', (raw) => {
    expect(normalizeCandidatePhone(raw as string | null | undefined)).toBeNull();
  });
});
