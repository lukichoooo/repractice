import { analyze, sortProblems, tierFor } from './analysis';
import type { CfSubmission, Dataset } from './models';

const USER = {
  handle: 'tester',
  rating: 1600,
  maxRating: 1800,
  lastOnlineTimeSeconds: 1_700_000_000,
  registrationTimeSeconds: 1_500_000_000,
  friendOfCount: 0,
};

let nextId = 1;

function ts(year: number, month: number, day = 15): number {
  return Date.UTC(year, month - 1, day) / 1000;
}

function submission(
  contestId: number,
  index: string,
  verdict: string | undefined,
  time: number,
  participantType = 'PRACTICE',
): CfSubmission {
  return {
    id: nextId++,
    contestId,
    creationTimeSeconds: time,
    relativeTimeSeconds: 0,
    problem: {
      contestId,
      index,
      name: `Problem ${contestId}${index}`,
      type: 'PROGRAMMING',
      rating: 1500,
      tags: ['dp'],
    },
    author: {
      members: [{ handle: USER.handle }],
      participantType,
    },
    programmingLanguage: 'C++20',
    verdict,
    passedTestCount: 0,
    timeConsumedMillis: 100,
    memoryConsumedBytes: 1024,
  };
}

function dataset(submissions: CfSubmission[]): Dataset {
  return {
    handle: USER.handle,
    user: USER,
    submissions,
    ratingHistory: [],
    fetchedAt: Date.now(),
  };
}

