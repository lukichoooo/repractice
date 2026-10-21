import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { Analysis } from '../../../core/models';
import { activityOptions, ratingOptions } from '../../../core/chart-options';
import {
  formatDate,
  formatNumber,
  formatPercent,
  rankLabel,
  ratingColor,
} from '../../../core/format';
import { ChartComponent } from '../../../shared/chart/chart';

@Component({
  selector: 'app-activity',
  imports: [ChartComponent],
  templateUrl: './activity.html',
  styleUrl: './activity.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActivityComponent {
  readonly analysis = input.required<Analysis>();

  readonly formatNumber = formatNumber;
  readonly formatPercent = formatPercent;
  readonly formatDate = formatDate;
  readonly ratingColor = ratingColor;
  readonly rankLabel = rankLabel;

  readonly chartRating = computed(() => ratingOptions(this.analysis().ratingHistory));
  readonly chartActivity = computed(() => activityOptions(this.analysis().activity));

  readonly lastContest = computed(() => {
    const history = this.analysis().ratingHistory;
    return history.length ? history[history.length - 1] : null;
  });

  readonly peakRating = computed(() => {
    const history = this.analysis().ratingHistory;
    const currentMax = this.analysis().totals.maxRating ?? 0;
    return Math.max(currentMax, ...history.map((change) => change.newRating));
  });

  readonly contests = computed(() => this.analysis().ratingHistory.length);

  readonly totalSubmissionsPerYear = computed(() => {
    const max = Math.max(1, ...this.analysis().years.map((year) => year.submissions));
    return max;
  });
}
