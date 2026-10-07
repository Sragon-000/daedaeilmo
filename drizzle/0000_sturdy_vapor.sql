CREATE TABLE `members` (
	`id` text PRIMARY KEY NOT NULL,
	`school` text NOT NULL,
	`subject` text NOT NULL,
	`name` text DEFAULT '' NOT NULL,
	`nickname` text NOT NULL,
	`avatar` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `members_school_subject_unique` ON `members` (`school`,`subject`);--> statement-breakpoint
CREATE UNIQUE INDEX `members_nickname_unique` ON `members` (`nickname`);--> statement-breakpoint
CREATE TABLE `member_reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`member_id` text NOT NULL,
	`school` text NOT NULL,
	`place` integer NOT NULL,
	`score` integer NOT NULL,
	`body` text NOT NULL,
	`display_mode` text DEFAULT 'nickname' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `member_reviews_member_place_unique` ON `member_reviews` (`member_id`,`place`);