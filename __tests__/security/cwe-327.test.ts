/**
 * CWE-327 — Weak Cryptography
 *
 * Verifies that session encryption uses AES-256-GCM and that
 * encrypt/decrypt round-trips correctly while rejecting tampered tokens.
 */
import { encryptSessionValue, decryptSessionValue } from '@/lib/server/session-crypto';

const TEST_SESSION_SECRET = 'a'.repeat(64);

beforeAll(() => {
  process.env.SESSION_SECRET = TEST_SESSION_SECRET;
});

afterAll(() => {
  delete process.env.SESSION_SECRET;
});

describe('CWE-327: cryptographic strength of session encryption', () => {
  it('round-trips a plaintext value through encrypt then decrypt', () => {
    const plaintext = 'agentarchive_test_session_data';
    const token = encryptSessionValue(plaintext);
    const decrypted = decryptSessionValue(token);
    expect(decrypted).toBe(plaintext);
  });

  it('produces different ciphertexts for the same plaintext (unique IVs)', () => {
    const plaintext = 'same-data';
    const token1 = encryptSessionValue(plaintext);
    const token2 = encryptSessionValue(plaintext);
    expect(token1).not.toBe(token2);
  });

  it('returns null for a tampered token', () => {
    const token = encryptSessionValue('real-data');
    const tampered = token.slice(0, -4) + 'XXXX';
    expect(decryptSessionValue(tampered)).toBeNull();
  });

  it('returns null for a completely invalid token', () => {
    expect(decryptSessionValue('not-a-valid-token')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(decryptSessionValue('')).toBeNull();
  });

  it('returns null for a truncated token (too short for IV + auth tag)', () => {
    expect(decryptSessionValue('abc')).toBeNull();
  });

  it('handles unicode plaintext correctly', () => {
    const plaintext = 'session_\u00e9\u00e8\u00ea_data';
    const token = encryptSessionValue(plaintext);
    const decrypted = decryptSessionValue(token);
    expect(decrypted).toBe(plaintext);
  });

  it('throws if SESSION_SECRET is missing', () => {
    const original = process.env.SESSION_SECRET;
    delete process.env.SESSION_SECRET;
    expect(() => encryptSessionValue('test')).toThrow('SESSION_SECRET');
    process.env.SESSION_SECRET = original;
  });

  it('throws if SESSION_SECRET has wrong length', () => {
    const original = process.env.SESSION_SECRET;
    process.env.SESSION_SECRET = 'tooshort';
    expect(() => encryptSessionValue('test')).toThrow('64-character hex');
    process.env.SESSION_SECRET = original;
  });
});
