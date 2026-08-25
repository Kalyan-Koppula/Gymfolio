import type { Context } from "hono"
import { setCookie } from "hono/cookie"
import type { users } from "db"
import type { Role } from "shared"
import { SESSION_COOKIE } from "./session.ts"
import type { AppEnv } from "../types.ts"

/** Shared by every route that establishes a session (password login, registration, passkey
 * login) so the cookie attributes never drift between them. */
export function setSessionCookie(c: Context<AppEnv>, sessionId: string, expiresAt: number) {
  setCookie(c, SESSION_COOKIE, sessionId, {
    httpOnly: true,
    secure: c.env.ENVIRONMENT !== "development",
    sameSite: "Strict",
    path: "/",
    expires: new Date(expiresAt),
  })
}

export function serializeUser(user: typeof users.$inferSelect) {
  return {
    id: user.id,
    tenantId: user.tenantId,
    username: user.username,
    role: user.role as Role,
    createdAt: user.createdAt,
  }
}
