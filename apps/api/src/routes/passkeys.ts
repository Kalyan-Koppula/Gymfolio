import { Hono } from "hono"
import { and, eq, isNull } from "drizzle-orm"
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type WebAuthnCredential,
} from "@simplewebauthn/server"
import { isoBase64URL } from "@simplewebauthn/server/helpers"
import { credentials, users } from "db"
import type { Role } from "shared"
import { getDb } from "../lib/db.ts"
import { createSession } from "../lib/session.ts"
import { setSessionCookie, serializeUser } from "../lib/session-response.ts"
import { webAuthnConfig, storeChallenge, consumeChallenge } from "../lib/webauthn.ts"
import { requireAuth } from "../middleware/auth.ts"
import type { AppEnv } from "../types.ts"

const route = new Hono<AppEnv>()

function parseTransports(json: string | null) {
  if (!json) return undefined
  try {
    return JSON.parse(json) as ("ble" | "hybrid" | "internal" | "nfc" | "usb")[]
  } catch {
    return undefined
  }
}

// Discoverable credentials (residentKey: "required") so a shared family device can hold
// multiple people's passkeys and the browser/OS picks the right one — no username field
// needed before the biometric prompt.
route.post("/register-options", requireAuth, async (c) => {
  const { userId } = c.get("auth")
  const db = getDb(c.env.DB)
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
  if (!user) return c.json({ error: "User not found" }, 404)

  const existing = await db.select().from(credentials).where(eq(credentials.userId, userId))
  const { rpID, rpName } = webAuthnConfig(c.env)

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userName: user.username,
    userID: new TextEncoder().encode(userId).slice(),
    userDisplayName: user.username,
    attestationType: "none",
    excludeCredentials: existing.map((cred) => ({
      id: cred.credentialId,
      transports: parseTransports(cred.transports),
    })),
    authenticatorSelection: { residentKey: "required", userVerification: "preferred" },
  })

  const flowId = await storeChallenge(c.env.SESSIONS_KV, options.challenge, userId)
  return c.json({ flowId, options })
})

route.post("/register-verify", requireAuth, async (c) => {
  const { userId } = c.get("auth")
  const body = await c.req.json().catch(() => null)
  if (!body?.flowId || !body?.response) return c.json({ error: "Missing flowId or response" }, 400)

  const record = await consumeChallenge(c.env.SESSIONS_KV, body.flowId)
  if (!record || record.userId !== userId) return c.json({ error: "Passkey setup session expired — try again" }, 400)

  const { rpID, origin } = webAuthnConfig(c.env)
  let verification
  try {
    verification = await verifyRegistrationResponse({
      response: body.response,
      expectedChallenge: record.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    })
  } catch {
    return c.json({ error: "Passkey registration failed" }, 400)
  }
  if (!verification.verified || !verification.registrationInfo) {
    return c.json({ error: "Passkey registration failed" }, 400)
  }

  const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo
  const db = getDb(c.env.DB)
  await db.insert(credentials).values({
    id: crypto.randomUUID(),
    userId,
    credentialId: credential.id,
    publicKey: isoBase64URL.fromBuffer(credential.publicKey),
    counter: credential.counter,
    deviceType: credentialDeviceType,
    backedUp: credentialBackedUp ? 1 : 0,
    transports: credential.transports ? JSON.stringify(credential.transports) : null,
    label: typeof body.label === "string" ? body.label : null,
    createdAt: Date.now(),
  })

  return c.json({ ok: true }, 201)
})

route.post("/login-options", async (c) => {
  const { rpID } = webAuthnConfig(c.env)
  const options = await generateAuthenticationOptions({ rpID, userVerification: "preferred" })
  const flowId = await storeChallenge(c.env.SESSIONS_KV, options.challenge)
  return c.json({ flowId, options })
})

