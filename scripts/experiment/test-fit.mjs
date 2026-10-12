import assert from 'node:assert/strict';
import { assessAvailableWindow, validAvailableWindow, koreaDate } from '../../lib/experiment-fit.ts';

const w = { day: 2, start: 13 * 60, end: 17 * 60 };
const now = new Date('2026-10-12T01:00:00Z');
const event = { date: '2026-10-14', start: 14 * 60, end: 16 * 60, deadline: null, activityMode: 'single' };

assert.equal(validAvailableWindow(w), true);
assert.equal(validAvailableWindow({ day: 2, start: 780, end: 800 }), false);
assert.equal(validAvailableWindow({ day: 7, start: 780, end: 900 }), false);
assert.equal(koreaDate(new Date('2026-10-12T15:30:00Z')), '2026-10-13');
assert.equal(assessAvailableWindow(event, w, now), 'time_match');
assert.equal(assessAvailableWindow({ ...event, activityMode: 'series' }, w, now), 'schedule_unknown');
assert.equal(assessAvailableWindow({ ...event, activityMode: 'flexible' }, w, now), 'schedule_unknown');
assert.equal(assessAvailableWindow({ ...event, activityMode: 'unknown' }, w, now), 'schedule_unknown');
assert.equal(assessAvailableWindow({ ...event, activityMode: 'flexible', activityEndDate: '2026-10-11' }, w, now), 'closed');
assert.equal(assessAvailableWindow({ ...event, activityMode: 'series', activityEndDate: '2026-10-12' }, w, now), 'schedule_unknown');
assert.equal(assessAvailableWindow({ ...event, start: 12 * 60 + 50 }, w, now), 'different_time');
assert.equal(assessAvailableWindow({ ...event, start: 13 * 60 + 5 }, w, now), 'different_time');
assert.equal(assessAvailableWindow({ ...event, end: 16 * 60 + 55 }, w, now), 'different_time');
assert.equal(assessAvailableWindow({ ...event, date: null }, w, now), 'schedule_unknown');
assert.equal(assessAvailableWindow({ ...event, date: '2026-10-15' }, w, now), 'different_time');
assert.equal(assessAvailableWindow({ ...event, deadline: '2026-10-11' }, w, now), 'closed');
assert.equal(assessAvailableWindow({ ...event, deadline: '2026-10-12' }, w, now), 'schedule_unknown');
assert.equal(assessAvailableWindow(event, w, new Date('2026-10-14T08:00:00Z')), 'closed');
console.log('Experiment availability checks passed.');
