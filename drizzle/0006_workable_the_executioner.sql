CREATE TABLE `experiment_actions` (
	`id` text PRIMARY KEY NOT NULL,
	`invite_id` text NOT NULL,
	`action` text NOT NULL,
	`event_id` text,
	`fit_at_action` text,
	`source_hash_at_action` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`invite_id`) REFERENCES `experiment_invites`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `experiment_actions_invite_time_idx` ON `experiment_actions` (`invite_id`,`action`,`created_at`);--> statement-breakpoint
CREATE TABLE `experiment_invites` (
	`id` text PRIMARY KEY NOT NULL,
	`participant_code` text NOT NULL,
	`token_hash` text NOT NULL,
	`session_version` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`revoked_at` integer,
	`consented_at` integer,
	`available_day` integer,
	`available_start` integer,
	`available_end` integer,
	`availability_updated_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `experiment_invites_code_unique` ON `experiment_invites` (`participant_code`);--> statement-breakpoint
CREATE UNIQUE INDEX `experiment_invites_token_unique` ON `experiment_invites` (`token_hash`);