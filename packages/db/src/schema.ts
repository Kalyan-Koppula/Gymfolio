import { sqliteTable, text, integer, real, uniqueIndex } from "drizzle-orm/sqlite-core"

// Scoped to the Foundation pass (architecture §2, trimmed): auth + the four core logging
// modules only. Exercise/Routine/AIProviderConfig/ThemePreference are deliberately not
// defined yet — the frontend's routine model has already grown past the architecture
// doc's original shape (split types, schedules, performance history), so committing to a
// schema for it now would likely need reworking once that's actually planned.

export const tenants = sqliteTable("tenants", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: integer("created_at").notNull(),
})

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id")
    .notNull()
    .references(() => tenants.id),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("member"), // "owner" | "member" — exactly one owner per tenant
  deactivatedAt: integer("deactivated_at"), // null = active; set by the owner removing a member
  createdAt: integer("created_at").notNull(),
})

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  expiresAt: integer("expires_at").notNull(),
})

// The actual mechanism behind "no one else who opens this link can sign up" — a token is dead
// the instant it's used or past expiresAt, checked identically by the public validation
// endpoint and registration itself.
export const invites = sqliteTable("invites", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id")
    .notNull()
    .references(() => tenants.id),
  token: text("token").notNull().unique(),
  label: text("label"), // optional admin-facing nickname, e.g. "Mom"
  createdBy: text("created_by")
    .notNull()
    .references(() => users.id),
  expiresAt: integer("expires_at").notNull(),
  usedAt: integer("used_at"),
  usedByUserId: text("used_by_user_id").references(() => users.id),
  createdAt: integer("created_at").notNull(),
})

// Standard WebAuthn credential storage — nothing app-specific about this shape.
export const credentials = sqliteTable("credentials", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  credentialId: text("credential_id").notNull().unique(),
  publicKey: text("public_key").notNull(), // base64url-encoded COSE public key bytes
  counter: integer("counter").notNull().default(0),
  deviceType: text("device_type"), // "singleDevice" | "multiDevice"
  backedUp: integer("backed_up").notNull().default(0), // 0/1 — SQLite has no native boolean
  transports: text("transports"), // JSON-encoded string[], e.g. ["internal","hybrid"]
  label: text("label"), // e.g. "iPhone"
  createdAt: integer("created_at").notNull(),
  lastUsedAt: integer("last_used_at"),
})

export const bodyMetricEntries = sqliteTable("body_metric_entries", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id")
    .notNull()
    .references(() => tenants.id),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  date: text("date").notNull(), // YYYY-MM-DD
  weightKg: real("weight_kg").notNull(),
  measurementsJson: text("measurements_json"), // optional JSON-encoded Record<string, number>
  updatedAt: integer("updated_at").notNull(),
})

export const hydrationEntries = sqliteTable("hydration_entries", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id")
    .notNull()
    .references(() => tenants.id),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  date: text("date").notNull(),
  amountMl: integer("amount_ml").notNull(),
  updatedAt: integer("updated_at").notNull(),
})

export const sleepEntries = sqliteTable("sleep_entries", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id")
    .notNull()
    .references(() => tenants.id),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  date: text("date").notNull(),
  startTime: text("start_time").notNull(), // HH:MM
  endTime: text("end_time").notNull(), // HH:MM
  qualityRating: integer("quality_rating").notNull(), // 1-5
  updatedAt: integer("updated_at").notNull(),
})

export const macroEntries = sqliteTable(
  "macro_entries",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    date: text("date").notNull(), // one row per date — upsert, not an append log
    calories: integer("calories").notNull(),
    protein: integer("protein").notNull(),
    carbs: integer("carbs").notNull(),
    fat: integer("fat").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [uniqueIndex("macro_entries_user_date_idx").on(table.userId, table.date)],
)
