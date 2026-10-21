import { Injectable } from '@angular/core';
import { get, set } from 'idb-keyval';
import type { CfProblemset, Dataset } from './models';

export const DATASET_TTL_MS = 60 * 60 * 1000;
export const PROBLEMSET_TTL_MS = 24 * 60 * 60 * 1000;

const DATASET_VERSION = 1;
const PROBLEMSET_VERSION = 1;
const PREFIX = 'cf-repractice:';

interface StoredDataset {
  version: number;
  dataset: Dataset;
}

interface StoredProblemset {
  version: number;
  fetchedAt: number;
  data: CfProblemset;
}

@Injectable({ providedIn: 'root' })
export class CacheService {
  async getDataset(handle: string): Promise<Dataset | null> {
    try {
      const stored = await get<StoredDataset>(key(handle));
      if (!stored || stored.version !== DATASET_VERSION) return null;
      return stored.dataset;
    } catch {
      return null;
    }
  }

  async putDataset(dataset: Dataset): Promise<void> {
    try {
      await set(key(dataset.handle), {
        version: DATASET_VERSION,
        dataset,
      } satisfies StoredDataset);
    } catch {
      // IndexedDB can be unavailable (private mode, quota). The app still works in memory.
    }
  }

  async getProblemset(): Promise<CfProblemset | null> {
    try {
      const stored = await get<StoredProblemset>(`${PREFIX}problemset`);
      if (!stored || stored.version !== PROBLEMSET_VERSION) return null;
      if (Date.now() - stored.fetchedAt > PROBLEMSET_TTL_MS) return null;
      return stored.data;
    } catch {
      return null;
    }
  }

  async putProblemset(data: CfProblemset): Promise<void> {
    try {
      await set(`${PREFIX}problemset`, {
        version: PROBLEMSET_VERSION,
        fetchedAt: Date.now(),
        data,
      } satisfies StoredProblemset);
    } catch {
      // Non-critical cache.
    }
  }
}

function key(handle: string): string {
  return `${PREFIX}dataset:v1:${handle.trim().toLowerCase()}`;
}
