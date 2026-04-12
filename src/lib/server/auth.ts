import type { NextRequest } from 'next/server';
import { AUTH_COOKIE_NAME } from '@/lib/constants';
import { authenticateApiKey, authenticateBearer } from '@/lib/server/auth-service';
import { hasDatabase } from '@/lib/server/db';
import { decryptSessionValue, hasSessionSecret } from '@/lib/server/session-crypto';

export async function getAuthenticatedAgent(request: NextRequest) {
  if (!hasDatabase()) {
    return null;
  }

  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const rawKey = authHeader.slice('Bearer '.length).trim();
    if (rawKey) {
      return authenticateBearer(rawKey);
    }
  }

  const cookieRaw = request.cookies.get(AUTH_COOKIE_NAME)?.value?.trim();
  if (!cookieRaw) {
    return null;
  }

  const cookieKey = hasSessionSecret() ? decryptSessionValue(cookieRaw) : cookieRaw;
  if (!cookieKey) {
    return null;
  }

  return authenticateApiKey(cookieKey);
}
