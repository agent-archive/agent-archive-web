/**
 * CWE-285: Next.js middleware authorization bypass (CVE-2025-29927)
 *
 * Verifies that requireAuthenticatedAgent correctly rejects unauthenticated,
 * suspended, and unclaimed agents — the properties that a middleware bypass
 * would circumvent.
 */

import { requireAuthenticatedAgent } from '@/lib/server/request-guards';
import { getAuthenticatedAgent } from '@/lib/server/auth';

jest.mock('@/lib/server/auth', () => ({
  getAuthenticatedAgent: jest.fn(),
}));

jest.mock('@/lib/server/rate-limit', () => ({
  checkRateLimit: jest.fn(),
  getRequestIdentity: jest.fn().mockReturnValue('127.0.0.1'),
}));

const mockGetAuth = getAuthenticatedAgent as jest.MockedFunction<typeof getAuthenticatedAgent>;

function fakeRequest(): Parameters<typeof requireAuthenticatedAgent>[0] {
  return {
    headers: new Headers(),
    cookies: { get: () => undefined },
  } as unknown as Parameters<typeof requireAuthenticatedAgent>[0];
}

describe('CWE-285 – middleware authorization bypass', () => {
  afterEach(() => jest.resetAllMocks());

  it('rejects requests when no agent is authenticated', async () => {
    mockGetAuth.mockResolvedValue(null);
    const { agent, response } = await requireAuthenticatedAgent(fakeRequest());
    expect(agent).toBeNull();
    expect(response).not.toBeNull();
    expect(response!.status).toBe(401);
  });

  it('rejects suspended agents with 403', async () => {
    mockGetAuth.mockResolvedValue({ id: 'a1', status: 'suspended' } as any);
    const { agent, response } = await requireAuthenticatedAgent(fakeRequest());
    expect(agent).toBeNull();
    expect(response!.status).toBe(403);
  });

  it('rejects unclaimed agents with 403', async () => {
    mockGetAuth.mockResolvedValue({ id: 'a2', status: 'pending_claim' } as any);
    const { agent, response } = await requireAuthenticatedAgent(fakeRequest());
    expect(agent).toBeNull();
    expect(response!.status).toBe(403);
  });

  it('allows active agents through', async () => {
    const activeAgent = { id: 'a3', status: 'active', name: 'test_agent' };
    mockGetAuth.mockResolvedValue(activeAgent as any);
    const { agent, response } = await requireAuthenticatedAgent(fakeRequest());
    expect(response).toBeNull();
    expect(agent).toEqual(activeAgent);
  });
});
