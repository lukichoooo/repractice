import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { Analysis } from '../../../core/models';
import { difficultyOptions, tagOptions, verdictOptions } from '../../../core/chart-options';
import { formatNumber, formatPercent, verdictLabel, verdictShort } from '../../../core/format';
import { ChartComponent } from '../../../shared/chart/chart';

@Component({
  selector: 'app-topics',
  imports: [ChartComponent],
  templateUrl: './topics.html',
  styleUrl: './topics.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TopicsComponent {
  readonly analysis = input.required<Analysis>();

  readonly formatNumber = formatNumber;
  readonly formatPercent = formatPercent;
  readonly verdictLabel = verdictLabel;
  readonly verdictShort = verdictShort;

  readonly chartTags = computed(() => tagOptions(this.analysis().tags));
  readonly chartVerdicts = computed(() => verdictOptions(this.analysis().verdicts));
  readonly chartDifficulty = computed(() => difficultyOptions(this.analysis().problems));

  readonly weakTags = computed(() =>
    this.analysis().tags.filter((tag) => tag.problems >= 2).slice(0, 10),
  );

  readonly strongestTags = computed(() =>
    [...this.analysis().tags]
      .filter((tag) => tag.problems >= 3)
      .sort((a, b) => a.weakScore - b.weakScore)
      .slice(0, 4),
  );

  readonly topVerdicts = computed(() => this.analysis().verdicts.slice(0, 6));
}