describe('analyze', () => {
  it('counts every failure, including submissions after an AC', () => {
    const result = analyze(
      dataset([
        submission(1, 'A', 'WRONG_ANSWER', 100),
        submission(1, 'A', 'WRONG_ANSWER', 200),
        submission(1, 'A', 'OK', 300),
        submission(1, 'A', 'TIME_LIMIT_EXCEEDED', 400),
      ]),
      1000 * 1000,
    );

    const problem = result.problems[0];
    expect(problem.failures).toBe(3);
    expect(problem.latestFailures).toBe(3);
    expect(problem.latestFailure).toBe(400);
    expect(problem.acs).toBe(1);
    expect(problem.submissions).toBe(4);
    expect(problem.latestSubmissions).toBe(4);
    expect(problem.tier).toBe('maybe');
  });

  it('resets priority at the previous accepted solve', () => {
    const result = analyze(
      dataset([
        submission(20, 'A', 'WRONG_ANSWER', 100),
        submission(20, 'A', 'WRONG_ANSWER', 200),
        submission(20, 'A', 'OK', 300),
        submission(20, 'A', 'WRONG_ANSWER', 400),
        submission(20, 'A', 'OK', 500),
      ]),
      10_000_000,
    );

    const problem = result.problems[0];
    expect(problem.failures).toBe(3);
    expect(problem.latestFailures).toBe(1);
    expect(problem.latestSubmissions).toBe(2);
    expect(problem.latestEpisodeStart).toBe(300);
    expect(problem.latestFailure).toBe(400);
    expect(problem.tier).toBe('solid');
  });

  it('counts every failed try since the previous AC, even before the latest AC', () => {
    const rows: CfSubmission[] = [submission(21, 'B', 'OK', 100)];
    for (let index = 0; index < 20; index++) {
      rows.push(submission(21, 'B', 'WRONG_ANSWER', 200 + index));
    }
    rows.push(submission(21, 'B', 'WRONG_ANSWER', 1000));
    rows.push(submission(21, 'B', 'OK', 1100));

    const problem = analyze(dataset(rows), 10_000_000).problems[0];
    expect(problem.failures).toBe(21);
    expect(problem.latestFailures).toBe(21);
    expect(problem.tier).toBe('must');
  });

  it('ignores old failures after a clean re-solve', () => {
    const rows: CfSubmission[] = [];
    for (let index = 0; index < 20; index++) {
      rows.push(submission(22, 'C', 'WRONG_ANSWER', 100 + index));
    }
    rows.push(submission(22, 'C', 'OK', 1000));
    rows.push(submission(22, 'C', 'WRONG_ANSWER', 1100));
    rows.push(submission(22, 'C', 'OK', 1200));

    const problem = analyze(dataset(rows), 10_000_000).problems[0];
    expect(problem.failures).toBe(21);
    expect(problem.latestFailures).toBe(1);
    expect(problem.latestEpisodeStart).toBe(1000);
    expect(problem.tier).toBe('solid');
  });

  it('counts failures after the latest AC as part of the latest solve', () => {
    const problem = analyze(
      dataset([
        submission(23, 'D', 'OK', 100),
        submission(23, 'D', 'WRONG_ANSWER', 200),
        submission(23, 'D', 'WRONG_ANSWER', 300),
      ]),
      10_000_000,
    ).problems[0];

    expect(problem.failures).toBe(2);
    expect(problem.latestFailures).toBe(2);
    expect(problem.latestFailure).toBe(300);
    expect(problem.tier).toBe('maybe');
  });

  it('assigns the requested tier thresholds', () => {
    const rows: CfSubmission[] = [];
    let time = 100;
    for (let i = 0; i < 10; i++) rows.push(submission(2, 'B', 'WRONG_ANSWER', time++));
    rows.push(submission(2, 'B', 'OK', time++));

    const problem = analyze(dataset(rows), 10_000_000).problems[0];
    expect(problem.failures).toBe(10);
    expect(problem.tier).toBe('must');
  });

  it('assigns tiers from latest-solve failures and solved status', () => {
    expect(tierFor(3, true)).toBe('maybe');
    expect(tierFor(3, false)).toBe('unsolved');
    expect(tierFor(10, true)).toBe('must');
    expect(tierFor(1, false)).toBe('tried-once');
  });

  it('puts attempted but unsolved problems in their own tier', () => {
    const result = analyze(
      dataset([
        submission(3, 'C', 'WRONG_ANSWER', 100),
        submission(3, 'C', 'RUNTIME_ERROR', 200),
        submission(4, 'D', 'WRONG_ANSWER', 300),
      ]),
      10_000_000,
    );

    expect(result.problems.find((p) => p.index === 'C')?.tier).toBe('unsolved');
    expect(result.problems.find((p) => p.index === 'D')?.tier).toBe('tried-once');
    // Never solved includes both the 2+ failure bucket and one-try problems.
    expect(result.totals.neverSolved).toBe(2);
  });

  it('counts only submissions inside the selected window', () => {
    const result = analyze(
      dataset([
        submission(5, 'A', 'WRONG_ANSWER', ts(2026, 1)),
        submission(5, 'A', 'WRONG_ANSWER', ts(2026, 2)),
        submission(5, 'A', 'OK', ts(2026, 3)),
        submission(6, 'B', 'WRONG_ANSWER', ts(2026, 1)),
        submission(6, 'B', 'OK', ts(2026, 2)),
      ]),
      Date.UTC(2026, 3, 15),
      { start: '2026-03', end: '2026-03' },
    );

    expect(result.totals.submissions).toBe(1);
    expect(result.totals.attempts).toBe(1);
    expect(result.totals.failures).toBe(0);
    expect(result.problems[0].index).toBe('A');
    expect(result.problems[0].submissions).toBe(1);
    expect(result.problems[0].tier).toBe('solid');
  });

  it('treats a problem as solved if it was accepted before the window', () => {
    const result = analyze(
      dataset([
        submission(7, 'C', 'OK', ts(2026, 1)),
        submission(7, 'C', 'WRONG_ANSWER', ts(2026, 2)),
      ]),
      Date.UTC(2026, 3, 15),
      { start: '2026-02', end: '2026-02' },
    );

    const problem = result.problems[0];
    expect(problem.failures).toBe(1);
    expect(problem.latestFailures).toBe(1);
    expect(problem.latestFailure).toBe(ts(2026, 2));
    expect(problem.solvedByEnd).toBe(true);
    expect(problem.everSolved).toBe(true);
    expect(problem.solvedLater).toBe(false);
    expect(problem.tier).toBe('solid');
    expect(result.totals.neverSolved).toBe(0);
  });

  it('counts failures after an older AC as the latest solve in the window', () => {
    const result = analyze(
      dataset([
        submission(29, 'F', 'OK', ts(2026, 1)),
        submission(29, 'F', 'WRONG_ANSWER', ts(2026, 2)),
        submission(29, 'F', 'WRONG_ANSWER', ts(2026, 3)),
      ]),
      Date.UTC(2026, 4, 15),
      { start: '2026-02', end: '2026-03' },
    );

    const problem = result.problems[0];
    expect(problem.failures).toBe(2);
    expect(problem.latestFailures).toBe(2);
    expect(problem.latestFailure).toBe(ts(2026, 3));
    expect(problem.tier).toBe('maybe');
  });

  it('does not let a solve after the window reset priority inside the window', () => {
    const result = analyze(
      dataset([
        submission(24, 'E', 'OK', ts(2026, 1)),
        submission(24, 'E', 'WRONG_ANSWER', ts(2026, 2)),
        submission(24, 'E', 'OK', ts(2026, 3)),
      ]),
      Date.UTC(2026, 3, 15),
      { start: '2026-02', end: '2026-02' },
    );

    const problem = result.problems[0];
    expect(problem.latestFailures).toBe(1);
    expect(problem.latestFailure).toBe(ts(2026, 2));
    expect(problem.solvedByEnd).toBe(true);
    expect(problem.tier).toBe('solid');
  });

  it('marks a problem solved after the window as never solved for that window', () => {
    const result = analyze(
      dataset([
        submission(8, 'D', 'WRONG_ANSWER', ts(2026, 1)),
        submission(8, 'D', 'WRONG_ANSWER', ts(2026, 1, 20)),
        submission(8, 'D', 'OK', ts(2026, 3)),
      ]),
      Date.UTC(2026, 3, 15),
      { start: '2026-01', end: '2026-01' },
    );

    const problem = result.problems[0];
    expect(problem.failures).toBe(2);
    expect(problem.latestFailures).toBe(2);
    expect(problem.solvedByEnd).toBe(false);
    expect(problem.everSolved).toBe(true);
    expect(problem.solvedLater).toBe(true);
    expect(problem.tier).toBe('unsolved');
    expect(result.totals.neverSolved).toBe(1);
    expect(result.totals.solvedLater).toBe(1);
  });

  it('uses all time when no window is supplied', () => {
    const result = analyze(
      dataset([
        submission(9, 'A', 'WRONG_ANSWER', ts(2025, 1)),
        submission(9, 'A', 'OK', ts(2026, 1)),
      ]),
      Date.UTC(2026, 3, 15),
    );

    expect(result.allTime).toBe(true);
    expect(result.totals.submissions).toBe(2);
    expect(result.problems[0].failures).toBe(1);
  });

  it('sorts by tier priority by default and by failures on request', () => {
    const result = analyze(
      dataset([
        submission(10, 'A', 'WRONG_ANSWER', 100),
        submission(10, 'A', 'OK', 200),
        submission(11, 'B', 'WRONG_ANSWER', 300),
        submission(11, 'B', 'WRONG_ANSWER', 400),
        submission(11, 'B', 'OK', 500),
      ]),
      10_000_000,
    );

    expect(sortProblems(result.problems, 'failures')[0].index).toBe('B');
    expect(sortProblems(result.problems, 'priority')[0].tier).toBe('maybe');
  });

  it('sorts by latest-solve failures instead of old failures', () => {
    const rows: CfSubmission[] = [];
    for (let index = 0; index < 20; index++) {
      rows.push(submission(25, 'A', 'WRONG_ANSWER', 100 + index));
    }
    rows.push(submission(25, 'A', 'OK', 200));
    rows.push(submission(25, 'A', 'OK', 300));
    rows.push(submission(26, 'B', 'WRONG_ANSWER', 400));
    rows.push(submission(26, 'B', 'WRONG_ANSWER', 500));
    rows.push(submission(26, 'B', 'OK', 600));

    const result = analyze(dataset(rows), 10_000_000);
    const oldFailures = result.problems.find((problem) => problem.index === 'A');
    const latestFailures = result.problems.find((problem) => problem.index === 'B');
    expect(oldFailures?.failures).toBe(20);
    expect(oldFailures?.latestFailures).toBe(0);
    expect(oldFailures?.latestFailure).toBeUndefined();
    expect(latestFailures?.latestFailures).toBe(2);
    expect(sortProblems(result.problems, 'failures')[0].index).toBe('B');
  });

  it('aggregates tag statistics across problems', () => {
    const result = analyze(
      dataset([
        submission(12, 'A', 'WRONG_ANSWER', 100),
        submission(12, 'A', 'WRONG_ANSWER', 200),
        submission(12, 'A', 'OK', 300),
        submission(13, 'B', 'OK', 400),
      ]),
      10_000_000,
    );

    const dp = result.tags.find((tag) => tag.tag === 'dp');
    expect(dp?.problems).toBe(2);
    expect(dp?.solved).toBe(2);
    expect(dp?.failures).toBe(2);
    expect(dp?.topVerdict).toBe('WRONG_ANSWER');
  });

  it('aggregates tag statistics from the latest solve episode', () => {
    const rows: CfSubmission[] = [];
    for (let index = 0; index < 20; index++) {
      rows.push(submission(27, 'A', 'WRONG_ANSWER', 100 + index));
    }
    rows.push(submission(27, 'A', 'OK', 200));
    rows.push(submission(27, 'A', 'WRONG_ANSWER', 300));
    rows.push(submission(27, 'A', 'OK', 400));
    rows.push(submission(28, 'B', 'OK', 500));

    const result = analyze(dataset(rows), 10_000_000);
    const dp = result.tags.find((tag) => tag.tag === 'dp');
    expect(dp?.failures).toBe(1);
    expect(dp?.submissions).toBe(3);
    expect(dp?.topVerdict).toBe('WRONG_ANSWER');
  });

  it('records contest participation and solved-by-window status', () => {
    const result = analyze(
      dataset([
        submission(14, 'A', 'WRONG_ANSWER', 100),
        submission(14, 'A', 'WRONG_ANSWER', 200, 'CONTESTANT'),
        submission(14, 'A', 'OK', 300, 'CONTESTANT'),
        submission(14, 'A', 'OK', 400),
      ]),
      10_000_000,
    );

    const problem = result.problems[0];
    expect(problem.solvedByEnd).toBe(true);
    expect(problem.solvedInContest).toBe(true);
    expect(problem.contestSubmissions).toBe(2);
    expect(problem.practiceSubmissions).toBe(2);
  });
});
