import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CfApiError, CfApiService } from '../../core/cf-api.service';
import { CacheService, DATASET_TTL_MS } from '../../core/cache.service';
import { ACTION_TIERS, analyze, tierCount } from '../../core/analysis';
import type { Analysis, Dataset, MonthBounds, TimeWindow } from '../../core/models';
import { addRecentHandle } from '../../core/recent';
import { formatDate, rankLabel, ratingColor, timeAgo } from '../../core/format';
import {
  clampWindow,
  defaultWindow,
  formatWindowLabel,
  hasSubmissionsInWindow,
  monthBounds,
} from '../../core/time-window';
import { WindowPickerComponent } from './window-picker/window-picker';
import { SummaryComponent } from './summary/summary';
import { StrugglesComponent } from './struggles/struggles';
import { MashupComponent } from './mashup/mashup';
import { ProgressComponent } from './progress/progress';

export type TabId = 'summary' | 'struggles' | 'mashup' | 'progress';

interface TabDef {
  id: TabId;
  label: string;
  hint: string;
}

const TABS: TabDef[] = [
  { id: 'summary', label: 'Summary', hint: 'The short version' },
  { id: 'struggles', label: 'Struggles', hint: 'Problems that still need work' },
  { id: 'mashup', label: 'Mashup', hint: 'A timed set from your open struggles' },
  { id: 'progress', label: 'Progress', hint: 'Rating and submissions in this window' },
];

type Status = 'idle' | 'loading' | 'refreshing' | 'ready' | 'error';

