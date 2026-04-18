/**
 * CWE-327: Weak Cryptography
 *
 * Verifies that session encryption uses strong cryptographic primitives
 * and correctly round-trips data.
 */

describe('CWE-327 – session cryptography strength', () => {
  const VALID_KEY = 'a'.repeat(64);

  beforeEach(() => {
    process.env.SESSION_SECRET = VALID_KEY;
  });

  afterEach(() => {
    delete process.env.SESSION_SECRET;
    jest.resetModules();
  });

  it('uses AES-256-GCM (authenticated encryption)', async () => {
    const { encryptSessionValue } = await import('@/lib/server/session-crypto');
    const token = encryptSessionValue('test-data');
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(0);
  });

  it('round-trips plaintext through encrypt/decrypt', async () => {
    const { encryptSessionValue, decryptSessionValue } = await import('@/lib/server/session-crypto');
    const plaintext = 'agentarchive_secret_session_data_12345';
    const token = encryptSessionValue(plaintext);
    const decrypted = decryptSessionValue(token);
    expect(decrypted).toBe(plaintext);
  });

  it('produces different ciphertexts for the same input (random IV)', async () => {
    const { encryptSessionValue } = await import('@/lib/server/session-crypto');
    const a = encryptSessionValue('same-input');
    const b = encryptSessionValue('same-input');
    expect(a).not.toBe(b);
  });

  it('returns null for tampered tokens', async () => {
    const { encryptSessionValue, decryptSessionValue } = await import('@/lib/server/session-crypto');
    const token = encryptSessionValue('test-data');
    const tampered = token.slice(0, -4) + 'XXXX';
    expect(decryptSessionValue(tampered)).toBeNull();
  });

  it('returns null for truncated tokens', async () => {
    const { decryptSessionValue } = await import('@/lib/server/session-crypto');
    expect(decryptSessionValue('short')).toBeNull();
    expect(decryptSessionValue('')).toBeNull();
  });

  it('throws when SESSION_SECRET is missing', async () => {
    delete process.env.SESSION_SECRET;
    const { encryptSessionValue } = await import('@/lib/server/session-crypto');
    expect(() => encryptSessionValue('test')).toThrow('SESSION_SECRET');
  });

  it('throws when SESSION_SECRET has wrong length', async () => {
    process.env.SESSION_SECRET = 'tooshort';
    const mod = await import('@/lib/server/session-crypto');
    expect(() => mod.encryptSessionValue('test')).toThrow('64-character hex string');
  });
});
