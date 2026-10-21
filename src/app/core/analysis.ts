import type {
  Analysis,
  CfRatingChange,
  CfSubmission,
  ContestSplit,
  Dataset,
  Insight,
  MonthPoint,
  ProblemAnalysis,
  RatingBucket,
  TagStats,
  Tier,
  VerdictSummary,
  YearStat,
} from './models';
import { formatMonth, problemUrl, timeAgo } from './format';

export type StruggleSort = 'priority' | 'failures' | 'oldest' | 'newest' | 'rating';
export type RatingFilter = 'all' | 'lt1200' | '1200-1599' | '1600-1999' | '2000-2399' | '2400plus' | 'unrated';

const TIERS: Tier[] = ['must', 'should', 'maybe', 'unsolved', 'tried-once', 'solid'];
const STALE_DAYS = 180;

export function isFailure(submission: CfSubmission): boolean {
  return submission.verdict != null && submission.verdict !== 'OK';
}

function problemKey(submission: CfSubmission): string {
  const problem = submission.problem;
  if (problem.contestId != null) return `${problem.contestId}-${problem.index}`;
  return `${problem.problemsetName ?? 'custom'}-${problem.index}-${problem.name}`;
}

function emptySplit(): ContestSplit {
  return {
    submissions: 0,
    acs: 0,
    failures: 0,
    failureRate: 0,
    solvedProblems: 0,
    onlyUpsolved: 0,
  };
}

function buildSplit(submissions: CfSubmission[]): ContestSplit {
  const split = emptySplit();
  split.submissions = submissions.length;
  const solved = new Set<string>();
  for (const submission of submissions) {
    if (submission.verdict === 'OK') {
      split.acs++;
      solved.add(problemKey(submission));
    } else if (submission.verdict != null) {
      split.failures++;
    }
  }
  split.solvedProblems = solved.size;
  split.failureRate = split.submissions ? split.failures / split.submissions : 0;
  return split;
}

export function tierFor(failures: number, acs: number): Tier {
  if (acs === 0) return failures >= 2 ? 'unsolved' : 'tried-once';
  if (failures >= 10) return 'must';
  if (failures >= 5) return 'should';
  if (failures >= 2) return 'maybe';
  return 'solid';
}

function buildProblem(submissions: CfSubmission[]): ProblemAnalysis {
  const ordered = [...submissions].sort(
    (a, b) => a.creationTimeSeconds - b.creationTimeSeconds || a.id - b.id,
  );
  const failuresList = ordered.filter(isFailure);
  const acs = ordered.filter((submission) => submission.verdict === 'OK');
  const firstAC = acs[0]?.creationTimeSeconds;
  const failuresBeforeFirstAC =
    firstAC == null
      ? failuresList.length
      : failuresList.filter((submission) => submission.creationTimeSeconds < firstAC).length;

  const verdictCounts = new Map<string, number>();
  for (const submission of failuresList) {
    if (!submission.verdict) continue;
    verdictCounts.set(submission.verdict, (verdictCounts.get(submission.verdict) ?? 0) + 1);
  }
  const verdicts = [...verdictCounts.entries()]
    .map(([verdict, count]) => ({ verdict, count }))
    .sort((a, b) => b.count - a.count);

  const contestSubmissions = ordered.filter(
    (submission) => submission.author.participantType === 'CONTESTANT',
  ).length;
  const practiceSubmissions = ordered.length - contestSubmissions;

  const first = ordered[0];
  const problem = first.problem;
  const failures = failuresList.length;
  const tier = tierFor(failures, acs.length);

  return {
    key: problemKey(first),
    contestId: problem.contestId,
    index: problem.index,
    name: problem.name,
    rating: problem.rating,
    tags: problem.tags ?? [],
    url: problemUrl(problem),
    tier,
    failures,
    submissions: ordered.length,
    acs: acs.length,
    failuresBeforeFirstAC,
    firstAttempt: first.creationTimeSeconds,
    firstAC,
    lastSubmission: ordered[ordered.length - 1].creationTimeSeconds,
    lastFailure: failuresList[failuresList.length - 1]?.creationTimeSeconds,
    solvedInContest: acs.some(
      (submission) => submission.author.participantType === 'CONTESTANT',
    ),
    contestSubmissions,
    practiceSubmissions,
    verdicts,
    attempts: ordered.map((submission) => ({
      id: submission.id,
      time: submission.creationTimeSeconds,
      verdict: submission.verdict,
      language: submission.programmingLanguage,
      timeMs: submission.timeConsumedMillis,
      memoryKb: Math.round(submission.memoryConsumedBytes / 1024),
      contest: submission.author.participantType === 'CONTESTANT',
      participantType: submission.author.participantType,
    })),
  };
}

