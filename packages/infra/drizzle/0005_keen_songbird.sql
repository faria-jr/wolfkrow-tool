CREATE TABLE `provider_configs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`display_name` text NOT NULL,
	`protocol` text NOT NULL,
	`base_url` text NOT NULL,
	`api_key_account` text NOT NULL,
	`models` text NOT NULL,
	`supports_tools` integer DEFAULT false NOT NULL,
	`pricing_url` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `provider_configs_user_idx` ON `provider_configs` (`user_id`);--> statement-breakpoint
CREATE INDEX `provider_configs_user_provider_idx` ON `provider_configs` (`user_id`,`provider_id`);