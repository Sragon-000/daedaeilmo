import { sqliteTable, text, integer, uniqueIndex, index } from 'drizzle-orm/sqlite-core';
export const members = sqliteTable('members', {
  id: text('id').primaryKey(), school: text('school').notNull(), subject: text('subject').notNull(),
  photoKey: text('photo_key'),
  name: text('name').notNull().default(''), nickname: text('nickname').notNull(), avatar: text('avatar').notNull(),
  createdAt: integer('created_at').notNull(), updatedAt: integer('updated_at').notNull(),
}, table => [uniqueIndex('members_school_subject_unique').on(table.school, table.subject), uniqueIndex('members_nickname_unique').on(table.nickname)]);
export const reviews = sqliteTable('member_reviews', {
  id: text('id').primaryKey(), memberId: text('member_id').notNull().references(() => members.id, { onDelete: 'cascade' }),
  school: text('school').notNull(), place: integer('place').notNull(), score: integer('score').notNull(),
  body: text('body').notNull(), displayMode: text('display_mode').notNull().default('nickname'),
  createdAt: integer('created_at').notNull(), updatedAt: integer('updated_at').notNull(),
}, table => [uniqueIndex('member_reviews_member_place_unique').on(table.memberId, table.place)]);

export const courses = sqliteTable('member_courses', {
  id: text('id').primaryKey(), memberId: text('member_id').notNull().references(() => members.id, { onDelete: 'cascade' }),
  year: integer('year').notNull(), semester: integer('semester').notNull(),
  name: text('name').notNull(), day: integer('day').notNull(), start: integer('start').notNull(), end: integer('end').notNull(),
}, table => [index('member_courses_semester_idx').on(table.memberId, table.year, table.semester)]);

export const posterOcr = sqliteTable('poster_ocr', { hash:text('hash').primaryKey(), payload:text('payload').notNull(), createdAt:integer('created_at').notNull() });

export const loginEvents = sqliteTable('school_login_events', { id:text('id').primaryKey(), school:text('school').notNull(), subject:text('subject').notNull(), loggedAt:integer('logged_at').notNull(), expiresAt:integer('expires_at').notNull(), loggedOutAt:integer('logged_out_at') }, table=>[index('school_login_events_time_idx').on(table.loggedAt)]);

export const campusEvents = sqliteTable('campus_events', {
  id: text('id').primaryKey(), school: text('school').notNull(), sourceBoard: text('source_board').notNull(),
  url: text('url').notNull(), title: text('title').notNull(), payload: text('payload').notNull(),
  sourceHash: text('source_hash').notNull(), firstSeenAt: integer('first_seen_at').notNull(),
  lastSeenAt: integer('last_seen_at').notNull(), reviewStatus: text('review_status').notNull().default('unreviewed'),
  reviewedAt: integer('reviewed_at'), overrideJson: text('override_json'),
}, table => [index('campus_events_last_seen_idx').on(table.lastSeenAt)]);

export const eventSaves = sqliteTable('member_event_saves', {
  memberId: text('member_id').notNull().references(() => members.id, { onDelete: 'cascade' }),
  eventId: text('event_id').notNull().references(() => campusEvents.id, { onDelete: 'cascade' }),
  savedAt: integer('saved_at').notNull(),
}, table => [uniqueIndex('member_event_saves_unique').on(table.memberId, table.eventId), index('member_event_saves_event_idx').on(table.eventId)]);

export const eventOpens = sqliteTable('member_event_opens', {
  id: text('id').primaryKey(), memberId: text('member_id').notNull().references(() => members.id, { onDelete: 'cascade' }),
  eventId: text('event_id').notNull().references(() => campusEvents.id, { onDelete: 'cascade' }),
  openedAt: integer('opened_at').notNull(),
}, table => [index('member_event_opens_time_idx').on(table.openedAt)]);
