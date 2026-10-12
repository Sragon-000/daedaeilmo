import type { CampusEvent } from './campus-events';

export type AvailableWindow = { day: number; start: number; end: number };
export type ExperimentFit = 'time_match' | 'different_time' | 'schedule_unknown' | 'closed';
export const FIT_RULE_VERSION = 2;

export function validAvailableWindow(value: unknown): value is AvailableWindow {
  if (!value || typeof value !== 'object') return false;
  const { day, start, end } = value as Record<string, unknown>;
  return Number.isInteger(day) && Number.isInteger(start) && Number.isInteger(end)
    && (day as number) >= 0 && (day as number) <= 6
    && (start as number) >= 480 && (end as number) <= 1320
    && (end as number) - (start as number) >= 30
    && (end as number) - (start as number) <= 480;
}

export function koreaDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const part = (name: string) => parts.find(item => item.type === name)?.value || '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function validDate(value: string): boolean {
  if (!/^20\d{2}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

export function assessAvailableWindow(
  event: Pick<CampusEvent, 'date' | 'start' | 'end' | 'deadline' | 'activityMode' | 'activityEndDate'>,
  window: AvailableWindow,
  now = new Date(),
): ExperimentFit {
  if (!validAvailableWindow(window)) return 'schedule_unknown';
  const today = koreaDate(now);
  if (event.deadline && !validDate(event.deadline)) return 'schedule_unknown';
  if (event.activityEndDate && !validDate(event.activityEndDate)) return 'schedule_unknown';
  if (event.deadline && event.deadline < today) return 'closed';
  if (event.activityEndDate && event.activityEndDate < today) return 'closed';
  if (event.deadline === today) return 'schedule_unknown';
  // A verified single-session classification is required before a notice can count as a time match.
  if (event.activityMode !== 'single') return 'schedule_unknown';
  if (!event.date || !validDate(event.date) || event.start === null || event.end === null
      || !Number.isInteger(event.start) || !Number.isInteger(event.end)
      || event.start < 0 || event.end > 1440 || event.end <= event.start) return 'schedule_unknown';
  const midnight = Date.parse(`${event.date}T00:00:00+09:00`);
  const starts = midnight + event.start * 60000;
  const ends = midnight + event.end * 60000;
  if (ends <= now.getTime()) return 'closed';
  if (starts <= now.getTime()) return 'schedule_unknown';
  const day = (new Date(`${event.date}T12:00:00+09:00`).getUTCDay() + 6) % 7;
  if (day !== window.day) return 'different_time';
  return event.start >= window.start + 10 && event.end <= window.end - 10
    ? 'time_match' : 'different_time';
}
