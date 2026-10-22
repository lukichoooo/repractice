import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import type { MonthBounds, TimeWindow } from '../../../core/models';
import {
  WINDOW_PRESETS,
  allTimeWindow,
  clampWindow,
  formatMonthLong,
  monthAgeLabel,
  monthRange,
  presetWindow,
} from '../../../core/time-window';

function sameWindow(a: TimeWindow, b: TimeWindow): boolean {
  return a.start === b.start && a.end === b.end;
}

@Component({
  selector: 'app-window-picker',
  templateUrl: './window-picker.html',
  styleUrl: './window-picker.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WindowPickerComponent {
  readonly bounds = input.required<MonthBounds>();
  readonly window = input.required<TimeWindow>();
  readonly fallback = input(false);
  readonly windowChange = output<TimeWindow>();

  readonly months = computed(() => monthRange(this.bounds().min, this.bounds().max));
  readonly referenceMonth = computed(() => this.bounds().max);
  readonly startIndex = computed(() => {
    const index = this.months().indexOf(this.window().start);
    return index < 0 ? 0 : index;
  });
  readonly endIndex = computed(() => {
    const index = this.months().indexOf(this.window().end);
    return index < 0 ? this.months().length - 1 : index;
  });
  readonly startLabel = computed(() => formatMonthLong(this.window().start));
  readonly endLabel = computed(() => formatMonthLong(this.window().end));
  readonly startAge = computed(() => monthAgeLabel(this.window().start, this.referenceMonth()));
  readonly endAge = computed(() => monthAgeLabel(this.window().end, this.referenceMonth()));
  readonly monthCount = computed(() => this.endIndex() - this.startIndex() + 1);
  readonly startPercent = computed(() => {
    const last = this.months().length - 1;
    return last <= 0 ? 0 : (this.startIndex() / last) * 100;
  });
  readonly endPercent = computed(() => {
    const last = this.months().length - 1;
    return last <= 0 ? 100 : (this.endIndex() / last) * 100;
  });
  readonly firstMonthLabel = computed(() => formatMonthLong(this.bounds().min));
  readonly lastMonthLabel = computed(() => formatMonthLong(this.bounds().max));

  readonly presetState = computed(() =>
    WINDOW_PRESETS.map((preset) => {
      const target =
        preset.months == null
          ? allTimeWindow(this.bounds())
          : presetWindow(this.bounds(), preset.months, this.bounds().max);
      return {
        ...preset,
        active: sameWindow(this.window(), target),
      };
    }),
  );

  private lastIndex(): number {
    return this.months().length - 1;
  }

  private clampIndex(value: string): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 0;
    return Math.max(0, Math.min(this.lastIndex(), Math.round(parsed)));
  }

  setStart(value: string): void {
    const index = Math.min(this.clampIndex(value), this.endIndex());
    this.emit(index, this.endIndex());
  }

  setEnd(value: string): void {
    const index = Math.max(this.clampIndex(value), this.startIndex());
    this.emit(this.startIndex(), index);
  }

  applyPreset(months: number | null): void {
    const next =
      months == null
        ? allTimeWindow(this.bounds())
        : presetWindow(this.bounds(), months, this.bounds().max);
    this.windowChange.emit(next);
  }

  private emit(start: number, end: number): void {
    const months = this.months();
    this.windowChange.emit(clampWindow({ start: months[start], end: months[end] }, this.bounds()));
  }

  inputValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }
}
