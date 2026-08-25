import { eq } from "drizzle-orm"
import { sessions, users } from "db"
import type { Db } from "./db.ts"
import type { AuthContext } from "../types.ts"

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
): Promise<{ sessionId: string; expiresAt: number }> {
  const sessionId = crypto.randomUUID()
  const expiresAt = Date.now() + SESSION_TTL_SECONDS * 1000

  await db.insert(sessions).values({ id: sessionId, userId, expiresAt })
  await kv.put(kvKey(sessionId), JSON.stringify({ userId, tenantId, expiresAt }), {
    expirationTtl: SESSION_TTL_SECONDS,
  })

  return { sessionId, expiresAt }
}

/**
 * KV first (fast, edge-local — architecture §8), falling back to D1 (the durable record)
 * on a miss and repopulating KV — covers the case where a session was created on a KV
 * replica that hasn't caught up yet, or KV's cache was evicted.
 */
export async function resolveSession(
  db: Db,
  kv: KVNamespace,
  sessionId: string,
): Promise<AuthContext | null> {
  const cached = await kv.get(kvKey(sessionId), "json") as
    | { userId: string; tenantId: string; expiresAt: number }
    | null
  if (cached) {
    if (cached.expiresAt < Date.now()) return null
    return { userId: cached.userId, tenantId: cached.tenantId }
  }

  const [row] = await db
    .select({ userId: sessions.userId, expiresAt: sessions.expiresAt, tenantId: users.tenantId })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.id, sessionId))
    .limit(1)
  if (!row || row.expiresAt < Date.now()) return null

  // Architecture §2's Session table is keyed by user_id only, not tenant_id — join
  // through users to recover it, then repopulate KV so the next lookup hits the fast path.
  await kv.put(
    kvKey(sessionId),
    JSON.stringify({ userId: row.userId, tenantId: row.tenantId, expiresAt: row.expiresAt }),
    { expirationTtl: Math.max(1, Math.floor((row.expiresAt - Date.now()) / 1000)) },
  )
  return { userId: row.userId, tenantId: row.tenantId }
}

export async function destroySession(db: Db, kv: KVNamespace, sessionId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, sessionId))
  await kv.delete(kvKey(sessionId))
}
