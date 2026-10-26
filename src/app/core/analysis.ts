import type {
  Analysis,
  CfSubmission,
  Dataset,
  MonthPoint,
  ProblemAnalysis,
  TagStats,
  Tier,
  TimeWindow,
  VerdictStat,
} from './models';
import { formatMonth, problemUrl } from './format';
import {
  allTimeWindow,
  clampWindow,
  compareMonths,
  isAllTime,
  monthBounds,
  monthOfSeconds,
  monthRange,
  monthsInclusive,
  windowSeconds,
} from './time-window';

export type StruggleSort = 'priority' | 'failures' | 'oldest' | 'newest' | 'rating';

const TIERS: Tier[] = ['must', 'should', 'maybe', 'unsolved', 'tried-once', 'solid'];

export function isFailure(submission: CfSubmission): boolean {
  return submission.verdict != null && submission.verdict !== 'OK';
}

function problemKey(submission: CfSubmission): string {
  const problem = submission.problem;
  if (problem.contestId != null) return `${problem.contestId}-${problem.index}`;
  return `${problem.problemsetName ?? 'custom'}-${problem.index}-${problem.name}`;
}

export function tierFor(latestFailures: number, solvedByEnd: boolean): Tier {
  if (!solvedByEnd) return latestFailures >= 2 ? 'unsolved' : 'tried-once';
  if (latestFailures >= 10) return 'must';
  if (latestFailures >= 5) return 'should';
  if (latestFailures >= 2) return 'maybe';
  return 'solid';
}

