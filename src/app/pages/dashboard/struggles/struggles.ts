import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import type { Analysis, ProblemAnalysis, Tier } from '../../../core/models';
import { ACTION_TIERS, sortProblems, type StruggleSort } from '../../../core/analysis';
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
import { formatMonthLong } from '../../../core/time-window';
  
type TierFilter = 'needs' | 'all' | Tier;
 
interface FilterChip {
  id: TierFilter;
  label: string;
  count: number;
  color: string;
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
  readonly tierFilter = signal<TierFilter>('needs');
  readonly sort = signal<StruggleSort>('priority');
  readonly expanded = signal<string | null>(null);
  readonly limit = signal(50);
  readonly ratingFilter = signal<{ min: number; max: number }>({ min: 0, max: 1800 });
  
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
  
  readonly endMonth = computed(() => formatMonthLong(this.analysis().window.end));
  
  readonly chips = computed<FilterChip[]>(() => {
    const problems = this.analysis().problems;
    const counts: Record<Tier, number> = {
      must: 0,
      should: 0,
      maybe: 0,
      unsolved: 0,
      'tried-once': 0,
      solid: 0,
    };
    for (const problem of problems) counts[problem.tier]++;
    const needs = ACTION_TIERS.reduce((sum, tier) => sum + counts[tier], 0);
  
    return [
      { id: 'needs', label: 'Needs work', count: needs, color: '#5b8def' },
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
        count: counts.unsolved + counts['tried-once'],
        color: TIER_META.unsolved.color,
      },
      { id: 'all', label: 'All', count: problems.length, color: '#8fa3bf' },
    ];
  });
  
  readonly filtered = computed<ProblemAnalysis[]>(() => {
    const filter = this.tierFilter();
    const query = this.search().trim().toLowerCase();
    const tiers: Tier[] = filter === 'all'
      ? []
      : filter === 'needs'
        ? ACTION_TIERS
        : filter === 'unsolved'
          ? ['unsolved', 'tried-once']
          : [filter];
      
    const rows = this.analysis().problems.filter((problem) => {
      if (tiers.length && !tiers.includes(problem.tier)) return false;
      if (!query) return true;
      const haystack = [
        problem.name,
        `${problem.contestId}${problem.index}`,
        problem.index,
        ...problem.tags,
      ].join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  
    return sortProblems(rows, this.sort());
  });
  
  readonly visible = computed<ProblemAnalysis[]>(() => this.filtered().slice(0, this.limit()));
  readonly hasMore = computed(() => this.visible().length < this.filtered().length);
  
  setTier(tier: TierFilter): void {
    this.tierFilter.set(tier);
    this.limit.set(50);
  }
  
  setSearch(value: string): void {
    this.search.set(value);
    this.limit.set(50);
  }
  
  setSort(value: string): void {
    this.sort.set(value as StruggleSort);
    this.limit.set(50);
  }
  
  reset(): void {
    this.search.set('');
    this.tierFilter.set('needs');
    this.sort.set('priority');
    this.limit.set(50);
  }
  
  loadMore(): void {
    this.limit.update((value) => value + 50);
  }
  
  toggle(key: string): void {
    this.expanded.update((current) => (current === key ? null : key));
  }
  
  trackProblem(_: number, problem: ProblemAnalysis): string {
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