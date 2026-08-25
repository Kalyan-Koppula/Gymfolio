import { Hono } from "hono"
import { setCookie, deleteCookie, getCookie } from "hono/cookie"
import { eq } from "drizzle-orm"
import { tenants, users } from "db"
import { RegisterInputSchema, LoginInputSchema } from "shared"
import { getDb } from "../lib/db.ts"
import { hashPassword, verifyPassword } from "../lib/password.ts"
import { createSession, destroySession, SESSION_COOKIE } from "../lib/session.ts"
import { requireAuth } from "../middleware/auth.ts"
import type { AppEnv } from "../types.ts"

const DEFAULT_TENANT_ID = "default"

const auth = new Hono<AppEnv>()

function setSessionCookie(c: import("hono").Context<AppEnv>, sessionId: string, expiresAt: number) {
  setCookie(c, SESSION_COOKIE, sessionId, {
    httpOnly: true,
    secure: c.env.ENVIRONMENT !== "development",
    sameSite: "Strict",
    path: "/",
    expires: new Date(expiresAt),
  })
}

// Single-user instance (FR-10.2): registration only succeeds once, ever.
auth.post("/register", async (c) => {
  const body = RegisterInputSchema.safeParse(await c.req.json())
  if (!body.success) return c.json({ error: body.error.flatten() }, 400)

  const db = getDb(c.env.DB)

  const [existing] = await db.select({ id: users.id }).from(users).limit(1)
  if (existing) return c.json({ error: "This instance already has an account" }, 409)

  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, DEFAULT_TENANT_ID)).limit(1)
  if (!tenant) {
    await db.insert(tenants).values({ id: DEFAULT_TENANT_ID, name: "Default", createdAt: Date.now() })
  }

  const userId = crypto.randomUUID()
  const passwordHash = await hashPassword(body.data.password)
  await db.insert(users).values({
    id: userId,
    tenantId: DEFAULT_TENANT_ID,
    username: body.data.username,
    passwordHash,
    createdAt: Date.now(),
  })

  const { sessionId, expiresAt } = await createSession(db, c.env.SESSIONS_KV, userId, DEFAULT_TENANT_ID)
  setSessionCookie(c, sessionId, expiresAt)

  return c.json({ user: { id: userId, tenantId: DEFAULT_TENANT_ID, username: body.data.username, createdAt: Date.now() } }, 201)
})

auth.post("/login", async (c) => {
  const body = LoginInputSchema.safeParse(await c.req.json())
  if (!body.success) return c.json({ error: body.error.flatten() }, 400)

  const db = getDb(c.env.DB)
  const [user] = await db.select().from(users).where(eq(users.username, body.data.username)).limit(1)
  if (!user) return c.json({ error: "Incorrect username or password" }, 401)

  const valid = await verifyPassword(body.data.password, user.passwordHash)
  if (!valid) return c.json({ error: "Incorrect username or password" }, 401)

  const { sessionId, expiresAt } = await createSession(db, c.env.SESSIONS_KV, user.id, user.tenantId)
  setSessionCookie(c, sessionId, expiresAt)

  return c.json({ user: { id: user.id, tenantId: user.tenantId, username: user.username, createdAt: user.createdAt } })
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
  return c.json({ user: { id: user.id, tenantId: user.tenantId, username: user.username, createdAt: user.createdAt } })
})

export { auth as authRoutes }
