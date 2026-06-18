import { encrypt, decrypt } from './crypto.utils';

const TEST_KEY = 'a'.repeat(64); // 32 bytes as 64 hex chars

describe('crypto utils', () => {
  it('encrypts and decrypts a string round-trip', () => {
    const original = 'PAYPAL_TXN_ABC123456';
    const encrypted = encrypt(original, TEST_KEY);
    expect(encrypted).not.toBe(original);
    expect(decrypt(encrypted, TEST_KEY)).toBe(original);
  });

  it('produces different ciphertexts for the same input (random IV)', () => {
    const original = 'same-plaintext';
    const e1 = encrypt(original, TEST_KEY);
    const e2 = encrypt(original, TEST_KEY);
    expect(e1).not.toBe(e2);
  });

  it('returns null when decrypting a corrupted value', () => {
    expect(decrypt('bad:data:here', TEST_KEY)).toBeNull();
  });

  it('returns null for empty input to decrypt', () => {
    expect(decrypt('', TEST_KEY)).toBeNull();
  });

  it('throws when key is not 64 hex chars', () => {
    expect(() => encrypt('text', 'tooshort')).toThrow('ENCRYPTION_KEY must be exactly 64 hex characters');
  });
});
