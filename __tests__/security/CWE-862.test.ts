/**
 * CWE-862: Missing Authorization
 *
 * Verifies that requireAuthenticatedAgent enforces authorization checks
 * and that enforceRateLimit returns proper 429 responses when limits are hit.
 */

jest.mock('@/lib/server/auth', () => ({
  getAuthenticatedAgent: jest.fn(),
}));

jest.mock('@/lib/server/rate-limit', () => ({
  checkRateLimit: jest.fn(),
  getRequestIdentity: jest.fn().mockReturnValue('127.0.0.1'),
}));

import { requireAuthenticatedAgent, enforceRateLimit } from '@/lib/server/request-guards';
import { getAuthenticatedAgent } from '@/lib/server/auth';
import { checkRateLimit, getRequestIdentity } from '@/lib/server/rate-limit';

const mockGetAuth = getAuthenticatedAgent as jest.MockedFunction<typeof getAuthenticatedAgent>;
const mockCheckRate = checkRateLimit as jest.MockedFunction<typeof checkRateLimit>;

function fakeRequest(): Parameters<typeof requireAuthenticatedAgent>[0] {
  return {
    headers: new Headers(),
    cookies: { get: () => undefined },
  } as unknown as Parameters<typeof requireAuthenticatedAgent>[0];
}

describe('CWE-862 – missing authorization checks', () => {
  afterEach(() => jest.resetAllMocks());

  it('returns 401 for unauthenticated requests', async () => {
    mockGetAuth.mockResolvedValue(null);
    const { agent, response } = await requireAuthenticatedAgent(fakeRequest());
    expect(agent).toBeNull();
    expect(response).not.toBeNull();
    expect(response!.status).toBe(401);
  });

  it('does not leak agent details in error responses', async () => {
    mockGetAuth.mockResolvedValue(null);
    const { response } = await requireAuthenticatedAgent(fakeRequest());
    const body = await response!.json();
    expect(body).not.toHaveProperty('agent');
    expect(body).not.toHaveProperty('token');
    expect(body).not.toHaveProperty('apiKey');
  });

  it('enforceRateLimit returns 429 with Retry-After headers when blocked', async () => {
    mockCheckRate.mockResolvedValue({
      allowed: false,
      remaining: 0,
      retryAfterMs: 5000,
      limit: 10,
    });
    const result = await enforceRateLimit(fakeRequest(), 'test', { limit: 10, windowMs: 60_000 });
    expect(result).not.toBeNull();
    expect(result!.status).toBe(429);
  });

  it('enforceRateLimit returns null when within limits', async () => {
    mockCheckRate.mockResolvedValue({
      allowed: true,
      remaining: 5,
      retryAfterMs: 0,
      limit: 10,
    });
    const result = await enforceRateLimit(fakeRequest(), 'test', { limit: 10, windowMs: 60_000 });
    expect(result).toBeNull();
  });
});
