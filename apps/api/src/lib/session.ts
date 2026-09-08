import { and, eq, isNull } from "drizzle-orm"
import { sessions, users } from "db"
import type { Db } from "./db.ts"
import type { AuthContext, Role } from "../types.ts"

export const SESSION_COOKIE = "session"
/** Absolute / sliding window length. */
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30 // 30 days
/** Don't rewrite D1/KV/cookie more often than this when extending. */
const TOUCH_MIN_INTERVAL_MS = 60 * 60 * 1000 // 1 hour

function kvKey(sessionId: string) {
  return `session:${sessionId}`
}

type KvPayload = {
  userId: string
  tenantId: string
  role: Role
  expiresAt: number
  lastActiveAt?: number
}

async function writeKv(
  kv: KVNamespace,
  sessionId: string,
  payload: KvPayload,
) {
  const ttl = Math.max(1, Math.floor((payload.expiresAt - Date.now()) / 1000))
  await kv.put(kvKey(sessionId), JSON.stringify(payload), { expirationTtl: ttl })
}

async function persistSession(
  db: Db,
  kv: KVNamespace,
  sessionId: string,
  userId: string,
  tenantId: string,
  role: Role,
  expiresAt: number,
  lastActiveAt: number,
  deviceKey: string | null,
) {
  await db
    .update(sessions)
    .set({
      expiresAt,
      lastActiveAt,
      ...(deviceKey ? { deviceKey } : {}),
    })
    .where(eq(sessions.id, sessionId))
  await writeKv(kv, sessionId, { userId, tenantId, role, expiresAt, lastActiveAt })
}

export type CreateSessionOpts = {
  /** Client-stable id for this browser/PWA install. */
  deviceKey?: string | null
  /** Cookie already on the request — reuse if it belongs to this user. */
  currentSessionId?: string | null
}

/**
 * Netflix-style: one live session per (user, device). Re-login or PWA reopen
 * refreshes the same row instead of minting duplicates.
 */
export async function createOrRefreshSession(
  db: Db,
  kv: KVNamespace,
  userId: string,
  tenantId: string,
  role: Role,
  opts: CreateSessionOpts = {},
): Promise<{ sessionId: string; expiresAt: number }> {
  const now = Date.now()
  const expiresAt = now + SESSION_TTL_SECONDS * 1000
  const deviceKey = opts.deviceKey?.trim() || null

  if (opts.currentSessionId) {
    const [current] = await db
      .select()
      .from(sessions)
      .where(eq(sessions.id, opts.currentSessionId))
      .limit(1)
    if (current && current.userId === userId && current.expiresAt > now) {
      await persistSession(
        db,
        kv,
        current.id,
        userId,
        tenantId,
        role,
        expiresAt,
        now,
        deviceKey ?? current.deviceKey,
      )
      return { sessionId: current.id, expiresAt }
    }
  }

  if (deviceKey) {
    const [byDevice] = await db
      .select()
      .from(sessions)
      .where(and(eq(sessions.userId, userId), eq(sessions.deviceKey, deviceKey)))
      .limit(1)
    if (byDevice) {
      if (byDevice.expiresAt > now) {
        await persistSession(db, kv, byDevice.id, userId, tenantId, role, expiresAt, now, deviceKey)
        return { sessionId: byDevice.id, expiresAt }
      }
      await destroySession(db, kv, byDevice.id)
    }
  }

  const sessionId = crypto.randomUUID()
  await db.insert(sessions).values({
    id: sessionId,
    userId,
    expiresAt,
    deviceKey,
    lastActiveAt: now,
  })
  await writeKv(kv, sessionId, { userId, tenantId, role, expiresAt, lastActiveAt: now })
  return { sessionId, expiresAt }
}

/** @deprecated Prefer createOrRefreshSession — kept for any leftover call sites. */
export async function createSession(
  db: Db,
  kv: KVNamespace,
  userId: string,
  tenantId: string,
  role: Role,
  opts: CreateSessionOpts = {},
): Promise<{ sessionId: string; expiresAt: number }> {
  return createOrRefreshSession(db, kv, userId, tenantId, role, opts)
}

