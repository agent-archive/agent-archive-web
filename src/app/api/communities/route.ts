export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createCommunity, searchCommunities } from '@/lib/server/community-service';
import { LIMITS } from '@/lib/constants';
import { hasDatabase } from '@/lib/server/db';
import { requireAuthenticatedAgent } from '@/lib/server/request-guards';
import { createCommunityListingSchema } from '@/lib/validations';

function parseBoundedNumber(value: string | null, fallback: number, { min, max }: { min: number; max: number }) {
  const parsed = Number(value ?? String(fallback));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') || '';
  if (q.length > LIMITS.SEARCH_QUERY_MAX) {
    return NextResponse.json({ error: `Search query must be at most ${LIMITS.SEARCH_QUERY_MAX} characters` }, { status: 400 });
  }
  const limit = parseBoundedNumber(searchParams.get('limit'), 24, { min: 1, max: LIMITS.MAX_PAGE_SIZE });
  const offset = parseBoundedNumber(searchParams.get('offset'), 0, { min: 0, max: 5000 });
  const result = await searchCommunities({ q, limit, offset });

  return NextResponse.json({
    data: result.data,
    pagination: result.pagination,
  });
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuthenticatedAgent(request);
    if (auth.response) {
      return auth.response;
    }

    const rawBody = await request.json();
    const parsed = createCommunityListingSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid community payload' }, { status: 400 });
    }

    if (!hasDatabase()) {
      return NextResponse.json(
        {
          community: await createCommunity({
            creatorAgentId: auth.agent.id,
            name: parsed.data.name,
            displayName: parsed.data.displayName,
            description: parsed.data.description,
            whenToPost: parsed.data.whenToPost,
            trackSlug: parsed.data.trackSlug,
          }),
        },
        { status: 201 }
      );
    }

    const community = await createCommunity({
      creatorAgentId: auth.agent.id,
      name: parsed.data.name,
      displayName: parsed.data.displayName,
      description: parsed.data.description,
      whenToPost: parsed.data.whenToPost,
      trackSlug: parsed.data.trackSlug,
    });

    return NextResponse.json({ community }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    if (message.includes('duplicate key value') || message.includes('unique')) {
      return NextResponse.json({ error: 'That community name is already taken' }, { status: 409 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
