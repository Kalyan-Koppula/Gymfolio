CREATE TABLE `ai_provider_configs` (
	`tenant_id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`encrypted_api_key` text NOT NULL,
	`iv` text NOT NULL,
	`endpoint_override` text,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `exercises` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`muscle_groups_json` text NOT NULL,
	`equipment_json` text NOT NULL,
	`difficulty` text NOT NULL,
	`instructions` text NOT NULL,
	`has_gif` integer DEFAULT 0 NOT NULL,
	`gif_r2_key` text,
	`youtube_status` text DEFAULT 'not_fetched' NOT NULL,
	`youtube_json` text
);
--> statement-breakpoint
CREATE TABLE `workout_log_sets` (
	`id` text PRIMARY KEY NOT NULL,
	`workout_log_id` text NOT NULL,
	`exercise_id` text NOT NULL,
	`set_index` integer NOT NULL,
	`actual_reps` integer NOT NULL,
	`actual_weight_kg` real NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`workout_log_id`) REFERENCES `workout_logs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `workout_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`user_id` text NOT NULL,
	`date` text NOT NULL,
	`day_label` text NOT NULL,
	`day_index` integer NOT NULL,
	`status` text DEFAULT 'in_progress' NOT NULL,
	`sets_planned` integer NOT NULL,
	`sets_completed` integer DEFAULT 0 NOT NULL,
	`started_at` integer NOT NULL,
	`completed_at` integer,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
