import { sqliteTable, text, integer, real, uniqueIndex } from "drizzle-orm/sqlite-core"

// Scoped to the Foundation pass (architecture §2) plus auth, settings, routines, workouts, theme.

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

export const bodyMetricEntries = sqliteTable(
  "body_metric_entries",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    date: text("date").notNull(), // YYYY-MM-DD — one row per user+date (upsert)
    weightKg: real("weight_kg").notNull(),
    measurementsJson: text("measurements_json"), // optional JSON-encoded Record<string, number>
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [uniqueIndex("body_metric_entries_tenant_user_date_idx").on(table.tenantId, table.userId, table.date)],
)

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

export const sleepEntries = sqliteTable(
  "sleep_entries",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    date: text("date").notNull(), // one row per user+date (upsert)
    startTime: text("start_time").notNull(), // HH:MM
    endTime: text("end_time").notNull(), // HH:MM
    qualityRating: integer("quality_rating").notNull(), // 1-5
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [uniqueIndex("sleep_entries_tenant_user_date_idx").on(table.tenantId, table.userId, table.date)],
)

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
  (table) => [uniqueIndex("macro_entries_tenant_user_date_idx").on(table.tenantId, table.userId, table.date)],
)

// One row per user — hydration/macro goals and equipment inventory set during onboarding
// (and editable afterward from Settings). PK is userId directly rather than a separate id +
// unique index, since exactly one settings row per person is the actual invariant.
export const userSettings = sqliteTable("user_settings", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id),
  tenantId: text("tenant_id")
    .notNull()
    .references(() => tenants.id),
  hydrationGoalMl: integer("hydration_goal_ml").notNull().default(3000),
  macroMode: text("macro_mode").notNull().default("computed"), // "computed" | "manual"
  bodyweightKg: real("bodyweight_kg"),
  macroCalories: integer("macro_calories").notNull().default(2400),
  macroProtein: integer("macro_protein").notNull().default(180),
  macroCarbs: integer("macro_carbs").notNull().default(240),
  macroFat: integer("macro_fat").notNull().default(70),
  equipmentJson: text("equipment_json").notNull().default("[]"), // JSON-encoded Equipment[]
  onboardingCompletedAt: integer("onboarding_completed_at"),
  updatedAt: integer("updated_at").notNull(),
})

// One row per user — the current active routine. No isActive flag / multi-routine history;
// saving a routine replaces this row wholesale, same one-row-per-user shape as userSettings.
export const routines = sqliteTable("routines", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id),
  tenantId: text("tenant_id")
    .notNull()
    .references(() => tenants.id),
  name: text("name").notNull(),
  splitType: text("split_type").notNull(),
  scheduleJson: text("schedule_json").notNull(), // JSON-encoded SchedulePattern
  daysJson: text("days_json").notNull(), // JSON-encoded RoutineDay[]
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
})

// One row per workout session (in progress or completed). dayIndex is the routine.days
// position at start time so adherence / cycle advancement don't depend on label renames.
export const workoutLogs = sqliteTable("workout_logs", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id")
    .notNull()
    .references(() => tenants.id),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  date: text("date").notNull(), // YYYY-MM-DD
  dayLabel: text("day_label").notNull(),
  dayIndex: integer("day_index").notNull(),
  status: text("status").notNull().default("in_progress"), // "in_progress" | "completed" | "skipped"
  setsPlanned: integer("sets_planned").notNull(),
  setsCompleted: integer("sets_completed").notNull().default(0),
  startedAt: integer("started_at").notNull(),
  completedAt: integer("completed_at"),
  updatedAt: integer("updated_at").notNull(),
})

export const workoutLogSets = sqliteTable("workout_log_sets", {
  id: text("id").primaryKey(),
  workoutLogId: text("workout_log_id")
    .notNull()
    .references(() => workoutLogs.id),
  exerciseId: text("exercise_id").notNull(),
  setIndex: integer("set_index").notNull(), // 0-based within that exercise for this session
  actualReps: integer("actual_reps").notNull(),
  actualWeightKg: real("actual_weight_kg").notNull(),
  updatedAt: integer("updated_at").notNull(),
})

// Shared reference data — not tenant-scoped. Seeded once; GIF/YouTube fields filled later.
export const exercises = sqliteTable("exercises", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  muscleGroupsJson: text("muscle_groups_json").notNull(), // JSON string[]
  equipmentJson: text("equipment_json").notNull(), // JSON string[]
  difficulty: text("difficulty").notNull(), // beginner | intermediate | advanced
  instructions: text("instructions").notNull(),
  hasGif: integer("has_gif").notNull().default(0), // 0/1
  gifR2Key: text("gif_r2_key"),
  youtubeStatus: text("youtube_status").notNull().default("not_fetched"),
  youtubeJson: text("youtube_json"), // optional { title, channel, views }
})

// Per-user appearance — D1 is source of truth; clients mirror to localStorage for instant paint.
export const themePreferences = sqliteTable("theme_preferences", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id),
  tenantId: text("tenant_id")
    .notNull()
    .references(() => tenants.id),
  themeId: text("theme_id").notNull().default("zinc"),
  mode: text("mode").notNull().default("system"), // light | dark | system
  radius: real("radius").notNull().default(0.625),
  fontPairing: text("font_pairing").notNull().default("sans"),
  updatedAt: integer("updated_at").notNull(),
})

// Per-tenant encrypted BYOK config — at most one row per tenant for v0.
export const aiProviderConfigs = sqliteTable("ai_provider_configs", {
  tenantId: text("tenant_id")
    .primaryKey()
    .references(() => tenants.id),
  provider: text("provider").notNull(), // openrouter | local
  modelSlug: text("model_slug").notNull().default("openrouter/free"),
  encryptedApiKey: text("encrypted_api_key").notNull(),
  iv: text("iv").notNull(),
  endpointOverride: text("endpoint_override"),
  updatedAt: integer("updated_at").notNull(),
})
