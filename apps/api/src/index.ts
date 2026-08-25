import { Hono } from "hono"
import { logger } from "hono/logger"
import { authRoutes } from "./routes/auth.ts"
import { bodyMetricsRoutes } from "./routes/body-metrics.ts"
import { hydrationRoutes } from "./routes/hydration.ts"
import { sleepRoutes } from "./routes/sleep.ts"
import { macrosRoutes } from "./routes/macros.ts"
import type { AppEnv } from "./types.ts"

const app = new Hono<AppEnv>()

app.use(logger())

app.get("/api/health", (c) => c.json({ ok: true }))

app.route("/api/auth", authRoutes)
app.route("/api/body-metrics", bodyMetricsRoutes)
app.route("/api/hydration", hydrationRoutes)
app.route("/api/sleep", sleepRoutes)
app.route("/api/macros", macrosRoutes)

export default app
