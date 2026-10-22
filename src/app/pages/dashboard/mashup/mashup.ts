import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import type { Analysis, MashupPick } from '../../../core/models';
import { ACTION_TIERS } from '../../../core/analysis';
import {
  MASHUP_DURATIONS,
  buildMashup,
  mashupCode,
  mashupCount,
  mashupText,
} from '../../../core/mashup';
import { TIER_META, ratingColor } from '../../../core/format';
import { formatWindowLabel } from '../../../core/time-window';

@Component({
  selector: 'app-mashup',
  templateUrl: './mashup.html',
  styleUrl: './mashup.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MashupComponent {
  readonly analysis = input.required<Analysis>();

  readonly minutes = signal(90);
  readonly seed = signal(1);
  readonly copied = signal(false);

  readonly durations = MASHUP_DURATIONS;
  readonly tierMeta = TIER_META;
  readonly ratingColor = ratingColor;
  readonly mashupCode = mashupCode;

  readonly pool = computed(() =>
    this.analysis().problems.filter((problem) => ACTION_TIERS.includes(problem.tier)),
  );
  readonly count = computed(() => mashupCount(this.minutes()));
  readonly picks = computed(() => buildMashup(this.pool(), this.minutes(), this.seed()));
  readonly copyText = computed(() => mashupText(this.picks()));
  readonly windowLabel = computed(() => {
    const analysis = this.analysis();
    return analysis.allTime ? 'all time' : formatWindowLabel(analysis.window);
  });

  availableProblems(requested: number): number {
    return Math.min(requested, this.pool().length);
  }

  setMinutes(minutes: number): void {
    this.minutes.set(minutes);
    this.copied.set(false);
  }

  regenerate(): void {
    this.seed.update((value) => value + 1);
    this.copied.set(false);
  }

  async copy(): Promise<void> {
    const text = this.copyText();
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      textarea.remove();
    }

    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 1800);
  }

  trackPick(_: number, pick: MashupPick): string {
    return pick.slot;
  }
}
