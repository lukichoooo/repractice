import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type {
  CfProblemStatistics,
  CfProblemset,
  CfRatingChange,
  CfResponse,
  CfSubmission,
  CfUserInfo,
} from './models';

const API_ROOT = 'https://codeforces.com/api';
const MIN_GAP_MS = 2100;
const PAGE_SIZE = 10_000;
const MAX_PAGES = 12;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class CfApiError extends Error {
  constructor(
    message: string,
    readonly comment = '',
    readonly retryable = false,
  ) {
    super(message);
    this.name = 'CfApiError';
  }
}

function friendlyMessage(comment: string): string {
  const lower = comment.toLowerCase();
  if (lower.includes('not found')) {
    return "We couldn't find that Codeforces handle. Check the spelling and try again.";
  }
  if (lower.includes('limit')) {
    return 'Codeforces is rate-limiting requests right now. Please wait a moment and try again.';
  }
  if (lower.includes('invalid')) {
    return 'Codeforces rejected that handle. Please check it and try again.';
  }
  if (lower.includes('unavailable')) {
    return 'Codeforces is temporarily unavailable. Please try again in a moment.';
  }
  return comment.replace(/^handle:\s*/i, '') || 'Codeforces returned an unexpected error.';
}

function isCfFailure(value: unknown): value is { status: 'FAILED'; comment: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'status' in value &&
    (value as { status?: unknown }).status === 'FAILED'
  );
}

@Injectable({ providedIn: 'root' })
export class CfApiService {
  private readonly http = inject(HttpClient);
  private tail: Promise<unknown> = Promise.resolve();
  private lastStarted = 0;

  getUserInfo(handle: string): Promise<CfUserInfo> {
    return this.request<CfUserInfo[]>('user.info', {
      handles: handle,
    }).then((users) => {
      const user = users[0];
      if (!user) throw new CfApiError("We couldn't find that Codeforces handle.");
      return user;
    });
  }

  async getSubmissions(
    handle: string,
    onProgress?: (loaded: number, page: number) => void,
  ): Promise<CfSubmission[]> {
    const all: CfSubmission[] = [];
    for (let page = 1; page <= MAX_PAGES; page++) {
      const from = (page - 1) * PAGE_SIZE + 1;
      const batch = await this.request<CfSubmission[]>('user.status', {
        handle,
        from,
        count: PAGE_SIZE,
      });
      all.push(...batch);
      onProgress?.(all.length, page);
      if (batch.length < PAGE_SIZE) break;
    }
    return all;
  }

  async getRatingHistory(handle: string): Promise<CfRatingChange[]> {
    try {
      return await this.request<CfRatingChange[]>('user.rating', { handle });
    } catch {
      return [];
    }
  }

  async getProblemset(): Promise<CfProblemset> {
    return this.request<CfProblemset>('problemset.problems', {});
  }

  /**
   * A single global queue keeps us inside Codeforces' 1 request / 2 seconds limit,
   * even when several parts of the UI ask for data at the same time.
   */
  private request<T>(method: string, input: Record<string, string | number>): Promise<T> {
    const run = async (): Promise<T> => {
      let attempt = 0;
      for (;;) {
        const wait = Math.max(0, MIN_GAP_MS - (Date.now() - this.lastStarted));
        if (wait > 0) await sleep(wait);
        this.lastStarted = Date.now();

        try {
          return await this.fetchOnce<T>(method, input);
        } catch (error) {
          if (error instanceof CfApiError && error.retryable && attempt < 2) {
            attempt++;
            await sleep(2200);
            continue;
          }
          if (!(error instanceof CfApiError) && attempt < 1) {
            attempt++;
            await sleep(1200);
            continue;
          }
          if (error instanceof CfApiError) throw error;
          throw new CfApiError(
            'Could not reach Codeforces. Check your connection and try again.',
          );
        }
      }
    };

    const task = this.tail.then(run, run);
    this.tail = task.then(
      () => undefined,
      () => undefined,
    );
    return task;
  }

  private async fetchOnce<T>(
    method: string,
    input: Record<string, string | number>,
  ): Promise<T> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(input)) {
      params = params.set(key, String(value));
    }

    try {
      const response = await firstValueFrom(
        this.http.get<CfResponse<T>>(`${API_ROOT}/${method}`, { params }),
      );
      if (response.status === 'OK') return response.result;
      throw new CfApiError(
        friendlyMessage(response.comment),
        response.comment,
        response.comment.toLowerCase().includes('limit'),
      );
    } catch (error) {
      if (error instanceof CfApiError) throw error;
      if (error instanceof HttpErrorResponse && isCfFailure(error.error)) {
        throw new CfApiError(
          friendlyMessage(error.error.comment),
          error.error.comment,
          error.error.comment.toLowerCase().includes('limit'),
        );
      }
      throw error;
    }
  }
}

export type SolveCounts = Map<string, number>;
export type { CfProblemStatistics, CfProblemset };
