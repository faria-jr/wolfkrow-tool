PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_chat_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`agent_id` text,
	`title` text NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`metadata` text DEFAULT '{}' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`last_activity` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_chat_sessions`("id", "user_id", "agent_id", "title", "archived", "metadata", "created_at", "updated_at", "last_activity") SELECT "id", "user_id", "agent_id", "title", "archived", "metadata", "created_at", "updated_at", "last_activity" FROM `chat_sessions`;--> statement-breakpoint
DROP TABLE `chat_sessions`;--> statement-breakpoint
ALTER TABLE `__new_chat_sessions` RENAME TO `chat_sessions`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `chat_sessions_user_id_idx` ON `chat_sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `chat_sessions_last_activity_idx` ON `chat_sessions` (`last_activity`);--> statement-breakpoint
CREATE INDEX `chat_sessions_archived_idx` ON `chat_sessions` (`archived`);