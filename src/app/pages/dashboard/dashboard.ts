import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CfApiError, CfApiService } from '../../core/cf-api.service';
import { CacheService, DATASET_TTL_MS } from '../../core/cache.service';
import { ACTION_TIERS, analyze, tierCount } from '../../core/analysis';
import type { Analysis, Dataset } from '../../core/models';
import { addRecentHandle } from '../../core/recent';
import { formatDate, rankLabel, ratingColor, timeAgo } from '../../core/format';
import { OverviewComponent } from './overview/overview';
import { StrugglesComponent } from './struggles/struggles';
import { TopicsComponent } from './topics/topics';
import { ActivityComponent } from './activity/activity';
import { PracticeComponent } from './practice/practice';

export type TabId = 'overview' | 'struggles' | 'topics' | 'activity' | 'practice';

interface TabDef {
  id: TabId;
  label: string;
  hint: string;
}

const TABS: TabDef[] = [
  { id: 'overview', label: 'Overview', hint: 'Summary and insights' },
  { id: 'struggles', label: 'Struggles', hint: 'Problems that took too many tries' },
  { id: 'topics', label: 'Topics', hint: 'Tags, verdicts and difficulty' },
  { id: 'activity', label: 'Activity', hint: 'Rating and submission history' },
  { id: 'practice', label: 'Practice', hint: 'Fresh problems matched to you' },
];

type Status = 'idle' | 'loading' | 'refreshing' | 'ready' | 'error';

@Component({
  selector: 'app-dashboard',
  imports: [
    OverviewComponent,
    StrugglesComponent,
    TopicsComponent,
    ActivityComponent,
    PracticeComponent,
    RouterLink,
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
  readonly activeTab = signal<TabId>('overview');
  readonly avatarFailed = signal(false);

  private loadSequence = 0;

  readonly analysis = computed<Analysis | null>(() => {
    const dataset = this.dataset();
    return dataset ? analyze(dataset, Date.now()) : null;
  });

  readonly busy = computed(
    () => this.status() === 'loading' || this.status() === 'refreshing',
  );

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
      this.activeTab.set('overview');
      void this.load(handle);
    });
  }

  setTab(tab: TabId): void {
    this.activeTab.set(tab);
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

  private async load(rawHandle: string, force = false): Promise<void> {
    const handle = rawHandle.trim();
    if (!handle) return;
    const sequence = ++this.loadSequence;

    this.error.set(null);
    this.avatarFailed.set(false);

    const cached = await this.cache.getDataset(handle);
    if (sequence !== this.loadSequence) return;

    if (cached) {
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
