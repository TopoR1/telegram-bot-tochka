import { describe, expect, it } from 'vitest';
import { __private__ } from './xlsxParser.js';

describe('normalizeMoney', () => {
    const { normalizeMoney } = __private__;
    it('parses integer amounts with spaces', () => {
        expect(normalizeMoney('11 990')).toBe(11990);
    });
    it('parses thousands separated by dot', () => {
        expect(normalizeMoney('11.990')).toBe(11990);
    });
    it('parses thousands separated by comma', () => {
        expect(normalizeMoney('11,990')).toBe(11990);
    });
    it('parses decimal amounts with comma', () => {
        expect(normalizeMoney('18,62')).toBe(18.62);
    });
    it('parses amounts with both thousand and decimal separators', () => {
        expect(normalizeMoney('11 990,50')).toBe(11990.5);
        expect(normalizeMoney('11.990,50')).toBe(11990.5);
    });
    it('returns undefined for invalid values', () => {
        expect(normalizeMoney(null)).toBeUndefined();
        expect(normalizeMoney('abc')).toBeUndefined();
    });
});

describe('normalizeLink', () => {
    const { normalizeLink } = __private__;
    it('normalizes telegram usernames', () => {
        expect(normalizeLink('@example')).toBe('https://t.me/example');
    });
    it('keeps absolute links', () => {
        expect(normalizeLink('https://example.com/task/1')).toBe('https://example.com/task/1');
    });
    it('normalizes protocol-relative links', () => {
        expect(normalizeLink('//example.com/task')).toBe('https://example.com/task');
    });
    it('adds protocol to bare domains', () => {
        expect(normalizeLink('example.com/path')).toBe('https://example.com/path');
    });
    it('returns undefined for invalid links', () => {
        expect(normalizeLink('not a link')).toBeUndefined();
    });
});
