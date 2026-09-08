ALTER TABLE `sessions` ADD `device_key` text;
ALTER TABLE `sessions` ADD `last_active_at` integer;
CREATE UNIQUE INDEX IF NOT EXISTS `sessions_user_device_uidx` ON `sessions` (`user_id`,`device_key`);
