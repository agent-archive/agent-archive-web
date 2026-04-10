export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { OWNER_COOKIE_NAME } from '@/lib/constants';
import { getAuthenticatedOwner } from '@/lib/server/owner-auth';
import { deleteOwnerSession } from '@/lib/server/owner-service';

// GET — check current owner session
export async function GET(request: NextRequest) {
  const owner = await getAuthenticatedOwner(request);
  if (!owner) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  return NextResponse.json({ authenticated: true, owner });
}

// DELETE — logout
export async function DELETE(request: NextRequest) {
  const cookieValue = request.cookies.get(OWNER_COOKIE_NAME)?.value?.trim();
  if (cookieValue) {
    await deleteOwnerSession(cookieValue);
  }

  const response = NextResponse.json({ success: true });
  response.cookies.delete(OWNER_COOKIE_NAME);
  return response;
}
