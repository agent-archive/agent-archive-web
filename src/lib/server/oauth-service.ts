import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { query, withTransaction } from '@/lib/server/db';

// ── Constants ───────────────────────────────────────────────

const CLIENT_ID_PREFIX = 'cc_';
const ACCESS_TOKEN_PREFIX = 'aat_';
const REFRESH_TOKEN_PREFIX = 'art_';
const AUTH_CODE_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const ACCESS_TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
const REFRESH_TOKEN_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// ── Crypto helpers ──────────────────────────────────────────

function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

function generateRandom(prefix: string): { raw: string; hash: string } {
  const raw = `${prefix}${randomBytes(32).toString('base64url')}`;
  return { raw, hash: hashToken(raw) };
}

function base64urlEncode(buffer: Buffer): string {
  return buffer.toString('base64url');
}

// ── PKCE ────────────────────────────────────────────────────

export function validatePkce(codeVerifier: string, storedChallenge: string): boolean {
  const computed = base64urlEncode(createHash('sha256').update(codeVerifier).digest());
  const computedBuf = Buffer.from(computed, 'utf8');
  const storedBuf = Buffer.from(storedChallenge, 'utf8');
  if (computedBuf.length !== storedBuf.length) return false;
  return timingSafeEqual(computedBuf, storedBuf);
}

// ── Redirect URI validation ─────────────────────────────────

const LOOPBACK_PATTERN = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/.*)?$/;

export function isLoopbackUri(uri: string): boolean {
  return LOOPBACK_PATTERN.test(uri);
}

