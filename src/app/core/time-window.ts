import type { CfSubmission, MonthBounds, TimeWindow } from './models';

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export interface WindowPreset {
  id: string;
  label: string;
  months: number | null;
}

export const WINDOW_PRESETS: WindowPreset[] = [
  { id: '3m', label: 'Last 3 months', months: 3 },
  { id: '6m', label: 'Last 6 months', months: 6 },
  { id: '1y', label: 'Last year', months: 12 },
  { id: '2y', label: 'Last 2 years', months: 24 },
  { id: 'all', label: 'All time', months: null },
];

/** UTC month key for a unix timestamp in seconds. */
export function monthOfSeconds(ts: number): string {
  const date = new Date(ts * 1000);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** UTC month key for the current moment. */
export function currentMonth(nowMs = Date.now()): string {
  return monthOfSeconds(Math.floor(nowMs / 1000));
}

export function monthIndex(month: string): number {
  const [year, value] = month.split('-');
  return Number(year) * 12 + Number(value) - 1;
}

export function monthFromIndex(index: number): string {
  const year = Math.floor(index / 12);
  const value = (index % 12) + 1;
  return `${year}-${String(value).padStart(2, '0')}`;
}

export function addMonths(month: string, delta: number): string {
  return monthFromIndex(monthIndex(month) + delta);
}

export function compareMonths(a: string, b: string): number {
  return monthIndex(a) - monthIndex(b);
}

export function monthsInclusive(start: string, end: string): number {
  return Math.max(1, monthIndex(end) - monthIndex(start) + 1);
}

export function monthRange(start: string, end: string): string[] {
  const first = monthIndex(start);
  const last = monthIndex(end);
  const months: string[] = [];
  for (let index = first; index <= last; index++) months.push(monthFromIndex(index));
  return months;
}

export function monthStartSeconds(month: string): number {
  const [year, value] = month.split('-').map(Number);
  return Date.UTC(year, value - 1, 1) / 1000;
}

/** Last second of the month. */
export function monthEndSeconds(month: string): number {
  return monthStartSeconds(addMonths(month, 1)) - 1;
}

export function windowSeconds(window: TimeWindow): { start: number; end: number } {
  return {
    start: monthStartSeconds(window.start),
    end: monthEndSeconds(window.end),
  };
}

export function clampWindow(window: TimeWindow, bounds: MonthBounds): TimeWindow {
  const min = monthIndex(bounds.min);
  const max = monthIndex(bounds.max);
  let start = Math.min(max, Math.max(min, monthIndex(window.start)));
  let end = Math.min(max, Math.max(min, monthIndex(window.end)));
  if (start > end) start = end;
  return { start: monthFromIndex(start), end: monthFromIndex(end) };
}

export function allTimeWindow(bounds: MonthBounds): TimeWindow {
  return { start: bounds.min, end: bounds.max };
}

export function isAllTime(window: TimeWindow, bounds: MonthBounds): boolean {
  return window.start === bounds.min && window.end === bounds.max;
}

/**
 * The requested default: start six months back, end two months back.
 * For October 2026 this is April 2026 → August 2026.
 */
export function defaultWindow(bounds: MonthBounds, referenceMonth: string): TimeWindow {
  return clampWindow(
    { start: addMonths(referenceMonth, -6), end: addMonths(referenceMonth, -2) },
    bounds,
  );
}

export function presetWindow(
  bounds: MonthBounds,
  months: number | null,
  referenceMonth: string,
): TimeWindow {
  if (months == null) return allTimeWindow(bounds);
  const end = clampWindow({ start: referenceMonth, end: referenceMonth }, bounds).start;
  return clampWindow({ start: addMonths(end, -(months - 1)), end }, bounds);
}

/** Months that contain at least one submission, plus the current month as the upper bound. */
export function monthBounds(submissions: CfSubmission[], nowMs = Date.now()): MonthBounds {
  const max = currentMonth(nowMs);
  if (!submissions.length) return { min: max, max };
  let min = max;
  for (const submission of submissions) {
    const month = monthOfSeconds(submission.creationTimeSeconds);
    if (compareMonths(month, min) < 0) min = month;
  }
  return { min: compareMonths(min, max) > 0 ? max : min, max };
}

export function hasSubmissionsInWindow(submissions: CfSubmission[], window: TimeWindow): boolean {
  const { start, end } = windowSeconds(window);
  return submissions.some(
    (submission) =>
      submission.creationTimeSeconds >= start && submission.creationTimeSeconds <= end,
  );
}

export function formatMonthLong(month: string): string {
  const [year, value] = month.split('-').map(Number);
  return `${MONTH_NAMES[value - 1]} ${year}`;
}

export function formatWindowLabel(window: TimeWindow): string {
  if (window.start === window.end) return formatMonthLong(window.start);
  return `${formatMonthLong(window.start)} – ${formatMonthLong(window.end)}`;
}

export function monthAge(month: string, referenceMonth: string): number {
  return monthIndex(referenceMonth) - monthIndex(month);
}

export function monthAgeLabel(month: string, referenceMonth: string): string {
  const age = monthAge(month, referenceMonth);
  if (age <= 0) return 'this month';
  if (age === 1) return '1 month ago';
  return `${age} months ago`;
}

export function monthCountLabel(count: number): string {
  return count === 1 ? '1 month' : `${count} months`;
}
