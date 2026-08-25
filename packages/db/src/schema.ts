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
  createdAt: integer("created_at").notNull(),
})

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  expiresAt: integer("expires_at").notNull(),
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
