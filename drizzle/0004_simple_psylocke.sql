CREATE TABLE `school_login_events` (
	`id` text PRIMARY KEY NOT NULL,
	`school` text NOT NULL,
	`subject` text NOT NULL,
	`logged_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`logged_out_at` integer
);
--> statement-breakpoint
CREATE INDEX `school_login_events_time_idx` ON `school_login_events` (`logged_at`);