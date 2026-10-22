import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import type { Analysis } from '../../../core/models';
import { ACTION_TIERS, sortProblems } from '../../../core/analysis';
import { TIER_META, formatNumber, formatPercent, ratingColor, timeAgo } from '../../../core/format';
import { formatMonthLong } from '../../../core/time-window';

type QuickTab = 'struggles' | 'mashup';

@Component({
  selector: 'app-summary',
  templateUrl: './summary.html',
  styleUrl: './summary.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SummaryComponent {
  readonly analysis = input.required<Analysis>();
  readonly openTab = output<QuickTab>();

  readonly tierMeta = TIER_META;
  readonly formatNumber = formatNumber;
  readonly formatPercent = formatPercent;
  readonly ratingColor = ratingColor;
  readonly timeAgo = timeAgo;

  readonly endMonth = computed(() => formatMonthLong(this.analysis().window.end));

  readonly topStruggles = computed(() => {
    const problems = this.analysis().problems.filter((problem) =>
      ACTION_TIERS.includes(problem.tier),
    );
    return sortProblems(problems, 'priority').slice(0, 6);
  });

  readonly weakTags = computed(() =>
    this.analysis()
      .tags.filter((tag) => tag.problems >= 2 && tag.failures > 0)
      .slice(0, 3),
  );
}
