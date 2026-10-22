import type { MashupPick, ProblemAnalysis, Tier } from './models';
import { ACTION_TIERS } from './analysis';

export interface MashupDuration {
  minutes: number;
  label: string;
  short: string;
  count: number;
}

export const MASHUP_DURATIONS: MashupDuration[] = [
  { minutes: 30, label: '30 minutes', short: '30m', count: 2 },
  { minutes: 60, label: '1 hour', short: '1h', count: 3 },
  { minutes: 90, label: '1.5 hours', short: '1.5h', count: 4 },
  { minutes: 120, label: '2 hours', short: '2h', count: 5 },
  { minutes: 150, label: '2.5 hours', short: '2.5h', count: 6 },
  { minutes: 180, label: '3 hours', short: '3h', count: 7 },
];

export function mashupCount(minutes: number): number {
  const duration = MASHUP_DURATIONS.find((entry) => entry.minutes === minutes);
  if (duration) return duration.count;
  return Math.max(2, Math.min(7, Math.floor(minutes / 30) + 1));
}

export function mashupCode(problem: ProblemAnalysis): string {
  return problem.contestId == null ? problem.index : `${problem.contestId}/${problem.index}`;
}

export function mashupLine(pick: MashupPick): string {
  return `${pick.slot} - ${mashupCode(pick.problem)}`;
}

export function mashupText(picks: MashupPick[]): string {
  return picks.map(mashupLine).join('\n');
}

function mulberry32(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index--) {
    const swap = Math.floor(random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

/**
 * Builds a mashup from the user's struggles inside the current window.
 * Picks the most severe tiers first, avoids repeating a contest when possible,
 * then orders the chosen problems from easiest to hardest (A → G).
 */
export function buildMashup(problems: ProblemAnalysis[], minutes: number, seed = 1): MashupPick[] {
  const count = mashupCount(minutes);
  const random = mulberry32(seed * 2_654_435_761);
  const groups = new Map<Tier, ProblemAnalysis[]>();
  for (const tier of ACTION_TIERS) groups.set(tier, []);
  for (const problem of problems) {
    if (!ACTION_TIERS.includes(problem.tier)) continue;
    groups.get(problem.tier)?.push(problem);
  }

  const ranked: ProblemAnalysis[] = [];
  for (const tier of ACTION_TIERS) {
    const group = groups.get(tier) ?? [];
    group.sort(
      (a, b) =>
        b.failures - a.failures ||
        a.lastSubmission - b.lastSubmission ||
        a.name.localeCompare(b.name),
    );
    ranked.push(...shuffle(group, random));
  }

  const selected: ProblemAnalysis[] = [];
  const usedContests = new Set<number>();
  for (const problem of ranked) {
    if (selected.length >= count) break;
    if (problem.contestId != null && usedContests.has(problem.contestId)) continue;
    selected.push(problem);
    if (problem.contestId != null) usedContests.add(problem.contestId);
  }
  for (const problem of ranked) {
    if (selected.length >= count) break;
    if (!selected.includes(problem)) selected.push(problem);
  }

  const ordered = [...selected].sort(
    (a, b) =>
      (a.rating ?? Number.MAX_SAFE_INTEGER) - (b.rating ?? Number.MAX_SAFE_INTEGER) ||
      a.name.localeCompare(b.name),
  );

  return ordered.map((problem, index) => ({
    slot: String.fromCharCode(65 + index),
    problem,
  }));
}
