import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { CfApiError, CfApiService } from '../../../core/cf-api.service';
import { CacheService } from '../../../core/cache.service';
import type { Analysis, CfProblemset, Recommendation } from '../../../core/models';
import { formatNumber, problemUrl, ratingColor } from '../../../core/format';

@Component({
  selector: 'app-practice',
  templateUrl: './practice.html',
  styleUrl: './practice.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PracticeComponent {
  private readonly api = inject(CfApiService);
  private readonly cache = inject(CacheService);

  readonly analysis = input.required<Analysis>();

  readonly problemset = signal<CfProblemset | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly targetShift = signal(0);
  readonly seed = signal(0);

  readonly formatNumber = formatNumber;
  readonly ratingColor = ratingColor;

  readonly weakTags = computed(() =>
    this.analysis()
      .tags.filter((tag) => tag.problems >= 2 && tag.failures > 0)
      .slice(0, 6),
  );

  readonly baseRating = computed(() => {
    const analysis = this.analysis();
    if (analysis.totals.currentRating) return analysis.totals.currentRating;
    const solvedRatings = analysis.problems
      .filter((problem) => problem.acs > 0 && problem.rating != null)
      .map((problem) => problem.rating as number)
      .sort((a, b) => a - b);
    return solvedRatings.length ? solvedRatings[Math.floor(solvedRatings.length / 2)] : 1400;
  });

  readonly targetRating = computed(() => this.baseRating() + this.targetShift());

  readonly recommendations = computed<Recommendation[]>(() => {
    const problemset = this.problemset();
    if (!problemset) return [];

    const analysis = this.analysis();
    const attempted = new Set(analysis.problems.map((problem) => problem.key));
    const weak = new Set(this.weakTags().map((tag) => tag.tag));
    const target = this.targetRating();
    const solvedCounts = new Map<string, number>();
    for (const statistic of problemset.problemStatistics) {
      solvedCounts.set(`${statistic.contestId}-${statistic.index}`, statistic.solvedCount);
    }

    const matched: Recommendation[] = [];
    const fallback: Recommendation[] = [];

    for (const problem of problemset.problems) {
      if (problem.contestId == null || problem.rating == null) continue;
      const key = `${problem.contestId}-${problem.index}`;
      if (attempted.has(key)) continue;
      const distance = Math.abs(problem.rating - target);
      if (distance > 320) continue;

      const matchedTags = problem.tags.filter((tag) => weak.has(tag));
      const solvedCount = solvedCounts.get(key) ?? 0;
      const recommendation: Recommendation = {
        problem,
        solvedCount,
        url: problemUrl(problem),
        matchedTags,
        distance,
      };
      fallback.push(recommendation);
      if (matchedTags.length) matched.push(recommendation);
    }

    const score = (recommendation: Recommendation) =>
      recommendation.matchedTags.length * 100 -
      recommendation.distance * 0.15 +
      Math.log10(recommendation.solvedCount + 2) * 4;

    const pool = matched.length >= 6 ? matched : fallback;
    pool.sort((a, b) => score(b) - score(a));

    const limit = Math.min(pool.length, 60);
    const offset = limit > 0 ? (this.seed() * 9) % limit : 0;
    const rotated = [...pool.slice(offset), ...pool.slice(0, offset)];
    return rotated.slice(0, 9);
  });

  constructor() {
    void this.loadProblemset();
  }

  setShift(shift: number): void {
    this.targetShift.set(shift);
    this.seed.set(0);
  }

  newPicks(): void {
    this.seed.update((value) => value + 1);
  }

  surpriseMe(): void {
    const picks = this.recommendations();
    if (!picks.length) return;
    const pick = picks[Math.floor(Math.random() * picks.length)];
    window.open(pick.url, '_blank', 'noopener');
  }

  retry(): void {
    void this.loadProblemset(true);
  }

  private async loadProblemset(force = false): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    if (!force) {
      const cached = await this.cache.getProblemset();
      if (cached) {
        this.problemset.set(cached);
        this.loading.set(false);
        return;
      }
    }

    try {
      const data = await this.api.getProblemset();
      this.problemset.set(data);
      await this.cache.putProblemset(data);
    } catch (error) {
      this.error.set(
        error instanceof CfApiError
          ? error.message
          : 'Could not load the Codeforces problemset. Please try again.',
      );
    } finally {
      this.loading.set(false);
    }
  }
}
