import { describe, expect, it } from 'vitest';
import { normalizePhone, maskPhone, comparePhones, scorePhoneMatch } from '../../src/utils/phone.js';

describe('normalizePhone', () => {
  it('normalizes russian numbers of different formats', () => {
    expect(normalizePhone('+7 (999) 123-45-67')).toBe('89991234567');
    expect(normalizePhone('8 999 123 45 67')).toBe('89991234567');
    expect(normalizePhone('9991234567')).toBe('89991234567');
  });

  it('returns null for invalid inputs', () => {
    expect(normalizePhone('12345')).toBeNull();
    expect(normalizePhone('abc')).toBeNull();
    expect(normalizePhone('')).toBeNull();
    expect(normalizePhone(null)).toBeNull();
  });
});

describe('maskPhone', () => {
  it('masks middle digits for normalized numbers', () => {
    expect(maskPhone('+7 (999) 123-45-67')).toBe('89***234567');
  });

  it('masks partial numbers gracefully', () => {
    expect(maskPhone('123456')).toBe('123***56');
  });
});

describe('comparePhones', () => {
  it('detects equality regardless of formatting', () => {
    expect(comparePhones('+7 999 123 45 67', '8 (999) 123-45-67')).toBe(true);
    expect(comparePhones('89991234567', '8 999 000 00 00')).toBe(false);
  });
});

describe('scorePhoneMatch', () => {
  it('calculates similarity score between two phones', () => {
    expect(scorePhoneMatch('89991234567', '89991234567')).toBe(1);
    expect(scorePhoneMatch('89991234567', '89991234000')).toBeCloseTo(8 / 11);
    expect(scorePhoneMatch('89991234567', '123')).toBe(0);
  });
});
