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
    expect(problem.acs).toBe(1);
    expect(problem.submissions).toBe(4);
    expect(problem.failuresBeforeFirstAC).toBe(2);
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

  it('re-buckets a solved problem when counting only pre-AC failures', () => {
    expect(tierFor(3, 1)).toBe('maybe');
    expect(tierFor(3, 0)).toBe('unsolved');
    expect(tierFor(10, 1)).toBe('must');
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
    expect(result.totals.neverSolved).toBe(1);
  });

  it('computes first-try rate without counting later practice failures', () => {
    const result = analyze(
      dataset([
        submission(5, 'E', 'OK', 100),
        submission(5, 'E', 'WRONG_ANSWER', 200),
        submission(6, 'F', 'WRONG_ANSWER', 300),
        submission(6, 'F', 'OK', 400),
      ]),
      10_000_000,
    );

    expect(result.totals.solved).toBe(2);
    expect(result.totals.firstTrySolves).toBe(1);
    expect(result.totals.firstTryRate).toBe(0.5);
  });

  it('sorts by tier priority by default and by failures on request', () => {
    const result = analyze(
      dataset([
        submission(7, 'A', 'WRONG_ANSWER', 100),
        submission(7, 'A', 'OK', 200),
        submission(8, 'B', 'WRONG_ANSWER', 300),
        submission(8, 'B', 'WRONG_ANSWER', 400),
        submission(8, 'B', 'OK', 500),
      ]),
      10_000_000,
    );

    expect(sortProblems(result.problems, 'failures')[0].index).toBe('B');
    expect(sortProblems(result.problems, 'priority')[0].tier).toBe('maybe');
  });

  it('aggregates tag statistics across problems', () => {
    const result = analyze(
      dataset([
        submission(9, 'A', 'WRONG_ANSWER', 100),
        submission(9, 'A', 'WRONG_ANSWER', 200),
        submission(9, 'A', 'OK', 300),
        submission(10, 'B', 'OK', 400),
      ]),
      10_000_000,
    );

    const dp = result.tags.find((tag) => tag.tag === 'dp');
    expect(dp?.problems).toBe(2);
    expect(dp?.solved).toBe(2);
    expect(dp?.failures).toBe(2);
    expect(dp?.topVerdict).toBe('WRONG_ANSWER');
  });

  it('records pre-AC failures and contest participation', () => {
    const result = analyze(
      dataset([
        submission(11, 'A', 'WRONG_ANSWER', 100),
        submission(11, 'A', 'WRONG_ANSWER', 200, 'CONTESTANT'),
        submission(11, 'A', 'OK', 300, 'CONTESTANT'),
        submission(11, 'A', 'OK', 400),
      ]),
      10_000_000,
    );

    const problem = result.problems[0];
    expect(problem.failuresBeforeFirstAC).toBe(2);
    expect(problem.solvedInContest).toBe(true);
    expect(problem.contestSubmissions).toBe(2);
    expect(problem.practiceSubmissions).toBe(2);
    expect(result.contest.solvedProblems).toBe(1);
  });
});
