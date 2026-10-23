import type { CfProblem, Tier } from './models';

export const TIER_META: Record<
  Tier,
  { label: string; short: string; color: string; description: string; priority: number }
> = {
  must: {
    label: 'Must redo',
    short: 'MUST',
    color: '#ff5d6c',
    description: '10+ failed tries in your latest solve',
    priority: 0,
  },
  should: {
    label: 'Should redo',
    short: 'SHOULD',
    color: '#ffa94d',
    description: '5–9 failed tries in your latest solve',
    priority: 1,
  },
  maybe: {
    label: 'Maybe redo',
    short: 'MAYBE',
    color: '#ffd43b',
    description: '2–4 failed tries in your latest solve',
    priority: 2,
  },
  unsolved: {
    label: 'Never solved',
    short: 'OPEN',
    color: '#c084fc',
    description: 'No accepted solution by the end of the window',
    priority: 3,
  },
  'tried-once': {
    label: 'Tried once',
    short: 'ONCE',
    color: '#8fa3bf',
    description: 'One failed try, not solved',
    priority: 4,
  },
  solid: {
    label: 'Solid',
    short: 'SOLID',
    color: '#3ddc97',
    description: 'Solved with 0–1 failed tries in your latest solve',
    priority: 5,
  },
};

const VERDICT_LABELS: Record<string, string> = {
  OK: 'Accepted',
  WRONG_ANSWER: 'Wrong answer',
  TIME_LIMIT_EXCEEDED: 'Time limit',
  MEMORY_LIMIT_EXCEEDED: 'Memory limit',
  RUNTIME_ERROR: 'Runtime error',
  COMPILATION_ERROR: 'Compilation error',
  IDLENESS_LIMIT_EXCEEDED: 'Idleness limit',
  SECURITY_VIOLATED: 'Security violated',
  CRASHED: 'Crashed',
  INPUT_PREPARATION_CRASHED: 'Input crashed',
  CHALLENGED: 'Challenged',
  SKIPPED: 'Skipped',
  REJECTED: 'Rejected',
  FAILED: 'Failed',
  PARTIAL: 'Partial',
  TESTING: 'Testing',
};

const VERDICT_SHORT: Record<string, string> = {
  OK: 'AC',
  WRONG_ANSWER: 'WA',
  TIME_LIMIT_EXCEEDED: 'TLE',
  MEMORY_LIMIT_EXCEEDED: 'MLE',
  RUNTIME_ERROR: 'RE',
  COMPILATION_ERROR: 'CE',
  IDLENESS_LIMIT_EXCEEDED: 'ILE',
  SECURITY_VIOLATED: 'SV',
  CRASHED: 'CR',
  INPUT_PREPARATION_CRASHED: 'IPC',
  CHALLENGED: 'HACK',
  SKIPPED: 'SKIP',
  REJECTED: 'REJ',
  FAILED: 'FAIL',
  PARTIAL: 'PART',
  TESTING: 'TEST',
};

export function verdictLabel(verdict?: string): string {
  if (!verdict) return 'Testing';
  return VERDICT_LABELS[verdict] ?? verdict.replaceAll('_', ' ').toLowerCase();
}

export function verdictShort(verdict?: string): string {
  if (!verdict) return 'TEST';
  return VERDICT_SHORT[verdict] ?? verdict.slice(0, 4);
}

export function verdictClass(verdict?: string): string {
  if (verdict === 'OK') return 'ac';
  if (verdict === 'WRONG_ANSWER') return 'wa';
  if (verdict === 'TIME_LIMIT_EXCEEDED' || verdict === 'IDLENESS_LIMIT_EXCEEDED') return 'tle';
  if (verdict === 'MEMORY_LIMIT_EXCEEDED') return 'mle';
  if (verdict === 'RUNTIME_ERROR' || verdict === 'CRASHED') return 're';
  if (verdict === 'COMPILATION_ERROR') return 'ce';
  return 'other';
}

export function ratingColor(rating?: number): string {
  if (rating == null) return '#8fa3bf';
  if (rating < 1200) return '#9aa4b2';
  if (rating < 1400) return '#3ddc97';
  if (rating < 1600) return '#4ecdc4';
  if (rating < 1900) return '#4c9aff';
  if (rating < 2100) return '#b388ff';
  if (rating < 2400) return '#ffa94d';
  if (rating < 2600) return '#ff7a45';
  return '#ff5d6c';
}

export function rankLabel(rank?: string): string {
  if (!rank) return 'Unrated';
  return rank
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function timeAgo(ts: number | undefined, now: number): string {
  if (!ts) return 'never';
  const diff = Math.max(0, now - ts * 1000);
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30.44);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(days / 365.25);
  const remMonths = Math.floor((days - years * 365.25) / 30.44);
  if (years >= 5) return `${years}y ago`;
  return remMonths > 0 ? `${years}y ${remMonths}mo ago` : `${years}y ago`;
}

export function daysAgo(ts: number | undefined, now: number): number {
  if (!ts) return Number.MAX_SAFE_INTEGER;
  return Math.max(0, (now - ts * 1000) / 86_400_000);
}

export function formatDate(ts?: number): string {
  if (!ts) return '—';
  return new Date(ts * 1000).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatTime(ts?: number): string {
  if (!ts) return '';
  return new Date(ts * 1000).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatMonth(month: string): string {
  const [year, value] = month.split('-');
  const date = new Date(Number(year), Number(value) - 1, 1);
  return date.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
}

export function formatNumber(value: number): string {
  return Math.round(value).toLocaleString('en-US');
}

export function formatPercent(value: number, digits = 0): string {
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

export function formatMemory(bytes: number): string {
  return `${Math.round(bytes / 1024)} KB`;
}

export function problemUrl(problem: CfProblem): string {
  const { contestId, index } = problem;
  if (contestId == null) return 'https://codeforces.com/problemset';
  if (contestId >= 100000) return `https://codeforces.com/gym/${contestId}/problem/${index}`;
  return `https://codeforces.com/problemset/problem/${contestId}/${index}`;
}

export function submissionUrl(contestId: number | undefined, submissionId: number): string {
  if (contestId == null) return 'https://codeforces.com/submissions';
  if (contestId >= 100000) {
    return `https://codeforces.com/gym/${contestId}/submission/${submissionId}`;
  }
  return `https://codeforces.com/contest/${contestId}/submission/${submissionId}`;
}

export function problemCode(problem: CfProblem): string {
  return problem.contestId == null ? `#${problem.index}` : `${problem.contestId}${problem.index}`;
}

export function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
