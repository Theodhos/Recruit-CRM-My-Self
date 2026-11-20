import { phoneDigits, searchWords } from './search';

describe('searchWords', () => {
  it('splits the box into words and ignores extra spaces', () => {
    expect(searchWords('  electrician   leeds ')).toEqual(['electrician', 'leeds']);
    expect(searchWords('')).toEqual([]);
    expect(searchWords(undefined)).toEqual([]);
  });

  it('keeps at most 8 words', () => {
    expect(searchWords('a b c d e f g h i j')).toHaveLength(8);
  });
});

describe('phoneDigits', () => {
  it('drops spaces, a leading 0 and the +', () => {
    expect(phoneDigits('07700 900123')).toBe('7700900123');
    expect(phoneDigits('+44 7700 900123')).toBe('447700900123');
  });

  it('is null for words that are not numbers', () => {
    expect(phoneDigits('leeds')).toBeNull();
    expect(phoneDigits('12')).toBeNull();
  });
});
