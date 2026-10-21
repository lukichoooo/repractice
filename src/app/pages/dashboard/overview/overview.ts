import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import type { Analysis, Tier } from '../../../core/models';
import { ACTION_TIERS, sortProblems } from '../../../core/analysis';
import {
  TIER_META,
  formatDate,
  formatNumber,
  formatPercent,
  ratingColor,
  timeAgo,
} from '../../../core/format';

type QuickTab = 'struggles' | 'topics' | 'practice';

@Component({
  selector: 'app-overview',
  templateUrl: './overview.html',
  styleUrl: './overview.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OverviewComponent {
  readonly analysis = input.required<Analysis>();
  readonly openTab = output<QuickTab>();

  readonly tierMeta = TIER_META;
  readonly timeAgo = timeAgo;
  readonly formatNumber = formatNumber;
  readonly formatPercent = formatPercent;
  readonly formatDate = formatDate;
  readonly ratingColor = ratingColor;

  readonly topStruggles = computed(() => {
    const problems = this.analysis().problems.filter((problem) =>
      ACTION_TIERS.includes(problem.tier),
    );
    return sortProblems(problems, 'priority').slice(0, 6);
  });

  readonly weakTags = computed(() =>
    this.analysis()
      .tags.filter((tag) => tag.problems >= 2)
      .slice(0, 5),
  );

  readonly segments = computed(() => {
    const analysis = this.analysis();
    const total = analysis.totals.attempts || 1;
    const tiers: { tier: Tier; count: number }[] = [
      { tier: 'must', count: analysis.tierCounts.must },
      { tier: 'should', count: analysis.tierCounts.should },
      { tier: 'maybe', count: analysis.tierCounts.maybe },
      { tier: 'unsolved', count: analysis.tierCounts.unsolved },
      { tier: 'tried-once', count: analysis.tierCounts['tried-once'] },
      { tier: 'solid', count: analysis.tierCounts.solid },
    ];
    return tiers
      .filter((segment) => segment.count > 0)
      .map((segment) => ({
        ...segment,
        share: (segment.count / total) * 100,
      }));
  });

  readonly contestRatio = computed(() => {
    const analysis = this.analysis();
    const total = analysis.contest.submissions + analysis.practice.submissions || 1;
    return {
      contest: (analysis.contest.submissions / total) * 100,
      practice: (analysis.practice.submissions / total) * 100,
    };
  });

  go(tab: QuickTab): void {
    this.openTab.emit(tab);
  }
}
