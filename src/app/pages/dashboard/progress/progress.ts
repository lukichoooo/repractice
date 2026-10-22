import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { Analysis } from '../../../core/models';
import { activityOptions, ratingOptions } from '../../../core/chart-options';
import { formatDate, formatNumber, rankLabel, ratingColor } from '../../../core/format';
import { formatMonthLong, formatWindowLabel, monthCountLabel } from '../../../core/time-window';
import { ChartComponent } from '../../../shared/chart/chart';

@Component({
  selector: 'app-progress',
  imports: [ChartComponent],
  templateUrl: './progress.html',
  styleUrl: './progress.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProgressComponent {
  readonly analysis = input.required<Analysis>();

  readonly formatNumber = formatNumber;
  readonly formatDate = formatDate;
  readonly ratingColor = ratingColor;
  readonly rankLabel = rankLabel;

  readonly chartRating = computed(() => ratingOptions(this.analysis().ratingHistory));
  readonly chartActivity = computed(() => activityOptions(this.analysis().activity));

  readonly lastContest = computed(() => {
    const history = this.analysis().ratingHistory;
    return history.length ? history[history.length - 1] : null;
  });

  readonly windowLabel = computed(() => {
    const analysis = this.analysis();
    return analysis.allTime ? 'all time' : formatWindowLabel(analysis.window);
  });

  readonly endMonthLabel = computed(() => formatMonthLong(this.analysis().window.end));

  readonly monthsLabel = computed(() => {
    const months = this.analysis().totals.windowMonths;
    return months == null ? 'all downloaded months' : `across ${monthCountLabel(months)}`;
  });

  readonly ratingChange = computed(() => {
    const history = this.analysis().ratingHistory;
    if (!history.length) return null;
    return history[history.length - 1].newRating - history[0].oldRating;
  });
}
