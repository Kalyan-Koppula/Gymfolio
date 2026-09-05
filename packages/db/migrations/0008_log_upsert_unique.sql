-- One body-metric / sleep row per tenant+user+date (upsert). Deduplicate before unique indexes.
-- Macros already unique on user+date; extend to tenant+user+date for consistency.

DELETE FROM `body_metric_entries`
WHERE `rowid` NOT IN (
	SELECT MAX(`rowid`) FROM `body_metric_entries` GROUP BY `tenant_id`, `user_id`, `date`
);
--> statement-breakpoint
CREATE UNIQUE INDEX `body_metric_entries_tenant_user_date_idx` ON `body_metric_entries` (`tenant_id`,`user_id`,`date`);
--> statement-breakpoint
DELETE FROM `sleep_entries`
WHERE `rowid` NOT IN (
	SELECT MAX(`rowid`) FROM `sleep_entries` GROUP BY `tenant_id`, `user_id`, `date`
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sleep_entries_tenant_user_date_idx` ON `sleep_entries` (`tenant_id`,`user_id`,`date`);
--> statement-breakpoint
DROP INDEX IF EXISTS `macro_entries_user_date_idx`;
--> statement-breakpoint
CREATE UNIQUE INDEX `macro_entries_tenant_user_date_idx` ON `macro_entries` (`tenant_id`,`user_id`,`date`);
