-- Hot-path indexes: workouts, sets, hydration (SQLite does not index FKs automatically).
CREATE INDEX IF NOT EXISTS `workout_logs_user_tenant_date_idx`
  ON `workout_logs` (`user_id`, `tenant_id`, `date`);
CREATE INDEX IF NOT EXISTS `workout_logs_user_tenant_status_idx`
  ON `workout_logs` (`user_id`, `tenant_id`, `status`);
CREATE INDEX IF NOT EXISTS `workout_log_sets_log_id_idx`
  ON `workout_log_sets` (`workout_log_id`);
CREATE INDEX IF NOT EXISTS `workout_log_sets_exercise_id_idx`
  ON `workout_log_sets` (`exercise_id`);
CREATE INDEX IF NOT EXISTS `hydration_entries_tenant_user_date_idx`
  ON `hydration_entries` (`tenant_id`, `user_id`, `date`);
CREATE INDEX IF NOT EXISTS `credentials_user_id_idx`
  ON `credentials` (`user_id`);
CREATE INDEX IF NOT EXISTS `users_tenant_id_idx`
  ON `users` (`tenant_id`);
