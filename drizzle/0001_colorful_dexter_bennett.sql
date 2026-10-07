CREATE TABLE `member_courses` (
	`id` text PRIMARY KEY NOT NULL,
	`member_id` text NOT NULL,
	`year` integer NOT NULL,
	`semester` integer NOT NULL,
	`name` text NOT NULL,
	`day` integer NOT NULL,
	`start` integer NOT NULL,
	`end` integer NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `member_courses_semester_idx` ON `member_courses` (`member_id`,`year`,`semester`);