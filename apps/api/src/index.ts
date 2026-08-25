import { Hono } from "hono"
import { logger } from "hono/logger"
import { authRoutes } from "./routes/auth.ts"
import { bodyMetricsRoutes } from "./routes/body-metrics.ts"
import { hydrationRoutes } from "./routes/hydration.ts"
import { sleepRoutes } from "./routes/sleep.ts"
import { macrosRoutes } from "./routes/macros.ts"
import { inviteRoutes } from "./routes/invites.ts"
import { memberRoutes } from "./routes/members.ts"
import { passkeyRoutes } from "./routes/passkeys.ts"
import { settingsRoutes } from "./routes/settings.ts"
import { routineRoutes } from "./routes/routines.ts"
import type { AppEnv } from "./types.ts"

const app = new Hono<AppEnv>()

app.use(logger())

app.get("/api/health", (c) => c.json({ ok: true }))

app.route("/api/auth", authRoutes)
app.route("/api/body-metrics", bodyMetricsRoutes)
app.route("/api/hydration", hydrationRoutes)
app.route("/api/sleep", sleepRoutes)
app.route("/api/macros", macrosRoutes)
app.route("/api/invites", inviteRoutes)
app.route("/api/members", memberRoutes)
app.route("/api/auth/passkey", passkeyRoutes)
app.route("/api/settings", settingsRoutes)
app.route("/api/routines", routineRoutes)

export default app
