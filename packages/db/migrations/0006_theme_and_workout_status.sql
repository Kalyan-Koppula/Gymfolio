-- ThemePreference (architecture §2 / §5) — D1 source of truth for cross-device sync.
CREATE TABLE `theme_preferences` (
	`user_id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`theme_id` text DEFAULT 'zinc' NOT NULL,
	`mode` text DEFAULT 'system' NOT NULL,
	`radius` real DEFAULT 0.625 NOT NULL,
	`font_pairing` text DEFAULT 'sans' NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);

-- WorkoutLog.status already existed as TEXT; values now include 'skipped' in addition to
-- 'in_progress' | 'completed'. No column migration required (SQLite TEXT is unconstrained).
-- RoutineDay.day_type / order_index / archivedAt live in routines.days_json (JSON blob), not a
-- separate table — applied via shared RoutineDaySchema.
