CREATE TABLE `security_findings` (
	`id` text PRIMARY KEY NOT NULL,
	`scan_id` text NOT NULL,
	`severity` text NOT NULL,
	`dimension` text NOT NULL,
	`file` text NOT NULL,
	`line` integer,
	`message` text NOT NULL,
	`rule` text,
	`agent_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`scan_id`) REFERENCES `security_scans`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `security_findings_scan_idx` ON `security_findings` (`scan_id`);--> statement-breakpoint
CREATE INDEX `security_findings_severity_idx` ON `security_findings` (`severity`);--> statement-breakpoint
CREATE TABLE `security_scans` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`project_path` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`metadata` text DEFAULT '{}' NOT NULL,
	`started_at` integer NOT NULL,
	`completed_at` integer,
	`error` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `security_scans_user_idx` ON `security_scans` (`user_id`);--> statement-breakpoint
CREATE INDEX `security_scans_status_idx` ON `security_scans` (`status`);