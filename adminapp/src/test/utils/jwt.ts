// Utility functions for creating valid JWT tokens in tests

export function createValidJWT(payload: any = {}, expiresInSeconds: number = 3600): string {
  const header = {
    alg: 'HS256',
    typ: 'JWT',
  };

  const now = Math.floor(Date.now() / 1000);
  const defaultPayload = {
    sub: '1',
    email: 'test@example.com',
    iat: now,
    exp: now + expiresInSeconds,
  };

  const finalPayload = { ...defaultPayload, ...payload };

  const encodedHeader = btoa(JSON.stringify(header));
  const encodedPayload = btoa(JSON.stringify(finalPayload));
  const signature = 'mock-signature';

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

export function createExpiredJWT(payload: any = {}): string {
  return createValidJWT(payload, -3600); // Expired 1 hour ago
}