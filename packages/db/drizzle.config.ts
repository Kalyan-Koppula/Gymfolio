import { defineConfig } from "drizzle-kit"

// `generate` only diffs the schema into SQL files here — it doesn't need live D1
// credentials. Applying those files to the local D1 emulation is `wrangler d1 migrations
// apply --local`, run from apps/api (its wrangler.toml points migrations_dir at this
// folder), not drizzle-kit's own migrator.
export default defineConfig({
  schema: "./src/schema.ts",
  out: "./migrations",
  dialect: "sqlite",
})
