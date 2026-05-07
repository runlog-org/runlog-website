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

export const WEBSITE_LD = {
  '@type': 'WebSite',
  '@id': `${SITE_URL}/#website`,
  url: `${SITE_URL}/`,
  name: SITE_NAME,
  description: SITE_DESCRIPTION,
  publisher: { '@id': `${SITE_URL}/#organization` },
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
    isPartOf: { '@id': `${SITE_URL}/#website` },
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
    author: { '@id': `${SITE_URL}/#organization` },
    publisher: { '@id': `${SITE_URL}/#organization` },
    isPartOf: { '@id': `${SITE_URL}/#website` },
    inLanguage: 'en',
  };
}
