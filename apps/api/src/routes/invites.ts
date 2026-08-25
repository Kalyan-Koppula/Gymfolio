import { Hono } from "hono"
import { and, desc, eq, isNull } from "drizzle-orm"
import { invites } from "db"
import { CreateInviteInputSchema } from "shared"
import { getDb } from "../lib/db.ts"
import { checkInviteToken, randomInviteToken } from "../lib/invites.ts"
import { requireAuth } from "../middleware/auth.ts"
import { requireOwner } from "../middleware/require-owner.ts"
import type { AppEnv } from "../types.ts"

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

const route = new Hono<AppEnv>()

// Public — what /join/:token calls on load. Returns a validity flag the frontend branches on
// directly, so a dead link renders a dead end rather than a form that's guaranteed to fail.
route.get("/:token", async (c) => {
  const db = getDb(c.env.DB)
  const check = await checkInviteToken(db, c.req.param("token"))
  if (!check.ok) return c.json({ valid: false, reason: check.reason })
  return c.json({ valid: true, label: check.invite.label })
})

route.use(requireAuth, requireOwner)

route.get("/", async (c) => {
  const { tenantId } = c.get("auth")
  const db = getDb(c.env.DB)
  const rows = await db
    .select()
    .from(invites)
    .where(eq(invites.tenantId, tenantId))
    .orderBy(desc(invites.createdAt))
  return c.json({
    invites: rows.map((r) => ({ id: r.id, label: r.label, expiresAt: r.expiresAt, usedAt: r.usedAt, createdAt: r.createdAt })),
  })
})

route.post("/", async (c) => {
  const body = CreateInviteInputSchema.safeParse(await c.req.json().catch(() => ({})))
  if (!body.success) return c.json({ error: body.error.flatten() }, 400)

  const { tenantId, userId } = c.get("auth")
  const db = getDb(c.env.DB)
  const id = crypto.randomUUID()
  const token = randomInviteToken()
  const expiresAt = Date.now() + INVITE_TTL_MS

  await db.insert(invites).values({
    id,
    tenantId,
    token,
    label: body.data.label ?? null,
    createdBy: userId,
    expiresAt,
    createdAt: Date.now(),
  })

  const joinUrl = `${c.env.WEBAUTHN_ORIGIN}/join/${token}`
  return c.json({ token, joinUrl, expiresAt }, 201)
})

// Revoking and "used" are the same underlying state (a dead token) — no separate concept.
route.delete("/:id", async (c) => {
  const { tenantId } = c.get("auth")
  const db = getDb(c.env.DB)
  await db
    .update(invites)
    .set({ usedAt: Date.now() })
    .where(and(eq(invites.id, c.req.param("id")), eq(invites.tenantId, tenantId), isNull(invites.usedAt)))
  return c.body(null, 204)
})

export { route as inviteRoutes }