/**
 * Sliding TTL: if the session is active and hasn't been touched recently,
 * push expiresAt forward. Returns new expiresAt when the cookie should be rewritten.
 */
export async function maybeExtendSession(
  db: Db,
  kv: KVNamespace,
  sessionId: string,
  auth: AuthContext,
): Promise<number | null> {
  const now = Date.now()
  const cached = (await kv.get(kvKey(sessionId), "json")) as KvPayload | null
  const lastActive = cached?.lastActiveAt ?? 0
  const expiresAt = cached?.expiresAt ?? 0

  // Throttle writes — extend at most once per hour unless expiry is near (< 7 days).
  const nearExpiry = expiresAt > 0 && expiresAt - now < 7 * 24 * 60 * 60 * 1000
  if (!nearExpiry && lastActive && now - lastActive < TOUCH_MIN_INTERVAL_MS) {
    return null
  }

  const [row] = await db.select().from(sessions).where(eq(sessions.id, sessionId)).limit(1)
  if (!row || row.expiresAt < now || row.userId !== auth.userId) return null

  const rowLast = row.lastActiveAt ?? 0
  if (!nearExpiry && rowLast && now - rowLast < TOUCH_MIN_INTERVAL_MS) {
    return null
  }

  const nextExpires = now + SESSION_TTL_SECONDS * 1000
  await persistSession(
    db,
    kv,
    sessionId,
    auth.userId,
    auth.tenantId,
    auth.role,
    nextExpires,
    now,
    row.deviceKey,
  )
  return nextExpires
}

/**
 * KV first (fast, edge-local — architecture §8), falling back to D1 (the durable record)
 * on a miss and repopulating KV — covers the case where a session was created on a KV
 * replica that hasn't caught up yet, or KV's cache was evicted. The D1 fallback also
 * filters out deactivated users, so a stale/evicted KV entry can never resurrect access
 * for someone the family admin has removed — deactivation is enforced at both layers, not
 * just at the point sessions were explicitly deleted.
 */
export async function resolveSession(
  db: Db,
  kv: KVNamespace,
  sessionId: string,
): Promise<AuthContext | null> {
  const cached = (await kv.get(kvKey(sessionId), "json")) as KvPayload | null
  if (cached) {
    if (cached.expiresAt < Date.now()) return null
    return { userId: cached.userId, tenantId: cached.tenantId, role: cached.role }
  }

  const [row] = await db
    .select({
      userId: sessions.userId,
      expiresAt: sessions.expiresAt,
      lastActiveAt: sessions.lastActiveAt,
      tenantId: users.tenantId,
      role: users.role,
    })
    .from(sessions)
    .innerJoin(users, and(eq(users.id, sessions.userId), isNull(users.deactivatedAt)))
    .where(eq(sessions.id, sessionId))
    .limit(1)
  if (!row || row.expiresAt < Date.now()) return null

  const role = row.role as Role
  await writeKv(kv, sessionId, {
    userId: row.userId,
    tenantId: row.tenantId,
    role,
    expiresAt: row.expiresAt,
    lastActiveAt: row.lastActiveAt ?? undefined,
  })
  return { userId: row.userId, tenantId: row.tenantId, role }
}

export async function destroySession(db: Db, kv: KVNamespace, sessionId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, sessionId))
  await kv.delete(kvKey(sessionId))
}

/** Forces an immediate logout everywhere — used when the owner deactivates a member, so
 * revocation takes effect on their very next request rather than waiting for KV eviction. */
export async function destroyAllSessionsForUser(db: Db, kv: KVNamespace, userId: string): Promise<void> {
  const rows = await db.select({ id: sessions.id }).from(sessions).where(eq(sessions.userId, userId))
  await Promise.all(rows.map((r) => kv.delete(kvKey(r.id))))
  await db.delete(sessions).where(eq(sessions.userId, userId))
}
