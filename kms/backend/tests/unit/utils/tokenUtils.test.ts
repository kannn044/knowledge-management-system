/**
 * Unit tests for tokenUtils — JWT generation, verification, and secure token helpers.
 * These are pure unit tests with no I/O or DB dependency.
 */
import {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  generateSecureToken,
  hashToken,
  getRefreshTokenExpiry,
  getEmailVerificationExpiry,
} from '../../../src/utils/tokenUtils';

const mockUser = {
  id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  email: 'test@example.com',
  role: 'viewer' as const,
};

describe('generateAccessToken', () => {
  it('generates a non-empty JWT string', () => {
    const token = generateAccessToken(mockUser);
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
  });

  it('can be verified back to the original payload', () => {
    const token = generateAccessToken(mockUser);
    const payload = verifyAccessToken(token);
    expect(payload.sub).toBe(mockUser.id);
    expect(payload.email).toBe(mockUser.email);
    expect(payload.role).toBe(mockUser.role);
  });

  it('includes correct issuer and audience claims', () => {
    const token = generateAccessToken(mockUser);
    const payload = verifyAccessToken(token);
    expect((payload as any).iss).toBe('kms-api');
    expect((payload as any).aud).toBe('kms-client');
  });
});

describe('generateRefreshToken', () => {
  it('generates a non-empty JWT string', () => {
    const token = generateRefreshToken(mockUser);
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3);
  });

  it('can be verified back to the original payload', () => {
    const token = generateRefreshToken(mockUser);
    const payload = verifyRefreshToken(token);
    expect(payload.sub).toBe(mockUser.id);
    expect(payload.role).toBe(mockUser.role);
  });

  it('uses a different secret than access tokens', () => {
    const accessToken = generateAccessToken(mockUser);
    // An access token should fail refresh-token verification (different secret + audience)
    expect(() => verifyRefreshToken(accessToken)).toThrow();
  });
});

describe('verifyAccessToken', () => {
  it('throws on a tampered token', () => {
    const token = generateAccessToken(mockUser);
    const tampered = token.slice(0, -3) + 'abc';
    expect(() => verifyAccessToken(tampered)).toThrow();
  });

  it('throws on a completely invalid string', () => {
    expect(() => verifyAccessToken('not.a.jwt')).toThrow();
  });

  it('rejects a refresh token as an access token', () => {
    const refreshToken = generateRefreshToken(mockUser);
    // Different audience — should fail
    expect(() => verifyAccessToken(refreshToken)).toThrow();
  });
});

describe('generateSecureToken', () => {
  it('generates a hex string of the expected length', () => {
    const token = generateSecureToken(32);
    expect(typeof token).toBe('string');
    expect(token).toHaveLength(64); // 32 bytes → 64 hex chars
  });

  it('generates unique tokens each call', () => {
    const t1 = generateSecureToken();
    const t2 = generateSecureToken();
    expect(t1).not.toBe(t2);
  });
});

describe('hashToken', () => {
  it('returns a 64-char hex string (SHA-256)', () => {
    const hash = hashToken('some-token');
    expect(hash).toHaveLength(64);
    expect(/^[a-f0-9]+$/.test(hash)).toBe(true);
  });

  it('is deterministic for the same input', () => {
    expect(hashToken('abc')).toBe(hashToken('abc'));
  });

  it('produces different hashes for different inputs', () => {
    expect(hashToken('abc')).not.toBe(hashToken('xyz'));
  });
});

describe('getRefreshTokenExpiry', () => {
  it('returns a future date', () => {
    const expiry = getRefreshTokenExpiry();
    expect(expiry.getTime()).toBeGreaterThan(Date.now());
  });

  it('returns a date approximately 7 days in the future', () => {
    const expiry = getRefreshTokenExpiry();
    const diffMs = expiry.getTime() - Date.now();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeGreaterThan(6.9);
    expect(diffDays).toBeLessThan(7.1);
  });
});

describe('getEmailVerificationExpiry', () => {
  it('returns a date ~24 hours in the future', () => {
    const expiry = getEmailVerificationExpiry();
    const diffMs = expiry.getTime() - Date.now();
    const diffHours = diffMs / (1000 * 60 * 60);
    expect(diffHours).toBeGreaterThan(23.9);
    expect(diffHours).toBeLessThan(24.1);
  });
});
