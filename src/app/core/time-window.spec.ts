import type { CfSubmission } from './models';
import {
  addMonths,
  defaultWindow,
  formatWindowLabel,
  hasSubmissionsInWindow,
  monthAgeLabel,
  monthBounds,
  monthOfSeconds,
  monthRange,
  monthsInclusive,
  presetWindow,
  windowSeconds,
} from './time-window';

function submission(time: number): CfSubmission {
  return {
    id: time,
    creationTimeSeconds: time,
    relativeTimeSeconds: 0,
    problem: {
      contestId: 1,
      index: 'A',
      name: 'A',
      type: 'PROGRAMMING',
      tags: [],
    },
    author: { members: [{ handle: 'tester' }], participantType: 'PRACTICE' },
    programmingLanguage: 'C++20',
    verdict: 'OK',
    passedTestCount: 0,
    timeConsumedMillis: 0,
    memoryConsumedBytes: 0,
  };
}

describe('time windows', () => {
  it('uses UTC month keys', () => {
    expect(monthOfSeconds(Date.UTC(2026, 9, 22) / 1000)).toBe('2026-10');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(addMonths('2026-12', 1)).toBe('2027-01');
  });

  it('builds the requested default: six months back to two months back', () => {
    const range = defaultWindow({ min: '2024-01', max: '2026-10' }, '2026-10');
    expect(range).toEqual({ start: '2026-04', end: '2026-08' });
    expect(monthsInclusive(range.start, range.end)).toBe(5);
  });

  it('clamps a default window into the available bounds', () => {
    const range = defaultWindow({ min: '2026-09', max: '2026-10' }, '2026-10');
    expect(range).toEqual({ start: '2026-09', end: '2026-09' });
  });

  it('builds inclusive presets ending in the current month', () => {
    expect(presetWindow({ min: '2024-01', max: '2026-10' }, 3, '2026-10')).toEqual({
      start: '2026-08',
      end: '2026-10',
    });
    expect(presetWindow({ min: '2024-01', max: '2026-10' }, 12, '2026-10')).toEqual({
      start: '2025-11',
      end: '2026-10',
    });
  });

  it('expands month ranges and checks submissions inside a window', () => {
    expect(monthRange('2026-01', '2026-03')).toEqual(['2026-01', '2026-02', '2026-03']);
    const window = { start: '2026-02', end: '2026-02' };
    expect(windowSeconds(window)).toEqual({
      start: Date.UTC(2026, 1, 1) / 1000,
      end: Date.UTC(2026, 2, 1) / 1000 - 1,
    });
    expect(hasSubmissionsInWindow([submission(ts(2026, 2))], window)).toBe(true);
    expect(hasSubmissionsInWindow([submission(ts(2026, 3))], window)).toBe(false);
  });

  it('describes how many months ago an endpoint is', () => {
    expect(monthAgeLabel('2026-04', '2026-10')).toBe('6 months ago');
    expect(monthAgeLabel('2026-08', '2026-10')).toBe('2 months ago');
    expect(monthAgeLabel('2026-10', '2026-10')).toBe('this month');
  });

  it('formats single-month and multi-month labels', () => {
    expect(formatWindowLabel({ start: '2026-06', end: '2026-06' })).toBe('Jun 2026');
    expect(formatWindowLabel({ start: '2026-04', end: '2026-08' })).toBe('Apr 2026 – Aug 2026');
  });

  it('uses the current month as the upper bound even for inactive accounts', () => {
    const bounds = monthBounds([submission(ts(2025, 1))], Date.UTC(2026, 9, 22));
    expect(bounds).toEqual({ min: '2025-01', max: '2026-10' });
  });
});

function ts(year: number, month: number): number {
  return Date.UTC(year, month - 1, 15) / 1000;
}
