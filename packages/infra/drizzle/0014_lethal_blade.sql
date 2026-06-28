CREATE TABLE `run_events` (
	`id` text PRIMARY KEY NOT NULL,
	`run_ref` text NOT NULL,
	`workflow` text NOT NULL,
	`event_type` text NOT NULL,
	`metadata` text DEFAULT '{}' NOT NULL,
	`seq` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `run_events_run_ref_idx` ON `run_events` (`run_ref`);--> statement-breakpoint
CREATE INDEX `run_events_run_ref_seq_idx` ON `run_events` (`run_ref`,`seq`);