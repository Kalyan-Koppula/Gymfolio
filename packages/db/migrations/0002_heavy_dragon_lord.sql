CREATE TABLE `routines` (
	`user_id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`name` text NOT NULL,
	`split_type` text NOT NULL,
	`schedule_json` text NOT NULL,
	`days_json` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `user_settings` (
	`user_id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`hydration_goal_ml` integer DEFAULT 3000 NOT NULL,
	`macro_mode` text DEFAULT 'computed' NOT NULL,
	`bodyweight_kg` real,
	`macro_calories` integer DEFAULT 2400 NOT NULL,
	`macro_protein` integer DEFAULT 180 NOT NULL,
	`macro_carbs` integer DEFAULT 240 NOT NULL,
	`macro_fat` integer DEFAULT 70 NOT NULL,
	`equipment_json` text DEFAULT '[]' NOT NULL,
	`onboarding_completed_at` integer,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
