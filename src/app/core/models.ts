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
  /** New filter state for rating ranges */
  filter?: { minRating: number; maxRating: number };
}