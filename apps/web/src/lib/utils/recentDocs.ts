// Tracks recently viewed document IDs per workspace in localStorage.
// Max 10 entries per workspace; most recent first.

const KEY = (workspaceId: string) => `aether-recent-docs-${workspaceId}`;
const MAX = 10;

export function recordRecentDoc(workspaceId: string, docId: string): void {
  if (typeof window === 'undefined') return;
  try {
    const prev = getRecentDocIds(workspaceId);
    const next = [docId, ...prev.filter((id) => id !== docId)].slice(0, MAX);
    localStorage.setItem(KEY(workspaceId), JSON.stringify(next));
  } catch {}
}

export function getRecentDocIds(workspaceId: string): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEY(workspaceId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
