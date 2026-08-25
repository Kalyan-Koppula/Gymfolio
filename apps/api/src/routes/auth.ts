import { Hono } from "hono"
import { deleteCookie, getCookie } from "hono/cookie"
import { and, eq, isNull } from "drizzle-orm"
import { invites, tenants, users } from "db"
import { RegisterInputSchema, LoginInputSchema, type Role } from "shared"
import { getDb } from "../lib/db.ts"
import { hashPassword, verifyPassword } from "../lib/password.ts"
import { createSession, destroySession, SESSION_COOKIE } from "../lib/session.ts"
import { setSessionCookie, serializeUser } from "../lib/session-response.ts"
import { checkInviteToken } from "../lib/invites.ts"
import { requireAuth } from "../middleware/auth.ts"
import type { AppEnv } from "../types.ts"

const DEFAULT_TENANT_ID = "default"

const auth = new Hono<AppEnv>()

// Public — the check `/` uses to decide whether to send a fresh visitor to Onboarding
// (bootstrap the instance) or Login (an account already exists somewhere).
auth.get("/has-account", async (c) => {
  const db = getDb(c.env.DB)
  const [existing] = await db.select({ id: users.id }).from(users).limit(1)
  return c.json({ hasAccount: Boolean(existing) })
})

// The instance's very first account becomes its owner (bootstrap, no invite needed — there's
// no one to invite them yet). Every registration after that requires a valid, unused,
// unexpired invite token, checked server-side via the same logic the public invite-validation
// endpoint uses — a spent or fabricated token fails here even if the UI check was bypassed.
auth.post("/register", async (c) => {
  const body = RegisterInputSchema.safeParse(await c.req.json())
  if (!body.success) return c.json({ error: body.error.flatten() }, 400)

  const db = getDb(c.env.DB)
  const [existing] = await db.select({ id: users.id }).from(users).limit(1)

  let tenantId: string
  let role: Role
  let inviteId: string | null = null

  if (!existing) {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, DEFAULT_TENANT_ID)).limit(1)
    if (!tenant) {
      await db.insert(tenants).values({ id: DEFAULT_TENANT_ID, name: "Family", createdAt: Date.now() })
    }
    tenantId = DEFAULT_TENANT_ID
    role = "owner"
  } else {
    if (!body.data.inviteToken) {
      return c.json({ error: "An account already exists — ask your family admin for an invite link." }, 403)
    }
    const check = await checkInviteToken(db, body.data.inviteToken)
    if (!check.ok) {
      return c.json({ error: "This invite link is no longer valid." }, 403)
    }
    tenantId = check.invite.tenantId
    role = "member"
    inviteId = check.invite.id
  }

  const userId = crypto.randomUUID()
  const passwordHash = await hashPassword(body.data.password)
  const createdAt = Date.now()
  await db.insert(users).values({ id: userId, tenantId, username: body.data.username, passwordHash, role, createdAt })

  if (inviteId) {
    await db.update(invites).set({ usedAt: Date.now(), usedByUserId: userId }).where(eq(invites.id, inviteId))
  }

  const { sessionId, expiresAt } = await createSession(db, c.env.SESSIONS_KV, userId, tenantId, role)
  setSessionCookie(c, sessionId, expiresAt)

  return c.json({ user: { id: userId, tenantId, username: body.data.username, role, createdAt } }, 201)
})

auth.post("/login", async (c) => {
  const body = LoginInputSchema.safeParse(await c.req.json())
  if (!body.success) return c.json({ error: body.error.flatten() }, 400)

  const db = getDb(c.env.DB)
  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.username, body.data.username), isNull(users.deactivatedAt)))
    .limit(1)
  if (!user) return c.json({ error: "Incorrect username or password" }, 401)

  const valid = await verifyPassword(body.data.password, user.passwordHash)
  if (!valid) return c.json({ error: "Incorrect username or password" }, 401)

  const { sessionId, expiresAt } = await createSession(db, c.env.SESSIONS_KV, user.id, user.tenantId, user.role as Role)
  setSessionCookie(c, sessionId, expiresAt)

  return c.json({ user: serializeUser(user) })
})

auth.post("/logout", async (c) => {
  const sessionId = getCookie(c, SESSION_COOKIE)
  if (sessionId) {
    const db = getDb(c.env.DB)
    await destroySession(db, c.env.SESSIONS_KV, sessionId)
  }
  deleteCookie(c, SESSION_COOKIE, { path: "/" })
  return c.body(null, 204)
})

auth.get("/session", requireAuth, async (c) => {
  const { userId } = c.get("auth")
  const db = getDb(c.env.DB)
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
  if (!user) return c.json({ error: "User not found" }, 404)
  return c.json({ user: serializeUser(user) })
})

export { auth as authRoutes }
