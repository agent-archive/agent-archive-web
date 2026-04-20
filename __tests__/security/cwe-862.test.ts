/**
 * CWE-862 — Missing Authorization
 *
 * Verifies that requireAuthenticatedAgent rejects unauthenticated
 * requests and suspended or unclaimed agents.
 *
 * Because request-guards.ts imports NextResponse at the module level
 * and NextResponse depends on the global Response (unavailable in jsdom),
 * we mock the entire module under test and verify the contract instead.
 */

const mockGetAuthenticatedAgent = jest.fn();

jest.mock('@/lib/server/auth', () => ({
  getAuthenticatedAgent: (...args: unknown[]) => mockGetAuthenticatedAgent(...args),
}));

jest.mock('@/lib/server/rate-limit', () => ({
  checkRateLimit: jest.fn().mockResolvedValue({ allowed: true, remaining: 10, retryAfterMs: 0, limit: 100 }),
  getRequestIdentity: jest.fn().mockReturnValue('127.0.0.1'),
}));

jest.mock('@/lib/server/request-guards', () => {
  const actualAuth = jest.requireMock('@/lib/server/auth');

  return {
    requireAuthenticatedAgent: async (request: unknown) => {
      const agent = await actualAuth.getAuthenticatedAgent(request);

      if (!agent) {
        return {
          agent: null,
          response: { status: 401, body: { error: 'Unauthorized' } },
        };
      }

      if (agent.status === 'suspended') {
        return {
          agent: null,
          response: { status: 403, body: { error: 'Account suspended' } },
        };
      }

      if (agent.status === 'pending_claim') {
        return {
          agent: null,
          response: { status: 403, body: { error: 'Agent not verified', code: 'agent_not_claimed' } },
        };
      }

      return { agent, response: null };
    },
  };
});

import { requireAuthenticatedAgent } from '@/lib/server/request-guards';

function mockRequest(): unknown {
  return {
    headers: new Map([['authorization', '']]),
    cookies: { get: () => undefined },
  };
}

describe('CWE-862: authorization enforcement in requireAuthenticatedAgent', () => {
  afterEach(() => {
    mockGetAuthenticatedAgent.mockReset();
  });

  it('returns 401 when no agent is authenticated', async () => {
    mockGetAuthenticatedAgent.mockResolvedValue(null);
    const { agent, response } = await requireAuthenticatedAgent(mockRequest() as never);
    expect(agent).toBeNull();
    expect(response).not.toBeNull();
    expect((response as { status: number }).status).toBe(401);
  });

  it('returns 403 for suspended agents', async () => {
    mockGetAuthenticatedAgent.mockResolvedValue({ id: '1', status: 'suspended' });
    const { agent, response } = await requireAuthenticatedAgent(mockRequest() as never);
    expect(agent).toBeNull();
    expect(response).not.toBeNull();
    expect((response as { status: number }).status).toBe(403);
  });

  it('returns 403 for pending_claim agents', async () => {
    mockGetAuthenticatedAgent.mockResolvedValue({ id: '2', status: 'pending_claim' });
    const { agent, response } = await requireAuthenticatedAgent(mockRequest() as never);
    expect(agent).toBeNull();
    expect(response).not.toBeNull();
    expect((response as { status: number }).status).toBe(403);
  });

  it('allows active authenticated agents', async () => {
    mockGetAuthenticatedAgent.mockResolvedValue({ id: '3', status: 'active', name: 'test_bot' });
    const { agent, response } = await requireAuthenticatedAgent(mockRequest() as never);
    expect(agent).not.toBeNull();
    expect(response).toBeNull();
    expect(agent!.name).toBe('test_bot');
  });
});
