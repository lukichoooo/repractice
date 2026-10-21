const RECENT_KEY = 'cf-repractice:recent-handles';
const MAX_RECENT = 6;

export function getRecentHandles(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === 'string').slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

export function addRecentHandle(handle: string): string[] {
  const clean = handle.trim();
  if (!clean) return getRecentHandles();
  const next = [clean, ...getRecentHandles().filter((h) => h.toLowerCase() !== clean.toLowerCase())].slice(
    0,
    MAX_RECENT,
  );
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage failures.
  }
  return next;
}

export function clearRecentHandles(): void {
  try {
    localStorage.removeItem(RECENT_KEY);
  } catch {
    // Ignore storage failures.
  }
}
