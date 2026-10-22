export interface CfProblem {
  contestId?: number;
  problemsetName?: string;
  index: string;
  name: string;
  type: string;
  points?: number;
  rating?: number;
  tags: string[];
}

export interface CfParty {
  contestId?: number;
  members: { handle: string }[];
  participantType: string;
  ghost?: boolean;
  room?: number;
  startTimeSeconds?: number;
}

export interface CfSubmission {
  id: number;
  contestId?: number;
  creationTimeSeconds: number;
  relativeTimeSeconds: number;
  problem: CfProblem;
  author: CfParty;
  programmingLanguage: string;
  verdict?: string;
  testset?: string;
  passedTestCount: number;
  timeConsumedMillis: number;
  memoryConsumedBytes: number;
}

export interface CfUserInfo {
  handle: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  country?: string;
  organization?: string;
  contribution?: number;
  rank?: string;
  rating?: number;
  maxRank?: string;
  maxRating?: number;
  lastOnlineTimeSeconds: number;
  registrationTimeSeconds: number;
  friendOfCount: number;
  avatar?: string;
  titlePhoto?: string;
}

export interface CfRatingChange {
  contestId: number;
  contestName: string;
  handle: string;
  rank: number;
  ratingUpdateTimeSeconds: number;
  oldRating: number;
  newRating: number;
}

export interface CfProblemStatistics {
  contestId: number;
  index: string;
  solvedCount: number;
}

export interface CfProblemset {
  problems: CfProblem[];
  problemStatistics: CfProblemStatistics[];
}

export type CfResponse<T> = { status: 'OK'; result: T } | { status: 'FAILED'; comment: string };

export interface Dataset {
  handle: string;
  user: CfUserInfo;
  submissions: CfSubmission[];
  ratingHistory: CfRatingChange[];
  fetchedAt: number;
}

/** Inclusive calendar-month range, formatted as YYYY-MM (UTC). */
export interface TimeWindow {
  start: string;
  end: string;
}

/** The earliest and latest month the account has data for. */
export interface MonthBounds {
  min: string;
  max: string;
}

export type Tier = 'must' | 'should' | 'maybe' | 'unsolved' | 'tried-once' | 'solid';

export interface VerdictStat {
  verdict: string;
  count: number;
}

export interface Attempt {
  id: number;
  time: number;
  verdict?: string;
  language: string;
  timeMs: number;
  memoryKb: number;
  contest: boolean;
  participantType: string;
}

export interface ProblemAnalysis {
  key: string;
  contestId?: number;
  index: string;
  name: string;
  rating?: number;
  tags: string[];
  url: string;
  tier: Tier;
  failures: number;
  submissions: number;
  acs: number;
  /** A correct submission exists on or before the end of the selected window. */
  solvedByEnd: boolean;
  /** A correct submission exists anywhere in the downloaded history. */
  everSolved: boolean;
  /** Solved for the first time only after the selected window ended. */
  solvedLater: boolean;
  firstAttempt: number;
  firstAC?: number;
  lastSubmission: number;
  lastFailure?: number;
  solvedInContest: boolean;
  contestSubmissions: number;
  practiceSubmissions: number;
  verdicts: VerdictStat[];
  attempts: Attempt[];
}

export interface TagStats {
  tag: string;
  problems: number;
  solved: number;
  unsolved: number;
  failures: number;
  submissions: number;
  failureRate: number;
  solveRate: number;
  avgFailures: number;
  weakScore: number;
  topVerdict?: string;
}

export interface MonthPoint {
  month: string;
  label: string;
  submissions: number;
  acs: number;
  failures: number;
}

export interface AnalysisTotals {
  submissions: number;
  attempts: number;
  solved: number;
  unsolved: number;
  failures: number;
  mustRedo: number;
  shouldRedo: number;
  maybeRedo: number;
  neverSolved: number;
  solvedLater: number;
  activeFrom: number;
  activeTo: number;
  currentRating?: number;
  maxRating?: number;
  windowMonths: number | null;
}

export interface Analysis {
  handle: string;
  now: number;
  user: CfUserInfo;
  window: TimeWindow;
  allTime: boolean;
  ratingHistory: CfRatingChange[];
  ratingAtEnd?: number;
  ratingBest?: number;
  contests: number;
  problems: ProblemAnalysis[];
  totals: AnalysisTotals;
  tierCounts: Record<Tier, number>;
  tags: TagStats[];
  activity: MonthPoint[];
}

export interface MashupPick {
  slot: string;
  problem: ProblemAnalysis;
}
