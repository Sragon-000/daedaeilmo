CREATE TABLE `campus_events` (
	`id` text PRIMARY KEY NOT NULL,
	`school` text NOT NULL,
	`source_board` text NOT NULL,
	`url` text NOT NULL,
	`title` text NOT NULL,
	`payload` text NOT NULL,
	`source_hash` text NOT NULL,
	`first_seen_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL,
	`review_status` text DEFAULT 'unreviewed' NOT NULL,
	`reviewed_at` integer,
	`override_json` text
);
--> statement-breakpoint
CREATE INDEX `campus_events_last_seen_idx` ON `campus_events` (`last_seen_at`);--> statement-breakpoint
CREATE TABLE `member_event_opens` (
	`id` text PRIMARY KEY NOT NULL,
	`member_id` text NOT NULL,
	`event_id` text NOT NULL,
	`opened_at` integer NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`event_id`) REFERENCES `campus_events`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `member_event_opens_time_idx` ON `member_event_opens` (`opened_at`);--> statement-breakpoint
CREATE TABLE `member_event_saves` (
	`member_id` text NOT NULL,
	`event_id` text NOT NULL,
	`saved_at` integer NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`event_id`) REFERENCES `campus_events`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `member_event_saves_unique` ON `member_event_saves` (`member_id`,`event_id`);--> statement-breakpoint
CREATE INDEX `member_event_saves_event_idx` ON `member_event_saves` (`event_id`);