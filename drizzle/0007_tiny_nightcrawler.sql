CREATE TABLE `institution_programs` (
	`id` text PRIMARY KEY NOT NULL,
	`institution_id` text NOT NULL,
	`school` text NOT NULL,
	`source_event_id` text,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`eligibility` text NOT NULL,
	`place` text NOT NULL,
	`event_date` text,
	`start_minute` integer,
	`end_minute` integer,
	`capacity` integer NOT NULL,
	`absence_confirmed` integer DEFAULT 0 NOT NULL,
	`absence_evidence` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`source_event_id`) REFERENCES `campus_events`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `institution_programs_school_status_idx` ON `institution_programs` (`school`,`status`);--> statement-breakpoint
CREATE INDEX `institution_programs_owner_idx` ON `institution_programs` (`institution_id`);--> statement-breakpoint
CREATE TABLE `program_applications` (
	`id` text PRIMARY KEY NOT NULL,
	`program_id` text NOT NULL,
	`member_id` text NOT NULL,
	`status` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`acknowledged_at` integer,
	FOREIGN KEY (`program_id`) REFERENCES `institution_programs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `program_applications_member_program_unique` ON `program_applications` (`member_id`,`program_id`);--> statement-breakpoint
CREATE INDEX `program_applications_program_status_idx` ON `program_applications` (`program_id`,`status`);--> statement-breakpoint
CREATE TABLE `program_audit` (
	`id` text PRIMARY KEY NOT NULL,
	`program_id` text NOT NULL,
	`application_id` text,
	`actor` text NOT NULL,
	`action` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `program_audit_program_time_idx` ON `program_audit` (`program_id`,`created_at`);