export function analyze(dataset: Dataset, now = Date.now()): Analysis {
  const groups = new Map<string, CfSubmission[]>();
  for (const submission of dataset.submissions) {
    const key = problemKey(submission);
    const group = groups.get(key);
    if (group) group.push(submission);
    else groups.set(key, [submission]);
  }

  const problems = [...groups.values()].map((group) => buildProblem(group));
  const solvedProblems = problems.filter((problem) => problem.acs > 0);
  const unsolvedProblems = problems.filter((problem) => problem.acs === 0);

  const tierCounts = Object.fromEntries(TIERS.map((tier) => [tier, 0])) as Record<Tier, number>;
  for (const problem of problems) tierCounts[problem.tier]++;

  const totalFailures = problems.reduce((sum, problem) => sum + problem.failures, 0);
  const firstTrySolves = solvedProblems.filter(
    (problem) => problem.failuresBeforeFirstAC === 0,
  ).length;
  const activeFrom = problems.length
    ? Math.min(...problems.map((problem) => problem.firstAttempt))
    : 0;
  const activeTo = problems.length
    ? Math.max(...problems.map((problem) => problem.lastSubmission))
    : 0;

  const currentRating =
    dataset.user.rating ??
    (dataset.ratingHistory.length
      ? dataset.ratingHistory[dataset.ratingHistory.length - 1].newRating
      : undefined);
  const maxRating =
    dataset.user.maxRating ??
    (dataset.ratingHistory.length
      ? Math.max(...dataset.ratingHistory.map((change) => change.newRating))
      : undefined);

  const tags = buildTags(problems);
  const ratingBuckets = buildRatingBuckets(problems);
  const verdicts = buildVerdicts(dataset.submissions, totalFailures);
  const activity = buildActivity(dataset.submissions, now);
  const years = buildYears(dataset.submissions);

  const contestSubs = dataset.submissions.filter(
    (submission) => submission.author.participantType === 'CONTESTANT',
  );
  const contest = buildSplit(contestSubs);
  const practice = buildSplit(
    dataset.submissions.filter(
      (submission) => submission.author.participantType !== 'CONTESTANT',
    ),
  );
  const solvedKeys = new Set(solvedProblems.map((problem) => problem.key));
  const contestSolvedKeys = new Set(
    contestSubs.filter((submission) => submission.verdict === 'OK').map(problemKey),
  );
  contest.onlyUpsolved = Math.max(0, solvedKeys.size - contestSolvedKeys.size);

  const staleStruggles = problems.filter((problem) => {
    const isStruggle = problem.tier === 'must' || problem.tier === 'should';
    return isStruggle && now / 1000 - problem.lastSubmission > STALE_DAYS * 86_400;
  }).length;

  const analysis: Analysis = {
    handle: dataset.handle,
    now,
    user: dataset.user,
    ratingHistory: dataset.ratingHistory,
    problems,
    totals: {
      submissions: dataset.submissions.length,
      attempts: problems.length,
      solved: solvedProblems.length,
      unsolved: unsolvedProblems.length,
      failures: totalFailures,
      firstTrySolves,
      firstTryRate: solvedProblems.length ? firstTrySolves / solvedProblems.length : 0,
      solveRate: problems.length ? solvedProblems.length / problems.length : 0,
      avgFailuresPerSolved: solvedProblems.length
        ? solvedProblems.reduce((sum, problem) => sum + problem.failures, 0) /
          solvedProblems.length
        : 0,
      mustRedo: tierCounts.must,
      shouldRedo: tierCounts.should,
      maybeRedo: tierCounts.maybe,
      neverSolved: tierCounts.unsolved,
      staleStruggles,
      activeFrom,
      activeTo,
      currentRating,
      maxRating,
    },
    tierCounts,
    tags,
    ratingBuckets,
    verdicts,
    activity,
    years,
    contest,
    practice,
    insights: [],
    hardestSolved: [...solvedProblems]
      .filter((problem) => problem.rating != null)
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))[0],
    topStruggle: [...problems].sort((a, b) => b.failures - a.failures)[0],
  };

  analysis.insights = buildInsights(analysis);
  return analysis;
}

