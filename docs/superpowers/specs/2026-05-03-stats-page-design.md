# Stats page + homepage callout

**Date:** 2026-05-03
**Status:** approved (brainstorm), pending implementation plan

## Context

The runlog.org marketing site has no public-facing way to see how
much content the registry actually holds, what it covers, or how many
people have signed up. Two surfaces should exist:

1. A small "By the numbers" callout on the homepage — a top-line
   credibility signal.
2. A dedicated `/stats/` page with a coverage breakdown by category
   and tag — a transparency/discovery aid.

Both surfaces read from the same data source: a single `stats.json`
artifact regenerated from the production database on a daily cron.
The website itself stays a pure-static Cloudflare Pages deploy with
no build step beyond what already exists for Tailwind.

## Goals

- A `/stats/` page that shows: top-line metrics, entries grouped by
  vocabulary category with per-tag counts, and a methodology footer.
- A "By the numbers" callout on the homepage that shows exactly four
  metrics (entries, verified, tags covered, registered users) and
  links to `/stats/`.
- A `stats.json` artifact at the repo root that both surfaces consume
  client-side.
- A producer script in `runlog/` that emits the JSON from the
  production DB.
- A daily cron on the VPS that regenerates the JSON and pushes it to
  `runlog-website/main`. Cloudflare Pages auto-deploys on push (no
  change to existing deploy contract).
- No CSP changes. No new dependencies on the website. No HTML
  templating step.

## Non-goals

- No graphs, charts, sparklines, or motion. Numbers and text only.
- No history series. Only the current snapshot is published. (No
  growth-over-time chart, no past-snapshots archive.)
- No per-user information. Only an aggregate registered-user count.
- No live endpoint. The website never calls the production API for
  stats. Everything is served from `stats.json` as a static asset.
- No public exposure of infrastructure details (cloud provider,
  region, storage engine, hostnames beyond `api.runlog.org`).

## Approach

### 1. Producer (`runlog/`)

New script: `server/scripts/export_stats.py`.

- Importable as `python -m runlog.scripts.export_stats`.
- Reads from the production DB via the existing storage layer
  (`runlog.storage`) — does not open its own connection. Concrete
  queries are TBD against `migrations/`; the implementation plan
  resolves these.
- Reads the tag→category mapping from `runlog-vocabularies/scope-registry.yaml`.
  Path resolution strategy decided during plan-writing — either a
  vendored copy committed into `runlog/server/` (matches how
  `runlog-schema` is consumed today) or a sibling-checkout path on
  the VPS. Either way, the script takes a `--vocab-path` flag with
  a default that works in production.
- Emits a single JSON document to stdout, schema below.
- Exits non-zero on any error. The cron wrapper relies on exit code
  to decide whether to push.

New tests: `server/tests/scripts/test_export_stats.py`.

- Fixture DB + fixture vocabulary file.
- Cases:
  - Empty DB → counts all zero, `by_category` is `[]`.
  - Multi-tag entry counted once in `entries.total`, once per tag in
    `by_category[].tags[].count`, and once in `tags.covered` per
    distinct tag.
  - Tag absent from vocabulary → bucketed under `category: "other"`.
  - Verified vs unverified count split correctly.
  - `users.registered` counts registration rows directly.

### 2. JSON schema (`stats.json`)

```json
{
  "generated_at": "2026-05-03T07:00:00Z",
  "entries": {
    "total": 27,
    "verified": 25,
    "by_category": [
      {
        "category": "cloud",
        "total": 6,
        "tags": [
          { "tag": "aws", "count": 4 },
          { "tag": "kubernetes", "count": 1 },
          { "tag": "lets-encrypt", "count": 1 }
        ]
      }
    ]
  },
  "tags": { "covered": 18, "total_in_vocabulary": 200 },
  "users": { "registered": 7 }
}
```

Counting rules:

- `entries.total` — count of rows in the entries table.
- `entries.verified` — entries currently in the verified tier per the
  trust logic referenced on `/trust/`.
- `entries.by_category` — every entry contributes +1 to every tag it
  carries. Per-tag counts can therefore sum to more than
  `entries.total`. Categories are alphabetized; tags within a
  category are sorted by count descending, then alphabetically.
  Categories with zero entries are omitted.
- `tags.covered` — distinct tag count across all entries.
- `tags.total_in_vocabulary` — `len(domains)` from
  `scope-registry.yaml`.
- `users.registered` — raw count of registration rows. Published from
  day one with no threshold.

### 3. Cron + push (VPS)

New script: `runlog/server/deploy/vps/cron-stats.sh`.

Behavior, in order:

1. Activate the server venv.
2. Run `python -m runlog.scripts.export_stats > /tmp/stats.json.new`.
   On non-zero exit, log and exit non-zero.
3. `cd /var/lib/runlog/site/` and `git pull --ff-only`.
4. `mv /tmp/stats.json.new ./stats.json`.
5. `git diff --quiet stats.json` — if no diff, exit 0 (no-op).
6. Otherwise: `git add stats.json`, commit with message
   `stats: refresh ${ISO8601 timestamp}`, `git push`.
