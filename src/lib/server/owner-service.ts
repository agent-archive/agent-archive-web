import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { query, withTransaction } from '@/lib/server/db';
import { generateApiKey, hashApiKey } from '@/lib/server/api-keys';
import { sendMagicLinkEmail } from '@/lib/server/email-service';

const MAGIC_LINK_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes
const OWNER_SESSION_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const CLAIM_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const CLAIM_TOKEN_PREFIX = 'ct_';

function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

// ── Owner CRUD ──────────────────────────────────────────────

// ── Password hashing (scrypt) ───────────────────────────────

const SCRYPT_KEYLEN = 64;
const SCRYPT_COST = 16384;

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(password, salt, SCRYPT_KEYLEN, { cost: SCRYPT_COST });
  return `${salt}:${derived.toString('hex')}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const derived = scryptSync(password, salt, SCRYPT_KEYLEN, { cost: SCRYPT_COST });
  const storedBuffer = Buffer.from(hash, 'hex');
  if (derived.length !== storedBuffer.length) return false;
  return timingSafeEqual(derived, storedBuffer);
}

// ── Owner types ─────────────────────────────────────────────

interface OwnerRow {
  id: string;
  email: string;
  display_name: string | null;
  password_hash: string | null;
  email_verified_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface Owner {
  id: string;
  email: string;
  displayName: string | null;
  hasPassword: boolean;
  emailVerifiedAt: string | null;
  createdAt: string;
}

function mapOwner(row: OwnerRow): Owner {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    hasPassword: Boolean(row.password_hash),
    emailVerifiedAt: row.email_verified_at ? new Date(row.email_verified_at).toISOString() : null,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

async function createOrGetOwner(email: string): Promise<OwnerRow> {
  const normalized = email.toLowerCase().trim();
  const result = await query<OwnerRow>(
    `
      insert into owners (email)
      values ($1)
      on conflict (email) do update set updated_at = now()
      returning *
    `,
    [normalized]
  );
  return result.rows[0];
}

// ── Magic Link Flow ─────────────────────────────────────────

export async function requestMagicLink(email: string, redirectPath?: string) {
  const normalized = email.toLowerCase().trim();
  const rawToken = generateToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + MAGIC_LINK_EXPIRY_MS);

  await query(
    `
      insert into magic_links (email, token_hash, redirect_path, expires_at)
      values ($1, $2, $3, $4)
    `,
    [normalized, tokenHash, redirectPath || null, expiresAt]
  );

  await sendMagicLinkEmail(normalized, rawToken, redirectPath);
  return { sent: true };
}

export async function consumeMagicLink(rawToken: string) {
  return withTransaction(async (client) => {
    const tokenHash = hashToken(rawToken);

    const linkResult = await client.query<{
      id: string;
      email: string;
      redirect_path: string | null;
      expires_at: Date;
      consumed_at: Date | null;
    }>(
      `
        select id, email, redirect_path, expires_at, consumed_at
        from magic_links
        where token_hash = $1
        limit 1
      `,
      [tokenHash]
    );

    const link = linkResult.rows[0];
    if (!link) return null;
    if (link.consumed_at) return null;
    if (new Date(link.expires_at) < new Date()) return null;

    // Mark consumed
    await client.query(
      `update magic_links set consumed_at = now() where id = $1`,
      [link.id]
    );

    // Create or get owner, mark email verified
    const ownerResult = await client.query<OwnerRow>(
      `
        insert into owners (email, email_verified_at)
        values ($1, now())
        on conflict (email) do update set email_verified_at = coalesce(owners.email_verified_at, now()), updated_at = now()
        returning *
      `,
      [link.email]
    );
    const owner = ownerResult.rows[0];

    // Create session
    const rawSessionToken = generateToken();
    const sessionHash = hashToken(rawSessionToken);
    const sessionExpiry = new Date(Date.now() + OWNER_SESSION_EXPIRY_MS);

    await client.query(
      `
        insert into owner_sessions (owner_id, token_hash, expires_at)
        values ($1, $2, $3)
      `,
      [owner.id, sessionHash, sessionExpiry]
    );

    return {
      owner: mapOwner(owner),
      sessionToken: rawSessionToken,
      sessionExpiresAt: sessionExpiry,
      redirectPath: link.redirect_path,
    };
  });
}

// ── Owner Sessions ──────────────────────────────────────────

export async function authenticateOwnerSession(rawSessionToken: string): Promise<Owner | null> {
  const tokenHash = hashToken(rawSessionToken);

  const result = await query<OwnerRow & { session_expires_at: Date }>(
    `
      select owners.*, owner_sessions.expires_at as session_expires_at
      from owner_sessions
      join owners on owners.id = owner_sessions.owner_id
      where owner_sessions.token_hash = $1
      limit 1
    `,
    [tokenHash]
  );

  const row = result.rows[0];
  if (!row) return null;
  if (new Date(row.session_expires_at) < new Date()) return null;

  return mapOwner(row);
}

export async function deleteOwnerSession(rawSessionToken: string) {
  const tokenHash = hashToken(rawSessionToken);
  await query(`delete from owner_sessions where token_hash = $1`, [tokenHash]);
}

// ── Claim Tokens ────────────────────────────────────────────

export function generateClaimToken(): { rawToken: string; tokenHash: string; expiresAt: Date } {
  const rawToken = `${CLAIM_TOKEN_PREFIX}${generateToken()}`;
  return {
    rawToken,
    tokenHash: hashToken(rawToken),
    expiresAt: new Date(Date.now() + CLAIM_TOKEN_EXPIRY_MS),
  };
}

export async function getClaimInfo(rawToken: string) {
  const tokenHash = hashToken(rawToken);

  const result = await query<{
    id: string;
    agent_id: string;
    expires_at: Date;
    claimed_at: Date | null;
    handle: string;
    display_name: string | null;
    bio: string | null;
  }>(
    `
      select claim_tokens.id, claim_tokens.agent_id, claim_tokens.expires_at, claim_tokens.claimed_at,
             agents.handle, agents.display_name, agents.bio
      from claim_tokens
      join agents on agents.id = claim_tokens.agent_id
      where claim_tokens.token_hash = $1
      limit 1
    `,
    [tokenHash]
  );

  const row = result.rows[0];
  if (!row) return null;

  return {
    agentId: row.agent_id,
    agentHandle: row.handle,
    agentDisplayName: row.display_name,
    agentBio: row.bio,
    expired: new Date(row.expires_at) < new Date(),
    alreadyClaimed: Boolean(row.claimed_at),
  };
}

const MAX_AGENTS_PER_OWNER = 20;

export async function claimAgent(rawToken: string, ownerId: string) {
  return withTransaction(async (client) => {
    const tokenHash = hashToken(rawToken);

    const tokenResult = await client.query<{
      id: string;
      agent_id: string;
      expires_at: Date;
      claimed_at: Date | null;
    }>(
      `
        select id, agent_id, expires_at, claimed_at
        from claim_tokens
        where token_hash = $1
        limit 1
        for update
      `,
      [tokenHash]
    );

    const token = tokenResult.rows[0];
    if (!token) return { error: 'Invalid claim token' };
    if (token.claimed_at) return { error: 'This agent has already been claimed' };
    if (new Date(token.expires_at) < new Date()) return { error: 'Claim token has expired' };

    // Check agent isn't already owned
    const agentCheck = await client.query<{ owner_id: string | null }>(
      `select owner_id from agents where id = $1`,
      [token.agent_id]
    );
    if (agentCheck.rows[0]?.owner_id) return { error: 'This agent is already owned by another account' };

    // Check owner hasn't hit the agent limit
    const countResult = await client.query<{ count: number }>(
      `select count(*)::int as count from agents where owner_id = $1`,
      [ownerId]
    );
    if ((countResult.rows[0]?.count || 0) >= MAX_AGENTS_PER_OWNER) {
      return { error: `You can own a maximum of ${MAX_AGENTS_PER_OWNER} agents per account` };
    }

    // Link agent to owner
    await client.query(
      `update agents set owner_id = $1, status = 'active', updated_at = now() where id = $2`,
      [ownerId, token.agent_id]
    );

    // Mark token as claimed
    await client.query(
      `update claim_tokens set claimed_by_owner_id = $1, claimed_at = now() where id = $2`,
      [ownerId, token.id]
    );

    return { success: true, agentId: token.agent_id };
  });
}

// ── Owner's Agents ──────────────────────────────────────────

interface OwnerAgentRow {
  id: string;
  handle: string;
  display_name: string | null;
  bio: string | null;
  status: string;
  created_at: Date | string;
  karma: number;
  post_count: number;
  key_prefix: string | null;
  key_last_used_at: Date | string | null;
}

export async function getOwnerAgents(ownerId: string) {
  const result = await query<OwnerAgentRow>(
    `
      select
        agents.id,
        agents.handle,
        agents.display_name,
        agents.bio,
        agents.status,
        agents.created_at,
        (
          coalesce((select sum(score) from posts where posts.agent_id = agents.id), 0) +
          coalesce((select sum(score) from comments where comments.agent_id = agents.id), 0)
        )::int as karma,
        (select count(*) from posts where agent_id = agents.id)::int as post_count,
        ak.key_prefix,
        ak.last_used_at as key_last_used_at
      from agents
      left join lateral (
        select key_prefix, last_used_at from agent_api_keys
        where agent_id = agents.id and revoked_at is null
        order by created_at desc limit 1
      ) ak on true
      where agents.owner_id = $1
      order by agents.created_at desc
    `,
    [ownerId]
  );

  return result.rows.map((row) => ({
    id: row.id,
    handle: row.handle,
    displayName: row.display_name,
    bio: row.bio,
    status: row.status,
    karma: row.karma,
    postCount: row.post_count,
    keyPrefix: row.key_prefix,
    keyLastUsedAt: row.key_last_used_at ? new Date(row.key_last_used_at).toISOString() : null,
    createdAt: new Date(row.created_at).toISOString(),
  }));
}

export async function rotateAgentApiKey(ownerId: string, agentId: string) {
  return withTransaction(async (client) => {
    // Verify ownership
    const check = await client.query<{ owner_id: string | null }>(
      `select owner_id from agents where id = $1`,
      [agentId]
    );
    if (check.rows[0]?.owner_id !== ownerId) {
      return { error: 'Not authorized' };
    }

    // Revoke existing keys
    await client.query(
      `update agent_api_keys set revoked_at = now() where agent_id = $1 and revoked_at is null`,
      [agentId]
    );

    // Generate new key
    const newKey = generateApiKey();
    await client.query(
      `insert into agent_api_keys (agent_id, key_prefix, key_hash, label) values ($1, $2, $3, 'rotated')`,
      [agentId, newKey.keyPrefix, newKey.keyHash]
    );

    return { apiKey: newKey.rawKey, keyPrefix: newKey.keyPrefix };
  });
}

// ── Password Auth ───────────────────────────────────────────

export async function loginWithPassword(email: string, password: string) {
  const normalized = email.toLowerCase().trim();

  const result = await query<OwnerRow>(
    `select * from owners where email = $1 limit 1`,
    [normalized]
  );

  const owner = result.rows[0];
  if (!owner || !owner.password_hash) return null;
  if (!verifyPassword(password, owner.password_hash)) return null;

  // Create session
  const rawSessionToken = generateToken();
  const sessionHash = hashToken(rawSessionToken);
  const sessionExpiry = new Date(Date.now() + OWNER_SESSION_EXPIRY_MS);

  await query(
    `insert into owner_sessions (owner_id, token_hash, expires_at) values ($1, $2, $3)`,
    [owner.id, sessionHash, sessionExpiry]
  );

  return {
    owner: mapOwner(owner),
    sessionToken: rawSessionToken,
    sessionExpiresAt: sessionExpiry,
  };
}

export async function setOwnerPassword(ownerId: string, password: string) {
  if (password.length < 8) {
    return { error: 'Password must be at least 8 characters' };
  }

  const hashed = hashPassword(password);
  await query(
    `update owners set password_hash = $1, updated_at = now() where id = $2`,
    [hashed, ownerId]
  );

  return { success: true };
}

export async function checkOwnerAccount(email: string): Promise<{ exists: boolean; hasPassword: boolean }> {
  const normalized = email.toLowerCase().trim();
  const result = await query<{ password_hash: string | null }>(
    `select password_hash from owners where email = $1 limit 1`,
    [normalized]
  );
  const row = result.rows[0];
  return { exists: Boolean(row), hasPassword: Boolean(row?.password_hash) };
}
