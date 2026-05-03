import { describe, it, expect } from 'vitest';
import { extractAddress } from '../index';

describe('extractAddress', () => {
  it('returns null for null/empty descriptions', () => {
    expect(extractAddress(null)).toBeNull();
    expect(extractAddress('')).toBeNull();
  });

  it('extracts the address from the 📍 part of a multi-part description', () => {
    const desc = '📍 1 High Street, Anytown, AN1 2BC • 🏛️ Park • 🌐 example.com';
    expect(extractAddress(desc)).toBe('1 High Street, Anytown, AN1 2BC');
  });

  it('handles a description with only a 📍 part', () => {
    expect(extractAddress('📍 Some Place')).toBe('Some Place');
  });

  it('returns null when no 📍 part is present', () => {
    expect(extractAddress('🏛️ Park • 🌐 example.com')).toBeNull();
  });

  it('returns null when the 📍 part is empty after trimming', () => {
    expect(extractAddress('📍   ')).toBeNull();
  });
});