function buildVerdicts(failures: CfSubmission[]): VerdictStat[] {
  const counts = new Map<string, number>();
  for (const submission of failures) {
    if (!submission.verdict) continue;
    counts.set(submission.verdict, (counts.get(submission.verdict) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([verdict, count]) => ({ verdict, count }))
    .sort((a, b) => b.count - a.count);
}

function buildProblem(
  allSubmissions: CfSubmission[],
  windowSubmissions: CfSubmission[],
  windowEnd: number,
): ProblemAnalysis {
  const ordered = [...windowSubmissions].sort(
    (a, b) => a.creationTimeSeconds - b.creationTimeSeconds || a.id - b.id,
  );
  const allOrdered = [...allSubmissions].sort(
    (a, b) => a.creationTimeSeconds - b.creationTimeSeconds || a.id - b.id,
  );

  const failuresList = ordered.filter(isFailure);
  const windowAcs = ordered.filter((submission) => submission.verdict === 'OK');
  const allAcs = allOrdered.filter((submission) => submission.verdict === 'OK');
  const firstAC = allAcs[0]?.creationTimeSeconds;
  const solvedByEnd = allAcs.some((submission) => submission.creationTimeSeconds <= windowEnd);
  const everSolved = allAcs.length > 0;

  let lastAcIndex = -1;
  for (let index = allOrdered.length - 1; index >= 0; index--) {
    const candidate = allOrdered[index];
    if (candidate.verdict === 'OK' && candidate.creationTimeSeconds <= windowEnd) {
      lastAcIndex = index;
      break;
    }
  }

  let previousAc: CfSubmission | undefined;
  for (let index = lastAcIndex - 1; index >= 0; index--) {
    if (allOrdered[index].verdict === 'OK') {
      previousAc = allOrdered[index];
      break;
    }
  }

  const afterPreviousAc = (submission: CfSubmission): boolean =>
    previousAc == null ||
    submission.creationTimeSeconds > previousAc.creationTimeSeconds ||
    (submission.creationTimeSeconds === previousAc.creationTimeSeconds &&
      submission.id > previousAc.id);
  const latestList = previousAc ? ordered.filter(afterPreviousAc) : ordered;
  const latestFailuresList = latestList.filter(isFailure);
  const latestFailures = latestFailuresList.length;
  const latestFailure = latestFailuresList[latestFailuresList.length - 1]?.creationTimeSeconds;
  const latestVerdicts = buildVerdicts(latestFailuresList);

  const problem = ordered[0].problem;
  const failures = failuresList.length;

  return {
    key: problemKey(ordered[0]),
    contestId: problem.contestId,
    index: problem.index,
    name: problem.name,
    rating: problem.rating,
    tags: problem.tags ?? [],
    url: problemUrl(problem),
    tier: tierFor(latestFailures, solvedByEnd),
    failures,
    latestFailures,
    submissions: ordered.length,
    latestSubmissions: latestList.length,
    acs: windowAcs.length,
    solvedByEnd,
    everSolved,
    solvedLater: everSolved && !solvedByEnd,
    firstAttempt: ordered[0].creationTimeSeconds,
    firstAC,
    lastSubmission: ordered[ordered.length - 1].creationTimeSeconds,
    lastFailure: failuresList[failuresList.length - 1]?.creationTimeSeconds,
    latestEpisodeStart: previousAc?.creationTimeSeconds,
    latestFailure,
    solvedInContest: windowAcs.some(
      (submission) => submission.author.participantType === 'CONTESTANT',
    ),
    contestSubmissions: ordered.filter(
      (submission) => submission.author.participantType === 'CONTESTANT',
    ).length,
    practiceSubmissions: ordered.filter(
      (submission) => submission.author.participantType !== 'CONTESTANT',
    ).length,
    verdicts: buildVerdicts(failuresList),
    latestVerdicts,
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

export function analyze(
  dataset: Dataset,
  now = Date.now(),
  requestedWindow: TimeWindow | null = null,
  filter?: { minRating: number; maxRating: number }
): Analysis {
  const bounds = monthBounds(dataset.submissions, now);
  const effectiveWindow =
    requestedWindow == null ? allTimeWindow(bounds) : clampWindow(requestedWindow, bounds);
  const allTime = requestedWindow == null || isAllTime(effectiveWindow, bounds);
  const range = windowSeconds(effectiveWindow);

  const windowSubmissions = dataset.submissions.filter(
    (submission) =>
      submission.creationTimeSeconds >= range.start && submission.creationTimeSeconds <= range.end &&
      submission.problem.rating >= (filter?.minRating ?? -Infinity) &&
      submission.problem.rating <= (filter?.maxRating ?? Infinity)
  );

  const allGroups = new Map<string, CfSubmission[]>();
  for (const submission of dataset.submissions) {
    const key = problemKey(submission);
    const group = allGroups.get(key);
    if (group) group.push(submission);
    else allGroups.set(key, [submission]);
  }

  const windowGroups = new Map<string, CfSubmission[]>();
  for (const submission of windowSubmissions) {
    const key = problemKey(submission);
    const group = windowGroups.get(key);
    if (group) group.push(submission);
    else windowGroups.set(key, [submission]);
  }

  const problems: ProblemAnalysis[] = [...windowGroups.entries()].map(([key, group]) =>
    buildProblem(allGroups.get(key) ?? group, group, range.end),
  );

  const solvedProblems = problems.filter((problem) => problem.solvedByEnd);
  const unsolvedProblems = problems.filter((problem) => !problem.solvedByEnd);

  const tierCounts = Object.fromEntries(TIERS.map((tier) => [tier, 0])) as Record<Tier, number>;
  for (const problem of problems) tierCounts[problem.tier]++;

  const totalFailures = problems.reduce((sum, problem) => sum + problem.failures, 0);
  const activeFrom = windowSubmissions.length
    ? Math.min(...windowSubmissions.map((submission) => submission.creationTimeSeconds))
    : 0;
  const activeTo = windowSubmissions.length
    ? Math.max(...windowSubmissions.map((submission) => submission.creationTimeSeconds))
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

  const sortedRating = [...dataset.ratingHistory].sort(
    (a, b) => a.ratingUpdateTimeSeconds - b.ratingUpdateTimeSeconds,
  );
  const ratingHistory = sortedRating.filter(
    (change) =>
      change.ratingUpdateTimeSeconds >= range.start && change.ratingUpdateTimeSeconds <= range.end,
  );
  const ratingBeforeOrAtEnd = sortedRating.filter(
    (change) => change.ratingUpdateTimeSeconds <= range.end,
  );
  let ratingAtEnd: number | undefined =
    ratingBeforeOrAtEnd[ratingBeforeOrAtEnd.length - 1]?.newRating;
  if (ratingAtEnd == null && range.end >= Math.floor(now / 1000)) {
    ratingAtEnd = currentRating;
  }
  const ratingBest = ratingHistory.length
    ? Math.max(...ratingHistory.map((change) => change.newRating))
    : undefined;

  const activity = buildActivity(windowSubmissions, effectiveWindow.start, effectiveWindow.end);

  return {
    handle: dataset.handle,
    now,
    user: dataset.user,
    window: effectiveWindow,
    allTime,
    ratingHistory,
    ratingAtEnd,
    ratingBest,
    contests: ratingHistory.length,
    problems,
    totals: {
      submissions: windowSubmissions.length,
      attempts: problems.length,
      solved: solvedProblems.length,
      unsolved: unsolvedProblems.length,
      failures: totalFailures,
      mustRedo: tierCounts.must,
      shouldRedo: tierCounts.should,
      maybeRedo: tierCounts.maybe,
      neverSolved: unsolvedProblems.length,
      solvedLater: problems.filter((problem) => problem.solvedLater).length,
      activeFrom,
      activeTo,
      currentRating,
      maxRating,
      windowMonths: allTime ? null : monthsInclusive(effectiveWindow.start, effectiveWindow.end),
    },
    tierCounts,
    tags: buildTags(problems),
    activity,
  };
}

function buildTags(problems: ProblemAnalysis[]): TagStats[] {
  interface Acc {
    problems: number;
    solved: number;
    failures: number;
    submissions: number;
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
          verdicts: new Map(),
        };
        map.set(tag, acc);
      }
      acc.problems++;
      acc.submissions += problem.latestSubmissions;
      acc.failures += problem.latestFailures;
      if (problem.solvedByEnd) acc.solved++;
      for (const verdict of problem.latestVerdicts) {
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
        weakScore,
        topVerdict,
      } satisfies TagStats;
    })
    .sort((a, b) => b.weakScore - a.weakScore || b.problems - a.problems);
}

function buildActivity(
  submissions: CfSubmission[],
  startMonth: string,
  endMonth: string,
): MonthPoint[] {
  const counts = new Map<string, { submissions: number; acs: number; failures: number }>();
  for (const submission of submissions) {
    const key = monthOfSeconds(submission.creationTimeSeconds);
    if (compareMonths(key, startMonth) < 0 || compareMonths(key, endMonth) > 0) continue;
    const entry = counts.get(key) ?? { submissions: 0, acs: 0, failures: 0 };
    entry.submissions++;
    if (submission.verdict === 'OK') entry.acs++;
    else if (isFailure(submission)) entry.failures++;
    counts.set(key, entry);
  }

  return monthRange(startMonth, endMonth).map((key) => ({
    month: key,
    label: formatMonth(key),
    ...(counts.get(key) ?? { submissions: 0, acs: 0, failures: 0 }),
  }));
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
  const latestFail = (problem: ProblemAnalysis) => problem.latestFailure ?? Number.MAX_SAFE_INTEGER;
  switch (sort) {
    case 'failures':
      return copy.sort(
        (a, b) =>
          b.latestFailures - a.latestFailures ||
          b.failures - a.failures ||
          latestFail(a) - latestFail(b),
      );
    case 'oldest':
      return copy.sort((a, b) => latestFail(a) - latestFail(b));
    case 'newest':
      return copy.sort(
        (a, b) =>
          (b.latestFailure ?? Number.MIN_SAFE_INTEGER) -
          (a.latestFailure ?? Number.MIN_SAFE_INTEGER),
      );
    case 'rating':
      return copy.sort(
        (a, b) =>
          (b.rating ?? -1) - (a.rating ?? -1) ||
          b.latestFailures - a.latestFailures ||
          b.failures - a.failures,
      );
    default:
      return copy.sort(
        (a, b) =>
          tierPriority[a.tier] - tierPriority[b.tier] ||
          b.latestFailures - a.latestFailures ||
          latestFail(a) - latestFail(b),
      );
  }
}

export const ACTION_TIERS: Tier[] = ['must', 'should', 'maybe', 'unsolved'];

export function tierCount(analysis: Analysis, tiers: Tier[]): number {
  return tiers.reduce((sum, tier) => sum + analysis.tierCounts[tier], 0);
}