export function validateRedirectUri(uri: string, registeredUris: string[]): boolean {
  // For loopback clients, the port can vary (RFC 8252 Section 7.3)
  // We match the scheme + host, ignoring port
  try {
    const incoming = new URL(uri);
    if (!isLoopbackUri(uri)) return false;

    return registeredUris.some((registered) => {
      try {
        const reg = new URL(registered);
        return incoming.hostname === reg.hostname && incoming.pathname === reg.pathname;
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}

// ── Client Registration ─────────────────────────────────────

interface OAuthClientRow {
  id: string;
  client_id: string;
  client_name: string;
  redirect_uris: string[];
  grant_types: string[];
  scope: string;
  created_at: Date;
}

export async function registerClient(input: {
  clientName: string;
  redirectUris: string[];
  grantTypes?: string[];
}) {
  // Validate all redirect URIs are loopback
  for (const uri of input.redirectUris) {
    if (!isLoopbackUri(uri)) {
      throw new Error(`Invalid redirect URI: ${uri}. Only loopback addresses (127.0.0.1, localhost) are allowed.`);
    }
  }

  const clientId = `${CLIENT_ID_PREFIX}${randomBytes(32).toString('base64url')}`;
  const grantTypes = input.grantTypes || ['authorization_code', 'refresh_token'];

  const result = await query<OAuthClientRow>(
    `
      INSERT INTO oauth_clients (client_id, client_name, redirect_uris, grant_types)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `,
    [clientId, input.clientName, input.redirectUris, grantTypes]
  );

  const row = result.rows[0];
  return {
    client_id: row.client_id,
    client_name: row.client_name,
    redirect_uris: row.redirect_uris,
    grant_types: row.grant_types,
  };
}

export async function getClient(clientId: string): Promise<OAuthClientRow | null> {
  const result = await query<OAuthClientRow>(
    `SELECT * FROM oauth_clients WHERE client_id = $1 LIMIT 1`,
    [clientId]
  );
  return result.rows[0] || null;
}

// ── Authorization Codes ─────────────────────────────────────

export async function createAuthorizationCode(input: {
  clientId: string;
  ownerId: string;
  agentId: string;
  redirectUri: string;
  scope: string;
  codeChallenge: string;
}): Promise<string> {
  const { raw, hash } = generateRandom('');
  const expiresAt = new Date(Date.now() + AUTH_CODE_EXPIRY_MS);

  await query(
    `
      INSERT INTO oauth_authorization_codes
        (code_hash, client_id, owner_id, agent_id, redirect_uri, scope, code_challenge, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `,
    [hash, input.clientId, input.ownerId, input.agentId, input.redirectUri, input.scope, input.codeChallenge, expiresAt]
  );

  return raw;
}

// ── Token Exchange ──────────────────────────────────────────

interface AuthCodeRow {
  code_hash: string;
  client_id: string;
  owner_id: string;
  agent_id: string;
  redirect_uri: string;
  scope: string;
  code_challenge: string;
  code_challenge_method: string;
  expires_at: Date;
  consumed_at: Date | null;
}

export async function exchangeAuthorizationCode(input: {
  code: string;
  clientId: string;
  redirectUri: string;
  codeVerifier: string;
}) {
  return withTransaction(async (client) => {
    const codeHash = hashToken(input.code);

    const codeResult = await client.query<AuthCodeRow>(
      `SELECT * FROM oauth_authorization_codes WHERE code_hash = $1 LIMIT 1 FOR UPDATE`,
      [codeHash]
    );

    const codeRow = codeResult.rows[0];
    if (!codeRow) return { error: 'invalid_grant', error_description: 'Invalid authorization code' };
    if (codeRow.consumed_at) return { error: 'invalid_grant', error_description: 'Authorization code already used' };
    if (new Date(codeRow.expires_at) < new Date()) return { error: 'invalid_grant', error_description: 'Authorization code has expired' };
    if (codeRow.client_id !== input.clientId) return { error: 'invalid_grant', error_description: 'Client ID mismatch' };
    if (codeRow.redirect_uri !== input.redirectUri) return { error: 'invalid_grant', error_description: 'Redirect URI mismatch' };

    // PKCE validation
    if (!validatePkce(input.codeVerifier, codeRow.code_challenge)) {
      return { error: 'invalid_grant', error_description: 'PKCE verification failed' };
    }

    // Mark code as consumed
    await client.query(
      `UPDATE oauth_authorization_codes SET consumed_at = now() WHERE code_hash = $1`,
      [codeHash]
    );

    // Generate tokens
    const accessToken = generateRandom(ACCESS_TOKEN_PREFIX);
    const refreshToken = generateRandom(REFRESH_TOKEN_PREFIX);
    const accessExpiry = new Date(Date.now() + ACCESS_TOKEN_EXPIRY_MS);
    const refreshExpiry = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS);

    // Store access token
    const accessResult = await client.query<{ id: string }>(
      `
        INSERT INTO oauth_tokens (token_hash, token_type, client_id, owner_id, agent_id, scope, expires_at)
        VALUES ($1, 'access', $2, $3, $4, $5, $6)
        RETURNING id
      `,
      [accessToken.hash, codeRow.client_id, codeRow.owner_id, codeRow.agent_id, codeRow.scope, accessExpiry]
    );

    // Store refresh token
    await client.query(
      `
        INSERT INTO oauth_tokens (token_hash, token_type, client_id, owner_id, agent_id, scope, expires_at, parent_token_id)
        VALUES ($1, 'refresh', $2, $3, $4, $5, $6, $7)
      `,
      [refreshToken.hash, codeRow.client_id, codeRow.owner_id, codeRow.agent_id, codeRow.scope, refreshExpiry, accessResult.rows[0].id]
    );

    return {
      access_token: accessToken.raw,
      token_type: 'Bearer' as const,
      expires_in: Math.floor(ACCESS_TOKEN_EXPIRY_MS / 1000),
      refresh_token: refreshToken.raw,
      scope: codeRow.scope,
    };
  });
}

export async function refreshAccessToken(input: {
  refreshToken: string;
  clientId: string;
}) {
  return withTransaction(async (client) => {
    const tokenHash = hashToken(input.refreshToken);

    const tokenResult = await client.query<{
      id: string;
      client_id: string;
      owner_id: string;
      agent_id: string;
      scope: string;
      expires_at: Date;
      revoked_at: Date | null;
    }>(
      `SELECT * FROM oauth_tokens WHERE token_hash = $1 AND token_type = 'refresh' LIMIT 1 FOR UPDATE`,
      [tokenHash]
    );

    const tokenRow = tokenResult.rows[0];
    if (!tokenRow) return { error: 'invalid_grant', error_description: 'Invalid refresh token' };
    if (tokenRow.revoked_at) return { error: 'invalid_grant', error_description: 'Refresh token has been revoked' };
    if (new Date(tokenRow.expires_at) < new Date()) return { error: 'invalid_grant', error_description: 'Refresh token has expired' };
    if (tokenRow.client_id !== input.clientId) return { error: 'invalid_grant', error_description: 'Client ID mismatch' };

    // Revoke old refresh token
    await client.query(
      `UPDATE oauth_tokens SET revoked_at = now() WHERE id = $1`,
      [tokenRow.id]
    );

    // Generate new tokens
    const newAccessToken = generateRandom(ACCESS_TOKEN_PREFIX);
    const newRefreshToken = generateRandom(REFRESH_TOKEN_PREFIX);
    const accessExpiry = new Date(Date.now() + ACCESS_TOKEN_EXPIRY_MS);
    const refreshExpiry = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS);

    const newAccessResult = await client.query<{ id: string }>(
      `
        INSERT INTO oauth_tokens (token_hash, token_type, client_id, owner_id, agent_id, scope, expires_at, parent_token_id)
        VALUES ($1, 'access', $2, $3, $4, $5, $6, $7)
        RETURNING id
      `,
      [newAccessToken.hash, tokenRow.client_id, tokenRow.owner_id, tokenRow.agent_id, tokenRow.scope, accessExpiry, tokenRow.id]
    );

    await client.query(
      `
        INSERT INTO oauth_tokens (token_hash, token_type, client_id, owner_id, agent_id, scope, expires_at, parent_token_id)
        VALUES ($1, 'refresh', $2, $3, $4, $5, $6, $7)
      `,
      [newRefreshToken.hash, tokenRow.client_id, tokenRow.owner_id, tokenRow.agent_id, tokenRow.scope, refreshExpiry, newAccessResult.rows[0].id]
    );

    return {
      access_token: newAccessToken.raw,
      token_type: 'Bearer' as const,
      expires_in: Math.floor(ACCESS_TOKEN_EXPIRY_MS / 1000),
      refresh_token: newRefreshToken.raw,
      scope: tokenRow.scope,
    };
  });
}

// ── Token Validation (for auth layer) ───────────────────────

export async function validateOAuthAccessToken(rawToken: string): Promise<{ agentId: string; ownerId: string; scope: string } | null> {
  const tokenHash = hashToken(rawToken);

  const result = await query<{
    agent_id: string;
    owner_id: string;
    scope: string;
    expires_at: Date;
  }>(
    `
      SELECT agent_id, owner_id, scope, expires_at
      FROM oauth_tokens
      WHERE token_hash = $1 AND token_type = 'access' AND revoked_at IS NULL
      LIMIT 1
    `,
    [tokenHash]
  );

  const row = result.rows[0];
  if (!row) return null;
  if (new Date(row.expires_at) < new Date()) return null;

  return {
    agentId: row.agent_id,
    ownerId: row.owner_id,
    scope: row.scope,
  };
}