@Component({
  selector: 'app-dashboard',
  imports: [
    RouterLink,
    WindowPickerComponent,
    SummaryComponent,
    StrugglesComponent,
    MashupComponent,
    ProgressComponent,
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(CfApiService);
  private readonly cache = inject(CacheService);

  readonly tabs = TABS;
  readonly handle = signal('');
  readonly dataset = signal<Dataset | null>(null);
  readonly status = signal<Status>('idle');
  readonly error = signal<string | null>(null);
  readonly progress = signal('');
  readonly activeTab = signal<TabId>('summary');
  readonly avatarFailed = signal(false);
  readonly now = signal(Date.now());
  readonly timeWindow = signal<TimeWindow | null>(null);
  readonly fallbackNotice = signal(false);

  private loadSequence = 0;

  readonly bounds = computed<MonthBounds | null>(() => {
    const dataset = this.dataset();
    return dataset ? monthBounds(dataset.submissions, this.now()) : null;
  });

  readonly analysis = computed<Analysis | null>(() => {
    const dataset = this.dataset();
    if (!dataset) return null;
    return analyze(dataset, this.now(), this.timeWindow());
  });

  readonly windowLabel = computed(() => {
    const analysis = this.analysis();
    if (!analysis) return '';
    return analysis.allTime ? 'All time' : formatWindowLabel(analysis.window);
  });

  readonly windowEmpty = computed(() => {
    const analysis = this.analysis();
    return !!analysis && analysis.totals.submissions === 0;
  });

  readonly busy = computed(() => this.status() === 'loading' || this.status() === 'refreshing');

  readonly actionCount = computed(() => {
    const analysis = this.analysis();
    return analysis ? tierCount(analysis, ACTION_TIERS) : 0;
  });

  readonly rank = computed(() => rankLabel(this.dataset()?.user.rank));
  readonly rating = computed(
    () => this.analysis()?.totals.currentRating ?? this.dataset()?.user.rating,
  );
  readonly maxRating = computed(
    () => this.analysis()?.totals.maxRating ?? this.dataset()?.user.maxRating,
  );
  readonly ratingColor = computed(() => ratingColor(this.rating()));
  readonly avatarUrl = computed(() => {
    if (this.avatarFailed()) return null;
    const user = this.dataset()?.user;
    return user?.titlePhoto || user?.avatar || null;
  });
  readonly initials = computed(() => this.handle().slice(0, 2).toUpperCase());
  readonly updatedLabel = computed(() => {
    const dataset = this.dataset();
    const analysis = this.analysis();
    if (!dataset || !analysis) return '';
    return timeAgo(dataset.fetchedAt / 1000, analysis.now);
  });
  readonly memberSince = computed(() => {
    const user = this.dataset()?.user;
    return user ? formatDate(user.registrationTimeSeconds) : '—';
  });

  readonly timeAgo = timeAgo;

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const handle = (params.get('handle') ?? '').trim();
      if (!handle) {
        void this.router.navigate(['/']);
        return;
      }
      this.handle.set(handle);
      this.activeTab.set('summary');
      this.timeWindow.set(null);
      this.fallbackNotice.set(false);
      void this.load(handle);
    });
  }

  setTab(tab: TabId): void {
    this.activeTab.set(tab);
  }

  setWindow(window: TimeWindow): void {
    this.timeWindow.set(window);
    this.fallbackNotice.set(false);
  }

  showAllTime(): void {
    const bounds = this.bounds();
    if (!bounds) return;
    this.timeWindow.set({ start: bounds.min, end: bounds.max });
    this.fallbackNotice.set(false);
  }

  refresh(): void {
    void this.load(this.handle(), true);
  }

  retry(): void {
    void this.load(this.handle(), true);
  }

  openProfile(): void {
    window.open(
      `https://codeforces.com/profile/${encodeURIComponent(this.handle())}`,
      '_blank',
      'noopener',
    );
  }

  private initializeWindow(dataset: Dataset): void {
    const now = Date.now();
    this.now.set(now);
    const bounds = monthBounds(dataset.submissions, now);
    const existing = this.timeWindow();
    if (existing) {
      this.timeWindow.set(clampWindow(existing, bounds));
      this.fallbackNotice.set(false);
      return;
    }
    const defaultRange = defaultWindow(bounds, bounds.max);
    const allTime = { start: bounds.min, end: bounds.max };
    const hasDefaultData = hasSubmissionsInWindow(dataset.submissions, defaultRange);
    const usedFallback =
      !hasDefaultData &&
      dataset.submissions.length > 0 &&
      !(defaultRange.start === allTime.start && defaultRange.end === allTime.end);

    this.timeWindow.set(usedFallback ? allTime : defaultRange);
    this.fallbackNotice.set(usedFallback);
  }

  private async load(rawHandle: string, force = false): Promise<void> {
    const handle = rawHandle.trim();
    if (!handle) return;
    const sequence = ++this.loadSequence;

    this.error.set(null);
    this.avatarFailed.set(false);

    const cached = await this.cache.getDataset(handle);
    if (sequence !== this.loadSequence) return;

    if (cached) {
      this.initializeWindow(cached);
      this.dataset.set(cached);
      document.title = `${cached.handle} — Codeforces Repractice`;
      const age = Date.now() - cached.fetchedAt;
      if (!force && age < DATASET_TTL_MS) {
        this.status.set('ready');
        return;
      }
      this.status.set('refreshing');
      this.progress.set('Checking Codeforces for newer submissions…');
    } else {
      this.dataset.set(null);
      this.status.set('loading');
      this.progress.set('Looking up your Codeforces profile…');
    }

    try {
      const user = await this.api.getUserInfo(handle);
      if (sequence !== this.loadSequence) return;

      this.progress.set('Downloading your submission history…');
      const submissions = await this.api.getSubmissions(user.handle, (loaded, page) => {
        if (sequence !== this.loadSequence) return;
        this.progress.set(
          page > 1
            ? `Downloading submissions — ${loaded.toLocaleString('en-US')} so far…`
            : 'Downloading your submission history…',
        );
      });
      if (sequence !== this.loadSequence) return;

      this.progress.set('Loading rating history…');
      const ratingHistory = await this.api.getRatingHistory(user.handle);
      if (sequence !== this.loadSequence) return;

      const dataset: Dataset = {
        handle: user.handle,
        user,
        submissions,
        ratingHistory,
        fetchedAt: Date.now(),
      };
      await this.cache.putDataset(dataset);
      if (sequence !== this.loadSequence) return;

      this.initializeWindow(dataset);
      this.dataset.set(dataset);
      this.status.set('ready');
      this.progress.set('');
      document.title = `${user.handle} — Codeforces Repractice`;
      addRecentHandle(user.handle);
    } catch (error) {
      if (sequence !== this.loadSequence) return;
      this.error.set(
        error instanceof CfApiError
          ? error.message
          : 'Something went wrong while talking to Codeforces. Please try again.',
      );
      this.status.set(this.dataset() ? 'ready' : 'error');
      this.progress.set('');
    }
  }

  protected readonly trackTab = (_: number, tab: TabDef) => tab.id;
}
