CREATE TABLE `application_contacts` (
	`id` text PRIMARY KEY NOT NULL,
	`application_id` text NOT NULL,
	`staff_id` text,
	`channel` text NOT NULL,
	`note` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`application_id`) REFERENCES `program_applications`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `application_contacts_application_time_idx` ON `application_contacts` (`application_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `institution_staff` (
	`id` text PRIMARY KEY NOT NULL,
	`institution_id` text NOT NULL,
	`label` text NOT NULL,
	`role` text NOT NULL,
	`key_hash` text NOT NULL,
	`session_version` integer DEFAULT 1 NOT NULL,
	`revoked_at` integer,
	`created_at` integer NOT NULL,
	`last_login_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `institution_staff_key_unique` ON `institution_staff` (`key_hash`);--> statement-breakpoint
CREATE INDEX `institution_staff_owner_idx` ON `institution_staff` (`institution_id`,`revoked_at`);--> statement-breakpoint
ALTER TABLE `institution_programs` ADD `response_hours` integer DEFAULT 48 NOT NULL;--> statement-breakpoint
ALTER TABLE `program_applications` ADD `response_due_at` integer;