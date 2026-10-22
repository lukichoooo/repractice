import type { ProblemAnalysis, Tier } from './models';
import { buildMashup, mashupCode, mashupCount, mashupText } from './mashup';

function problem(
  contestId: number,
  index: string,
  tier: Tier,
  failures: number,
  rating = 1500,
): ProblemAnalysis {
  return {
    key: `${contestId}-${index}`,
    contestId,
    index,
    name: `Problem ${contestId}${index}`,
    rating,
    tags: ['dp'],
    url: `https://codeforces.com/problemset/problem/${contestId}/${index}`,
    tier,
    failures,
    submissions: failures + 1,
    acs: tier === 'solid' || tier === 'must' || tier === 'should' || tier === 'maybe' ? 1 : 0,
    solvedByEnd: tier !== 'unsolved' && tier !== 'tried-once',
    everSolved: tier !== 'unsolved' && tier !== 'tried-once',
    solvedLater: false,
    firstAttempt: 1,
    lastSubmission: 1,
    solvedInContest: false,
    contestSubmissions: 0,
    practiceSubmissions: failures + 1,
    verdicts: [],
    attempts: [],
  };
}

describe('mashup', () => {
  it('maps a session length to a problem count', () => {
    expect(mashupCount(30)).toBe(2);
    expect(mashupCount(60)).toBe(3);
    expect(mashupCount(90)).toBe(4);
    expect(mashupCount(120)).toBe(5);
    expect(mashupCount(150)).toBe(6);
    expect(mashupCount(180)).toBe(7);
  });

  it('builds the requested number of unique problems and slots them', () => {
    const pool = [
      problem(1, 'A', 'must', 12, 1500),
      problem(1, 'B', 'must', 11, 1600),
      problem(2, 'C', 'should', 7, 1400),
      problem(2, 'D', 'maybe', 3, 1700),
      problem(3, 'E', 'unsolved', 4, 1300),
    ];
    const picks = buildMashup(pool, 120, 3);

    expect(picks).toHaveLength(5);
    expect(picks.map((pick) => pick.slot)).toEqual(['A', 'B', 'C', 'D', 'E']);
    expect(new Set(picks.map((pick) => pick.problem.key)).size).toBe(5);
  });

  it('prioritizes must-redo problems while avoiding repeat contests', () => {
    const pool = [
      problem(1, 'A', 'must', 12),
      problem(1, 'B', 'must', 11),
      problem(2, 'C', 'should', 7),
      problem(2, 'D', 'should', 6),
    ];
    const picks = buildMashup(pool, 60, 1);
    expect(picks.filter((pick) => pick.problem.tier === 'must')).toHaveLength(2);
  });

  it('excludes problems that do not need more work', () => {
    const pool = [problem(1, 'A', 'solid', 0), problem(1, 'B', 'tried-once', 1)];
    expect(buildMashup(pool, 60, 1)).toEqual([]);
  });

  it('orders the chosen set from easiest to hardest', () => {
    const pool = [
      problem(1, 'A', 'must', 12, 1800),
      problem(1, 'B', 'must', 11, 1200),
      problem(2, 'C', 'must', 10, 1500),
    ];
    const picks = buildMashup(pool, 90, 1);
    expect(picks.map((pick) => pick.problem.rating)).toEqual([1200, 1500, 1800]);
  });

  it('avoids repeating a contest when it can', () => {
    const pool = [
      problem(1, 'A', 'must', 12),
      problem(1, 'B', 'must', 11),
      problem(1, 'C', 'must', 10),
      problem(2, 'D', 'must', 9),
      problem(2, 'E', 'must', 8),
      problem(2, 'F', 'must', 7),
    ];
    const picks = buildMashup(pool, 90, 1);
    expect(new Set(picks.map((pick) => pick.problem.contestId)).size).toBeGreaterThan(1);
  });

  it('returns a shorter set when the pool is small', () => {
    const pool = [problem(1, 'A', 'must', 12)];
    expect(buildMashup(pool, 180, 1)).toHaveLength(1);
  });

  it('formats copyable Codeforces lines', () => {
    const picks = buildMashup(
      [problem(2237, 'B', 'must', 12, 1500), problem(2314, 'C', 'should', 7, 1600)],
      30,
      1,
    );
    expect(picks.map((pick) => mashupCode(pick.problem))).toEqual(['2237/B', '2314/C']);
    expect(mashupText(picks)).toBe('A - 2237/B\nB - 2314/C');
  });
});
