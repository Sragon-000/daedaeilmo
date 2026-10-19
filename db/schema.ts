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

export const experimentInvites = sqliteTable('experiment_invites', {
  id: text('id').primaryKey(), participantCode: text('participant_code').notNull(),
  tokenHash: text('token_hash').notNull(), sessionVersion: integer('session_version').notNull().default(1),
  createdAt: integer('created_at').notNull(), expiresAt: integer('expires_at').notNull(),
  revokedAt: integer('revoked_at'), consentedAt: integer('consented_at'),
  availableDay: integer('available_day'), availableStart: integer('available_start'),
  availableEnd: integer('available_end'), availabilityUpdatedAt: integer('availability_updated_at'),
}, table => [
  uniqueIndex('experiment_invites_code_unique').on(table.participantCode),
  uniqueIndex('experiment_invites_token_unique').on(table.tokenHash),
]);

export const experimentActions = sqliteTable('experiment_actions', {
  id: text('id').primaryKey(), inviteId: text('invite_id').notNull().references(() => experimentInvites.id, { onDelete: 'cascade' }),
  action: text('action').notNull(), eventId: text('event_id'), fitAtAction: text('fit_at_action'),
  sourceHashAtAction: text('source_hash_at_action'), createdAt: integer('created_at').notNull(),
}, table => [index('experiment_actions_invite_time_idx').on(table.inviteId, table.action, table.createdAt)]);

export const institutionPrograms = sqliteTable('institution_programs', {
  id: text('id').primaryKey(), institutionId: text('institution_id').notNull(), school: text('school').notNull(),
  sourceEventId: text('source_event_id').references(() => campusEvents.id), title: text('title').notNull(),
  description: text('description').notNull(), eligibility: text('eligibility').notNull(), place: text('place').notNull(),
  eventDate: text('event_date'), startMinute: integer('start_minute'), endMinute: integer('end_minute'),
  capacity: integer('capacity').notNull(), absenceConfirmed: integer('absence_confirmed').notNull().default(0),
  absenceEvidence: text('absence_evidence').notNull().default(''), status: text('status').notNull().default('draft'),
  responseHours: integer('response_hours').notNull().default(48),
  createdAt: integer('created_at').notNull(), updatedAt: integer('updated_at').notNull(),
}, table => [index('institution_programs_school_status_idx').on(table.school, table.status), index('institution_programs_owner_idx').on(table.institutionId), uniqueIndex('institution_programs_source_unique').on(table.institutionId, table.sourceEventId)]);

export const programApplications = sqliteTable('program_applications', {
  id: text('id').primaryKey(), programId: text('program_id').notNull().references(() => institutionPrograms.id),
  memberId: text('member_id').notNull().references(() => members.id), status: text('status').notNull(),
  createdAt: integer('created_at').notNull(), updatedAt: integer('updated_at').notNull(), acknowledgedAt: integer('acknowledged_at'),
  responseDueAt: integer('response_due_at'),
}, table => [uniqueIndex('program_applications_member_program_unique').on(table.memberId, table.programId), index('program_applications_program_status_idx').on(table.programId, table.status)]);

export const institutionStaff = sqliteTable('institution_staff', {
  id: text('id').primaryKey(), institutionId: text('institution_id').notNull(),
  label: text('label').notNull(), role: text('role').notNull(), keyHash: text('key_hash').notNull(),
  sessionVersion: integer('session_version').notNull().default(1), revokedAt: integer('revoked_at'),
  createdAt: integer('created_at').notNull(), lastLoginAt: integer('last_login_at'),
}, table => [uniqueIndex('institution_staff_key_unique').on(table.keyHash), index('institution_staff_owner_idx').on(table.institutionId, table.revokedAt)]);

export const applicationContacts = sqliteTable('application_contacts', {
  id: text('id').primaryKey(), applicationId: text('application_id').notNull().references(() => programApplications.id),
  staffId: text('staff_id'), channel: text('channel').notNull(), note: text('note').notNull(), createdAt: integer('created_at').notNull(),
}, table => [index('application_contacts_application_time_idx').on(table.applicationId, table.createdAt)]);

export const programAudit = sqliteTable('program_audit', {
  id: text('id').primaryKey(), programId: text('program_id').notNull(), applicationId: text('application_id'),
  actor: text('actor').notNull(), action: text('action').notNull(), createdAt: integer('created_at').notNull(),
}, table => [index('program_audit_program_time_idx').on(table.programId, table.createdAt)]);
