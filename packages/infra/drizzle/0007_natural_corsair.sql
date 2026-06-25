CREATE TABLE `tool_permissions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`agent_id` text NOT NULL,
	`tool` text NOT NULL,
	`decision` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tool_permissions_user_agent_tool_idx` ON `tool_permissions` (`user_id`,`agent_id`,`tool`);--> statement-breakpoint
CREATE INDEX `tool_permissions_user_id_idx` ON `tool_permissions` (`user_id`);