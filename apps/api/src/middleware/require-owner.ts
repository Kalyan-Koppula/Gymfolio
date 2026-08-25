import { createMiddleware } from "hono/factory"
import type { AppEnv } from "../types.ts"

/** Chain after requireAuth. Family/invite management is owner-only — a regular member has
 * no path to inviting or removing anyone else. */
export const requireOwner = createMiddleware<AppEnv>(async (c, next) => {
  if (c.get("auth").role !== "owner") return c.json({ error: "Owner access required" }, 403)
  await next()
})
