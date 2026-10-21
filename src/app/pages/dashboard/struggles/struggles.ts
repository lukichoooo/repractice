import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import type { Analysis, ProblemAnalysis, Tier } from '../../../core/models';
import {
  ACTION_TIERS,
  matchesRatingFilter,
  tierFor,
  type RatingFilter,
  type StruggleSort,
} from '../../../core/analysis';
import {
  TIER_META,
  formatDate,
  formatDuration,
  formatTime,
  ratingColor,
  submissionUrl,
  timeAgo,
  verdictClass,
  verdictLabel,
  verdictShort,
} from '../../../core/format';

type TierFilter = 'action' | 'all' | Tier;
type CountMode = 'all' | 'pre';

interface FilterChip {
  id: TierFilter;
  label: string;
  count: number;
  color: string;
}

type ProblemView = ProblemAnalysis & {
  viewFailures: number;
  viewTier: Tier;
};

const TIER_PRIORITY: Record<Tier, number> = {
  must: 0,
  should: 1,
  maybe: 2,
  unsolved: 3,
  'tried-once': 4,
  solid: 5,
};

function sortViews(rows: ProblemView[], sort: StruggleSort): ProblemView[] {
  const copy = [...rows];
  switch (sort) {
    case 'failures':
      return copy.sort(
        (a, b) => b.viewFailures - a.viewFailures || a.lastSubmission - b.lastSubmission,
      );
    case 'oldest':
      return copy.sort((a, b) => a.lastSubmission - b.lastSubmission);
    case 'newest':
      return copy.sort((a, b) => b.lastSubmission - a.lastSubmission);
    case 'rating':
      return copy.sort(
        (a, b) => (b.rating ?? -1) - (a.rating ?? -1) || b.viewFailures - a.viewFailures,
      );
    default:
      return copy.sort(
        (a, b) =>
          TIER_PRIORITY[a.viewTier] - TIER_PRIORITY[b.viewTier] ||
          a.lastSubmission - b.lastSubmission ||
          b.viewFailures - a.viewFailures,
      );
  }
}

@Component({
  selector: 'app-struggles',
  templateUrl: './struggles.html',
  styleUrl: './struggles.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StrugglesComponent {
  readonly analysis = input.required<Analysis>();

  readonly search = signal('');
  readonly tierFilter = signal<TierFilter>('action');
  readonly countMode = signal<CountMode>('all');
  readonly sort = signal<StruggleSort>('priority');
  readonly ratingFilter = signal<RatingFilter>('all');
  readonly expanded = signal<string | null>(null);
  readonly limit = signal(50);

  readonly tierMeta = TIER_META;
  readonly timeAgo = timeAgo;
  readonly formatDate = formatDate;
  readonly formatTime = formatTime;
  readonly formatDuration = formatDuration;
  readonly submissionUrl = submissionUrl;
  readonly verdictShort = verdictShort;
  readonly verdictClass = verdictClass;
  readonly verdictLabel = verdictLabel;
  readonly ratingColor = ratingColor;

  /**
   * The graph stores every failure all-time. The table can optionally re-count and
   * re-bucket each problem using only the failures before its first accepted submission.
   */
  readonly views = computed<ProblemView[]>(() => {
    const mode = this.countMode();
    return this.analysis().problems.map((problem) => {
      const viewFailures =
        mode === 'pre' ? problem.failuresBeforeFirstAC : problem.failures;
      return {
        ...problem,
        viewFailures,
        viewTier: tierFor(viewFailures, problem.acs),
      };
    });
  });

  readonly chips = computed<FilterChip[]>(() => {
    const views = this.views();
    const counts: Record<Tier, number> = {
      must: 0,
      should: 0,
      maybe: 0,
      unsolved: 0,
      'tried-once': 0,
      solid: 0,
    };
    for (const view of views) counts[view.viewTier]++;
    const actionCount = ACTION_TIERS.reduce((sum, tier) => sum + counts[tier], 0);

    return [
      { id: 'action', label: 'Needs work', count: actionCount, color: '#5b8def' },
      { id: 'must', label: 'Must redo', count: counts.must, color: TIER_META.must.color },
      {
        id: 'should',
        label: 'Should redo',
        count: counts.should,
        color: TIER_META.should.color,
      },
      {
        id: 'maybe',
        label: 'Maybe redo',
        count: counts.maybe,
        color: TIER_META.maybe.color,
      },
      {
        id: 'unsolved',
        label: 'Never solved',
        count: counts.unsolved,
        color: TIER_META.unsolved.color,
      },
      { id: 'solid', label: 'Solid', count: counts.solid, color: TIER_META.solid.color },
      { id: 'all', label: 'All', count: views.length, color: '#8fa3bf' },
    ];
  });

  readonly filtered = computed(() => {
    const filter = this.tierFilter();
    const query = this.search().trim().toLowerCase();
    const tiers: Tier[] =
      filter === 'all' ? [] : filter === 'action' ? ACTION_TIERS : [filter];

    const rows = this.views().filter((problem) => {
      if (tiers.length && !tiers.includes(problem.viewTier)) return false;
      if (!matchesRatingFilter(problem, this.ratingFilter())) return false;
      if (!query) return true;
      const haystack = [
        problem.name,
        `${problem.contestId}${problem.index}`,
        problem.index,
        ...problem.tags,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });

    return sortViews(rows, this.sort());
  });

  readonly visible = computed(() => this.filtered().slice(0, this.limit()));
  readonly hasMore = computed(() => this.visible().length < this.filtered().length);

  setTier(tier: TierFilter): void {
    this.tierFilter.set(tier);
    this.limit.set(50);
  }

  setSearch(value: string): void {
    this.search.set(value);
    this.limit.set(50);
  }

  setCountMode(mode: CountMode): void {
    this.countMode.set(mode);
    this.limit.set(50);
  }

  setSort(value: string): void {
    this.sort.set(value as StruggleSort);
    this.limit.set(50);
  }

  setRating(value: string): void {
    this.ratingFilter.set(value as RatingFilter);
    this.limit.set(50);
  }

  reset(): void {
    this.search.set('');
    this.tierFilter.set('action');
    this.countMode.set('all');
    this.sort.set('priority');
    this.ratingFilter.set('all');
    this.limit.set(50);
  }

  loadMore(): void {
    this.limit.update((value) => value + 50);
  }

  toggle(key: string): void {
    this.expanded.update((current) => (current === key ? null : key));
  }

  trackProblem(_: number, problem: ProblemView): string {
    return problem.key;
  }

  inputValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  selectValue(event: Event): string {
    return (event.target as HTMLSelectElement).value;
  }

  verdictBadgeClass(verdict?: string): string {
    return `badge badge-${verdictClass(verdict)}`;
  }
}
