import type { NextRequest } from 'next/server';
import { OWNER_COOKIE_NAME } from '@/lib/constants';
import { authenticateOwnerSession, type Owner } from '@/lib/server/owner-service';
import { hasDatabase } from '@/lib/server/db';

export async function getAuthenticatedOwner(request: NextRequest): Promise<Owner | null> {
  if (!hasDatabase()) return null;

  const cookieValue = request.cookies.get(OWNER_COOKIE_NAME)?.value?.trim();
  if (!cookieValue) return null;

  return authenticateOwnerSession(cookieValue);
}
