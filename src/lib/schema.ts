// Shared schema.org JSON-LD building blocks.
// Every page emits Organization + WebSite as the baseline; pages add
// page-type schemas (BreadcrumbList, WebPage, BlogPosting, …) via the
// `graph` prop on Base.astro.

export const SITE_URL = 'https://runlog.org';
export const SITE_NAME = 'Runlog';
export const SITE_DESCRIPTION =
  'A cross-org registry of verified knowledge about third-party APIs, frameworks, and protocols, delivered to coding agents via MCP.';

export const ORGANIZATION_LD = {
  '@type': 'Organization',
  '@id': `${SITE_URL}/#organization`,
  name: SITE_NAME,
  url: `${SITE_URL}/`,
  email: 'runlog@volkerotto.net',
  sameAs: ['https://github.com/runlog-org'],
} as const;

/** Reusable JSON-LD node references. Every page-type schema points its
 *  `author` / `publisher` at the baseline Organization and `isPartOf`
 *  at the baseline WebSite (both emitted once by Base.astro). Centralised
 *  so the `${SITE_URL}/#…` `@id` strings have a single source instead of
 *  being retyped across ~10 page front-matter blocks. */
export const ORG_REF = { '@id': `${SITE_URL}/#organization` } as const;
export const SITE_REF = { '@id': `${SITE_URL}/#website` } as const;

export const WEBSITE_LD = {
  '@type': 'WebSite',
  '@id': `${SITE_URL}/#website`,
  url: `${SITE_URL}/`,
  name: SITE_NAME,
  description: SITE_DESCRIPTION,
  publisher: ORG_REF,
  inLanguage: 'en',
} as const;

/** YYYY-MM-DD slice of an ISO timestamp — the canonical date format for
 *  schema.org `datePublished` / `<time datetime>` and the visible date on
 *  blog list/detail pages. Centralised so the pubDate format never drifts. */
export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export type BreadcrumbItem = { name: string; url: string };

export function breadcrumbList(items: BreadcrumbItem[]) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

/** Build an absolute page URL for a site-relative path. Always trailing-slashed
 *  (matches Astro's `trailingSlash: 'ignore'` + `output: 'static'` rendering)
 *  except for the root, which renders as `${SITE_URL}/` either way.
 *  Centralised so the `${SITE_URL}/<segment>/` template doesn't drift across
 *  the ~10 pages that build their own canonical / breadcrumb URLs. */
export function pageUrl(path: string): string {
  if (path === '' || path === '/') return `${SITE_URL}/`;
  const stripped = path.replace(/^\/+/, '').replace(/\/+$/, '');
  return `${SITE_URL}/${stripped}/`;
}

/** Build a two-level breadcrumb list rooted at the Runlog homepage.
 *  Every secondary page does the same `[{ name: 'Runlog', url: SITE_URL/ }, …]`
 *  prepend, so this helper owns it. For deeper trails (e.g. `/blog/<slug>/`)
 *  pass extra items as the second argument; they are appended after the
 *  current page entry. */
export function pageBreadcrumb(
  current: BreadcrumbItem,
  extra: BreadcrumbItem[] = [],
) {
  return breadcrumbList([
    { name: SITE_NAME, url: `${SITE_URL}/` },
    current,
    ...extra,
  ]);
}

export function webPage(opts: {
  url: string;
  name: string;
  description?: string;
}) {
  const item: Record<string, unknown> = {
    '@type': 'WebPage',
    '@id': `${opts.url}#webpage`,
    name: opts.name,
    url: opts.url,
    isPartOf: SITE_REF,
    inLanguage: 'en',
  };
  if (opts.description) item.description = opts.description;
  return item;
}

export function blogPosting(opts: {
  url: string;
  headline: string;
  description: string;
  datePublished: string;
}) {
  return {
    '@type': 'BlogPosting',
    '@id': `${opts.url}#article`,
    headline: opts.headline,
    description: opts.description,
    datePublished: opts.datePublished,
    url: opts.url,
    author: ORG_REF,
    publisher: ORG_REF,
    isPartOf: SITE_REF,
    inLanguage: 'en',
  };
}
