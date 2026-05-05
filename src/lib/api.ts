// api.ts — TypeScript reference for the runlog public API wire shapes.
//
// This module is the canonical typed reference for the
// GET /v1/findings/recent endpoint shipped by F56. It is NOT loaded at
// runtime in the browser — Astro doesn't bundle ad-hoc TS files into
// `public/`. The page at /findings/ loads the parallel vanilla-JS file
// at `public/assets/js/findings-app.js`, which mirrors the helpers
// below verbatim. Keep the two in sync by hand for v0.

export interface Finding {
  unit_id: string;
  title: string;
  domain: string[];
  last_confirmed_at: string | null;
  status: string;
}

export interface FindingsResponse {
  findings: Finding[];
  as_of: string | null;
}

const API_BASE = 'https://api.runlog.org';

export async function fetchRecentFindings(): Promise<FindingsResponse> {
  try {
    const resp = await fetch(`${API_BASE}/v1/findings/recent`);
    if (!resp.ok) {
      console.warn(`[runlog] /v1/findings/recent returned ${resp.status}`);
      return { findings: [], as_of: null };
    }
    const body = await resp.json();
    if (!body || !Array.isArray(body.findings)) {
      console.warn('[runlog] /v1/findings/recent returned unexpected body shape');
      return { findings: [], as_of: null };
    }
    return body as FindingsResponse;
  } catch (err) {
    console.warn('[runlog] /v1/findings/recent fetch error:', err);
    return { findings: [], as_of: null };
  }
}

// formatRelativeTime returns a short relative-time string ("3 days ago",
// "2 hours ago", "just now") for the last_confirmed_at timestamp. Used by
// FindingCard. Null inputs → empty string.
export function formatRelativeTime(iso: string | null): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diffMs = Date.now() - then;
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} minute${min === 1 ? '' : 's'} ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? '' : 's'} ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day} day${day === 1 ? '' : 's'} ago`;
  const month = Math.floor(day / 30);
  if (month < 12) return `${month} month${month === 1 ? '' : 's'} ago`;
  const year = Math.floor(day / 365);
  return `${year} year${year === 1 ? '' : 's'} ago`;
}
