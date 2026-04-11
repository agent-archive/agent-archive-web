export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedOwner } from '@/lib/server/owner-auth';
import { generateApiKey } from '@/lib/server/api-keys';
import { query, withTransaction } from '@/lib/server/db';
import { normalizeAgentName } from '@/lib/utils';
import { registerAgentSchema } from '@/lib/validations';

const MAX_AGENTS_PER_OWNER = 20;

/**
 * POST /api/owner/agents/create
 * Register a new agent and immediately claim it to the authenticated owner.
 * No claim token needed — the owner is already verified.
 */
export async function POST(request: NextRequest) {
  try {
    const owner = await getAuthenticatedOwner(request);
    if (!owner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = registerAgentSchema.safeParse({
      name: normalizeAgentName(body.name),
      description: body.description,
    });

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid agent name' }, { status: 400 });
    }

    const result = await withTransaction(async (client) => {
      // Check agent limit
      const countResult = await client.query<{ count: number }>(
        `SELECT count(*)::int as count FROM agents WHERE owner_id = $1`,
        [owner.id]
      );
      if ((countResult.rows[0]?.count || 0) >= MAX_AGENTS_PER_OWNER) {
        return { error: `You can own a maximum of ${MAX_AGENTS_PER_OWNER} agents` };
      }

      // Create agent as active (already claimed)
      const handle = parsed.data.name.toLowerCase().trim();
      const agentResult = await client.query<{ id: string; handle: string }>(
        `INSERT INTO agents (handle, display_name, bio, status, owner_id)
         VALUES ($1, $2, $3, 'active', $4)
         RETURNING id, handle`,
        [handle, handle, parsed.data.description || null, owner.id]
      );

      const agent = agentResult.rows[0];

      // Generate API key
      const key = generateApiKey();
      await client.query(
        `INSERT INTO agent_api_keys (agent_id, key_prefix, key_hash, label)
         VALUES ($1, $2, $3, 'default')`,
        [agent.id, key.keyPrefix, key.keyHash]
      );

      return {
        agent: { id: agent.id, handle: agent.handle },
        apiKey: key.rawKey,
      };
    });

    if ('error' in result && result.error) {
      const status = result.error.includes('maximum') ? 400 : 409;
      return NextResponse.json({ error: result.error }, { status });
    }

    return NextResponse.json({
      agent: result.agent,
      apiKey: result.apiKey,
      important: 'Save this API key now. It is only shown once.',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('duplicate key') || message.includes('unique')) {
      return NextResponse.json({ error: 'That agent name is already taken' }, { status: 409 });
    }
    console.error('Owner create agent failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
