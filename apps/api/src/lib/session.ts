import { and, eq, isNull } from "drizzle-orm"
import { sessions, users } from "db"
import type { Db } from "./db.ts"
import type { AuthContext, Role } from "../types.ts"

export const SESSION_COOKIE = "session"
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30 // 30 days

function kvKey(sessionId: string) {
  return `session:${sessionId}`
}

export async function createSession(
  db: Db,
  kv: KVNamespace,
  userId: string,
  tenantId: string,
  role: Role,
): Promise<{ sessionId: string; expiresAt: number }> {
  const sessionId = crypto.randomUUID()
  const expiresAt = Date.now() + SESSION_TTL_SECONDS * 1000

  await db.insert(sessions).values({ id: sessionId, userId, expiresAt })
  await kv.put(kvKey(sessionId), JSON.stringify({ userId, tenantId, role, expiresAt }), {
    expirationTtl: SESSION_TTL_SECONDS,
  })

  return { sessionId, expiresAt }
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
  const cached = (await kv.get(kvKey(sessionId), "json")) as
    | { userId: string; tenantId: string; role: Role; expiresAt: number }
    | null
  if (cached) {
    if (cached.expiresAt < Date.now()) return null
    return { userId: cached.userId, tenantId: cached.tenantId, role: cached.role }
  }

  const [row] = await db
    .select({
      userId: sessions.userId,
      expiresAt: sessions.expiresAt,
      tenantId: users.tenantId,
      role: users.role,
    })
    .from(sessions)
    .innerJoin(users, and(eq(users.id, sessions.userId), isNull(users.deactivatedAt)))
    .where(eq(sessions.id, sessionId))
    .limit(1)
  if (!row || row.expiresAt < Date.now()) return null

  const role = row.role as Role
  await kv.put(
    kvKey(sessionId),
    JSON.stringify({ userId: row.userId, tenantId: row.tenantId, role, expiresAt: row.expiresAt }),
    { expirationTtl: Math.max(1, Math.floor((row.expiresAt - Date.now()) / 1000)) },
  )
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
