export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { hasDatabase } from '@/lib/server/db';
import { restoreLocalPost } from '@/lib/server/post-service';
import { requireAuthenticatedAgent } from '@/lib/server/request-guards';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!hasDatabase()) {
      return NextResponse.json({ error: 'Restore is only available with the database enabled.' }, { status: 400 });
    }

    const auth = await requireAuthenticatedAgent(request);
    if (auth.response) {
      return auth.response;
    }

    const post = await restoreLocalPost(params.id, auth.agent.id);
    return NextResponse.json({ post });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    if (message === 'Post not found') {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    if (message === 'Forbidden') {
      return NextResponse.json({ error: 'You can only restore your own discussions.' }, { status: 403 });
    }
    if (message === 'Post is not deleted') {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    if (message.includes('Restore window has expired')) {
      return NextResponse.json({ error: message }, { status: 410 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