route.post("/login-verify", async (c) => {
  const body = await c.req.json().catch(() => null)
  if (!body?.flowId || !body?.response?.id) return c.json({ error: "Missing flowId or response" }, 400)

  const record = await consumeChallenge(c.env.SESSIONS_KV, body.flowId)
  if (!record) return c.json({ error: "Sign-in session expired — try again" }, 400)

  const db = getDb(c.env.DB)
  const [cred] = await db.select().from(credentials).where(eq(credentials.credentialId, body.response.id)).limit(1)
  if (!cred) return c.json({ error: "This passkey isn't registered here" }, 401)

  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, cred.userId), isNull(users.deactivatedAt)))
    .limit(1)
  if (!user) return c.json({ error: "This account is no longer active" }, 401)

  const { rpID, origin } = webAuthnConfig(c.env)
  const webAuthnCredential: WebAuthnCredential = {
    id: cred.credentialId,
    publicKey: isoBase64URL.toBuffer(cred.publicKey),
    counter: cred.counter,
    transports: parseTransports(cred.transports),
  }

  let verification
  try {
    verification = await verifyAuthenticationResponse({
      response: body.response,
      expectedChallenge: record.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: webAuthnCredential,
    })
  } catch {
    return c.json({ error: "Sign-in failed" }, 401)
  }
  if (!verification.verified) return c.json({ error: "Sign-in failed" }, 401)

  await db
    .update(credentials)
    .set({ counter: verification.authenticationInfo.newCounter, lastUsedAt: Date.now() })
    .where(eq(credentials.id, cred.id))

  const { sessionId, expiresAt } = await createSession(db, c.env.SESSIONS_KV, user.id, user.tenantId, user.role as Role)
  setSessionCookie(c, sessionId, expiresAt)

  return c.json({ user: serializeUser(user) })
})

/** List this account's registered passkeys (no sensitive credential material). */
route.get("/", requireAuth, async (c) => {
  const { userId } = c.get("auth")
  const db = getDb(c.env.DB)
  const rows = await db.select().from(credentials).where(eq(credentials.userId, userId))
  rows.sort((a, b) => b.createdAt - a.createdAt)
  return c.json({
    passkeys: rows.map((row) => ({
      id: row.id,
      label: row.label,
      deviceType: row.deviceType,
      backedUp: row.backedUp === 1,
      createdAt: row.createdAt,
      lastUsedAt: row.lastUsedAt,
    })),
  })
})

/** Rename a passkey (label only — the credential itself can't be edited). */
route.patch("/:id", requireAuth, async (c) => {
  const { userId } = c.get("auth")
  const id = c.req.param("id")
  const body = await c.req.json().catch(() => null)
  const label = typeof body?.label === "string" ? body.label.trim() : ""
  if (!label || label.length > 80) return c.json({ error: "Label must be 1–80 characters" }, 400)

  const db = getDb(c.env.DB)
  const [row] = await db
    .select()
    .from(credentials)
    .where(and(eq(credentials.id, id), eq(credentials.userId, userId)))
    .limit(1)
  if (!row) return c.json({ error: "Passkey not found" }, 404)

  await db.update(credentials).set({ label }).where(eq(credentials.id, id))
  return c.json({
    passkey: {
      id: row.id,
      label,
      deviceType: row.deviceType,
      backedUp: row.backedUp === 1,
      createdAt: row.createdAt,
      lastUsedAt: row.lastUsedAt,
    },
  })
})

route.delete("/:id", requireAuth, async (c) => {
  const { userId } = c.get("auth")
  const id = c.req.param("id")
  const db = getDb(c.env.DB)
  const [row] = await db
    .select()
    .from(credentials)
    .where(and(eq(credentials.id, id), eq(credentials.userId, userId)))
    .limit(1)
  if (!row) return c.json({ error: "Passkey not found" }, 404)

  await db.delete(credentials).where(eq(credentials.id, id))
  return c.body(null, 204)
})

export { route as passkeyRoutes }
