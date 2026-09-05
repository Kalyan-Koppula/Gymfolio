-- Persist model_slug on AIProviderConfig (architecture §2 / §7). Default openrouter/free.
ALTER TABLE `ai_provider_configs` ADD COLUMN `model_slug` text DEFAULT 'openrouter/free' NOT NULL;
