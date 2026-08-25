import { eq } from "drizzle-orm"
import { invites } from "db"
import type { Db } from "./db.ts"

/** 24 random bytes, base64url-encoded — long enough to be unguessable, URL-safe to paste
 * straight into a link. */
export function randomInviteToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  let binary = ""
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

export type InviteCheckResult =
  | { ok: true; invite: typeof invites.$inferSelect }
  | { ok: false; reason: "not_found" | "expired" | "used" }

/** One source of truth for "is this link still good" — used identically by the public
 * validation endpoint and by registration itself, so there's no window where a link that
 * reads as dead in the UI still works if hit directly. */
export async function checkInviteToken(db: Db, token: string): Promise<InviteCheckResult> {
  const [invite] = await db.select().from(invites).where(eq(invites.token, token)).limit(1)
  if (!invite) return { ok: false, reason: "not_found" }
  if (invite.usedAt != null) return { ok: false, reason: "used" }
  if (invite.expiresAt < Date.now()) return { ok: false, reason: "expired" }
  return { ok: true, invite }
}