7. Cloudflare Pages auto-deploys.

The clone at `/var/lib/runlog/site/` is configured with a deploy key
that has push access **only** to `runlog-org/runlog-website`. One-time
setup; documented in the v0.1 runbook.

Cron line: daily, 07:00 UTC, output redirected to a known log path.
Exact path documented during implementation.

### 4. Consumer (`runlog-website/`)

**`stats.json`** at repo root.

- Initial commit contains a hand-written placeholder so the JS does
  not 404 before the first cron run lands.
- Subsequent updates come from the cron in §3.

**`stats/index.html`** — new section page using the same shell as
`trust/index.html`:

- Standard head: title, description, canonical, OG/Twitter, JSON-LD
  with `Organization`, `WebSite`, `BreadcrumbList`, and a
  `WebPage` node for `/stats/`. No FAQ markup.
- Body sections, in order:
  1. Headline numbers — entries / verified / tags covered (rendered
     as "X of Y tags") / registered users. Larger type than the
     homepage callout.
  2. Coverage by category — definition-list-style block per
     category, alphabetized. Format:
     ```
     Cloud — 6 entries
       aws (4) · kubernetes (1) · lets-encrypt (1)
     ```
  3. Methodology footer — one paragraph explaining: data is read
     from the production DB at the time of export, tag→category
     mapping comes from `scope-registry.yaml`, the snapshot is
     refreshed daily by cron, and a link to `/stats.json` for
     anyone who wants the raw data. Includes the `generated_at`
     timestamp formatted as a human-readable UTC date.
- Loads `<script src="/assets/js/stats.js" defer></script>` near the
  closing `</body>`. Same script tag as the homepage; the script
  detects which surface it's on by feature-checking for the
  presence of the `stat-by-category` element.
- Standard footer with `/stats/` highlighted in the nav.

**`assets/js/stats.js`** — new vanilla JS module, ~50 lines:

- `fetch('/stats.json')` once on page load.
- On success: populate elements by ID. Elements use stable IDs
  (`stat-entries-total`, `stat-entries-verified`, `stat-tags-covered`,
  `stat-tags-total`, `stat-users-registered`, `stat-generated-at`,
  `stat-by-category`). The `stat-by-category` container is populated
  by JS on `/stats/` only.
- On the homepage: unhide the "By the numbers" callout once the
  fetch resolves with valid data. If the fetch fails or the JSON is
  malformed, the callout stays hidden — fail closed, never show
  zeros by accident.
- On `/stats/`: if the fetch fails, replace the body with a single
  line "Stats temporarily unavailable — try again shortly."
- Stale check: if `now - generated_at > 3 days`, prefix the
  generated-at line on `/stats/` with "stale —". The page still
  renders; the prefix is the only user-visible signal. Catches a
  silently-broken cron without paging anyone.

**`index.html`** — small edit:

- Insert a "By the numbers" block (initially `hidden`) near the top
  fold, with the four numbers and a "View full breakdown →" link to
  `/stats/`.
- Add `<script src="/assets/js/stats.js" defer></script>` near the
  closing `</body>` (next to `copyright.js`).

**Footer nav** — every page that has a footer `<ul>` gets a new
`<li><a href="/stats/">Stats</a></li>` entry. Pages affected:
`index.html`, `agents/`, `blog/` and every blog post folder under
it, `quickstart/`, `register/`, `trust/`, `why-verification/`. A
mechanical edit; ordering matches the existing nav ordering
(slotted next to "How trust works" feels natural — exact slot
chosen during implementation).

**No changes** to `_headers` (CSP `script-src 'self'` and
`connect-src 'self'` already permit the new script and the
same-origin fetch), `wrangler.jsonc`, `package.json`, or the
Tailwind input file (the new page reuses existing utility classes).

### 5. Failure modes

- **Cron fails** — `stats.json` not updated. After 3 days the
  generated-at line on `/stats/` shows "stale". No alerting beyond
  that for now (hobby project).
- **DB query fails inside the script** — script exits non-zero,
  cron wrapper exits non-zero, `git push` does not happen. Existing
  `stats.json` continues to serve.
- **`stats.json` malformed or missing** at request time — homepage
  callout stays hidden; `/stats/` shows the "temporarily unavailable"
  line.
- **Vocabulary file out of sync** — tag missing from registry shows
  up under `category: "other"`. Alerting handled separately by
  whatever already gates submissions on the registry.

## Risks / open questions

- **Vocabulary file path** — vendored copy vs sibling checkout.
  Resolved during plan-writing, not blocking the brainstorm.
- **DB schema details** — exact `entries`/`registrations` columns
  and the verified-tier predicate need a read of `migrations/` and
  the trust module before `export_stats.py` can be written.
- **`tags.total_in_vocabulary`** — this number changes when the
  vocabularies repo gets new tags. Acceptable: it's a moving
  denominator that reflects the registry's actual scope.