function buildTags(problems: ProblemAnalysis[]): TagStats[] {
  interface Acc {
    problems: number;
    solved: number;
    failures: number;
    submissions: number;
    preAcFailures: number;
    solvedWithPreAc: number;
    verdicts: Map<string, number>;
  }

  const map = new Map<string, Acc>();
  for (const problem of problems) {
    for (const tag of problem.tags) {
      let acc = map.get(tag);
      if (!acc) {
        acc = {
          problems: 0,
          solved: 0,
          failures: 0,
          submissions: 0,
          preAcFailures: 0,
          solvedWithPreAc: 0,
          verdicts: new Map(),
        };
        map.set(tag, acc);
      }
      acc.problems++;
      acc.submissions += problem.submissions;
      acc.failures += problem.failures;
      if (problem.acs > 0) {
        acc.solved++;
        acc.preAcFailures += problem.failuresBeforeFirstAC;
        acc.solvedWithPreAc++;
      }
      for (const verdict of problem.verdicts) {
        acc.verdicts.set(verdict.verdict, (acc.verdicts.get(verdict.verdict) ?? 0) + verdict.count);
      }
    }
  }

  return [...map.entries()]
    .map(([tag, acc]) => {
      const unsolved = acc.problems - acc.solved;
      const failureRate = acc.submissions ? acc.failures / acc.submissions : 0;
      const avgFailures = acc.failures / Math.max(1, acc.problems);
      const volume = Math.min(1, acc.problems / 5);
      const weakScore =
        volume *
        (failureRate * 50 + Math.min(avgFailures, 10) * 3 + (unsolved / acc.problems) * 20);
      const topVerdict = [...acc.verdicts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
      return {
        tag,
        problems: acc.problems,
        solved: acc.solved,
        unsolved,
        failures: acc.failures,
        submissions: acc.submissions,
        failureRate,
        solveRate: acc.problems ? acc.solved / acc.problems : 0,
        avgFailures,
        avgFailuresToSolve: acc.solvedWithPreAc
          ? acc.preAcFailures / acc.solvedWithPreAc
          : 0,
        weakScore,
        topVerdict,
      } satisfies TagStats;
    })
    .sort((a, b) => b.weakScore - a.weakScore || b.problems - a.problems);
}

function buildRatingBuckets(problems: ProblemAnalysis[]): RatingBucket[] {
  const buckets: RatingBucket[] = [];
  for (let min = 800; min <= 3600; min += 200) {
    buckets.push({
      label: min >= 3600 ? '3600+' : `${min}–${min + 199}`,
      min,
      max: min >= 3600 ? Number.MAX_SAFE_INTEGER : min + 199,
      problems: 0,
      solved: 0,
      failures: 0,
      submissions: 0,
      failureRate: 0,
      avgFailures: 0,
      solveRate: 0,
    });
  }
  buckets.push({
    label: 'Unrated',
    min: -1,
    max: -1,
    problems: 0,
    solved: 0,
    failures: 0,
    submissions: 0,
    failureRate: 0,
    avgFailures: 0,
    solveRate: 0,
  });

  for (const problem of problems) {
    const bucket =
      problem.rating == null
        ? buckets[buckets.length - 1]
        : (buckets.find(
            (candidate) =>
              candidate.min !== -1 && problem.rating! >= candidate.min && problem.rating! <= candidate.max,
          ) ?? buckets[0]);
    if (!bucket) continue;
    bucket.problems++;
    bucket.submissions += problem.submissions;
    bucket.failures += problem.failures;
    if (problem.acs > 0) bucket.solved++;
  }

  for (const bucket of buckets) {
    bucket.failureRate = bucket.submissions ? bucket.failures / bucket.submissions : 0;
    bucket.avgFailures = bucket.problems ? bucket.failures / bucket.problems : 0;
    bucket.solveRate = bucket.problems ? bucket.solved / bucket.problems : 0;
  }

  return buckets.filter((bucket) => bucket.problems > 0);
}

function buildVerdicts(submissions: CfSubmission[], totalFailures: number): VerdictSummary[] {
  const map = new Map<string, number>();
  for (const submission of submissions) {
    if (!isFailure(submission) || !submission.verdict) continue;
    map.set(submission.verdict, (map.get(submission.verdict) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([verdict, count]) => ({
      verdict,
      count,
      share: totalFailures ? count / totalFailures : 0,
    }))
    .sort((a, b) => b.count - a.count);
}

function monthKey(ts: number): string {
  const date = new Date(ts * 1000);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function buildActivity(submissions: CfSubmission[], now: number): MonthPoint[] {
  if (!submissions.length) return [];
  const latest = Math.max(...submissions.map((submission) => submission.creationTimeSeconds));
  const end = new Date(Math.max(latest * 1000, now));
  const counts = new Map<string, { submissions: number; acs: number; failures: number }>();
  for (const submission of submissions) {
    const key = monthKey(submission.creationTimeSeconds);
    const entry = counts.get(key) ?? { submissions: 0, acs: 0, failures: 0 };
    entry.submissions++;
    if (submission.verdict === 'OK') entry.acs++;
    else if (isFailure(submission)) entry.failures++;
    counts.set(key, entry);
  }

  const points: MonthPoint[] = [];
  for (let offset = 35; offset >= 0; offset--) {
    const cursor = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - offset, 1));
    const key = `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, '0')}`;
    const entry = counts.get(key) ?? { submissions: 0, acs: 0, failures: 0 };
    points.push({ month: key, label: formatMonth(key), ...entry });
  }
  return points;
}

function buildYears(submissions: CfSubmission[]): YearStat[] {
  const map = new Map<number, YearStat>();
  for (const submission of submissions) {
    const year = new Date(submission.creationTimeSeconds * 1000).getUTCFullYear();
    const stat = map.get(year) ?? { year, submissions: 0, acs: 0, failures: 0 };
    stat.submissions++;
    if (submission.verdict === 'OK') stat.acs++;
    else if (isFailure(submission)) stat.failures++;
    map.set(year, stat);
  }
  return [...map.values()].sort((a, b) => a.year - b.year);
}

function buildInsights(analysis: Analysis): Insight[] {
  const insights: Insight[] = [];
  const { totals } = analysis;

  const weakTag = analysis.tags.find((tag) => tag.problems >= 3);
  if (weakTag && weakTag.failures > 0) {
    insights.push({
      level: 'warn',
      title: `Weakest topic: ${weakTag.tag}`,
      text: `${Math.round(weakTag.failureRate * 100)}% of your submissions in ${weakTag.tag} were rejected across ${weakTag.problems} problems. Average ${weakTag.avgFailures.toFixed(1)} failures per problem.`,
    });
  }

  if (totals.staleStruggles > 0) {
    const oldest = [...analysis.problems]
      .filter(
        (problem) =>
          (problem.tier === 'must' || problem.tier === 'should') &&
          analysis.now / 1000 - problem.lastSubmission > STALE_DAYS * 86_400,
      )
      .sort((a, b) => a.lastSubmission - b.lastSubmission)[0];
    insights.push({
      level: 'warn',
      title: `${totals.staleStruggles} high-struggle problems have gone stale`,
      text: oldest
        ? `You haven't touched ${oldest.name} in ${timeAgo(oldest.lastSubmission, analysis.now)} despite ${oldest.failures} failed attempts. It is the oldest one waiting for a rematch.`
        : 'Several problems with 5+ failures have not been attempted in over six months.',
    });
  }

  const topVerdict = analysis.verdicts[0];
  if (topVerdict) {
    insights.push({
      level: 'info',
      title: `Most common failure: ${topVerdict.verdict.replaceAll('_', ' ').toLowerCase()}`,
      text: `${Math.round(topVerdict.share * 100)}% of your ${totals.failures} failed submissions ended with this verdict. Fixing that one habit could remove the biggest chunk of wasted attempts.`,
    });
  }

  if (totals.solved > 0) {
    insights.push({
      level: totals.firstTryRate >= 0.4 ? 'good' : 'info',
      title: `${Math.round(totals.firstTryRate * 100)}% first-try solve rate`,
      text: `${totals.firstTrySolves} of ${totals.solved} solved problems were accepted on the very first submission.`,
    });
  }

  if (totals.neverSolved > 0) {
    const oldestUnsolved = [...analysis.problems]
      .filter((problem) => problem.tier === 'unsolved')
      .sort((a, b) => a.lastSubmission - b.lastSubmission)[0];
    insights.push({
      level: 'info',
      title: `${totals.neverSolved} problems never solved`,
      text: oldestUnsolved
        ? `${oldestUnsolved.name} has been waiting since ${timeAgo(oldestUnsolved.lastSubmission, analysis.now)} after ${oldestUnsolved.failures} failures.`
        : 'These are the problems with repeated attempts but no accepted submission yet.',
    });
  }

  return insights.slice(0, 5);
}

export function sortProblems(problems: ProblemAnalysis[], sort: StruggleSort): ProblemAnalysis[] {
  const copy = [...problems];
  const tierPriority: Record<Tier, number> = {
    must: 0,
    should: 1,
    maybe: 2,
    unsolved: 3,
    'tried-once': 4,
    solid: 5,
  };
  switch (sort) {
    case 'failures':
      return copy.sort((a, b) => b.failures - a.failures || a.lastSubmission - b.lastSubmission);
    case 'oldest':
      return copy.sort((a, b) => a.lastSubmission - b.lastSubmission);
    case 'newest':
      return copy.sort((a, b) => b.lastSubmission - a.lastSubmission);
    case 'rating':
      return copy.sort(
        (a, b) => (b.rating ?? -1) - (a.rating ?? -1) || b.failures - a.failures,
      );
    default:
      return copy.sort(
        (a, b) =>
          tierPriority[a.tier] - tierPriority[b.tier] ||
          a.lastSubmission - b.lastSubmission ||
          b.failures - a.failures,
      );
  }
}

export function matchesRatingFilter(
  problem: ProblemAnalysis,
  filter: RatingFilter,
): boolean {
  const rating = problem.rating;
  switch (filter) {
    case 'lt1200':
      return rating != null && rating < 1200;
    case '1200-1599':
      return rating != null && rating >= 1200 && rating < 1600;
    case '1600-1999':
      return rating != null && rating >= 1600 && rating < 2000;
    case '2000-2399':
      return rating != null && rating >= 2000 && rating < 2400;
    case '2400plus':
      return rating != null && rating >= 2400;
    case 'unrated':
      return rating == null;
    default:
      return true;
  }
}

export const ACTION_TIERS: Tier[] = ['must', 'should', 'maybe', 'unsolved'];

export function tierCount(analysis: Analysis, tiers: Tier[]): number {
  return tiers.reduce((sum, tier) => sum + analysis.tierCounts[tier], 0);
}

export type { CfRatingChange };
