# Tailwind migration + mobile-friendly header redesign

**Date:** 2026-05-03
**Status:** approved (brainstorm), pending implementation plan

## Context

The runlog.org marketing site (`runlog-website`) is plain static HTML
served by Cloudflare Pages. All 15 pages share `register/style.css`
(~460 lines of hand-rolled CSS). The site works and is internally
consistent, but two problems:

1. **The header isn't mobile-friendly.** On narrow viewports the nav
   collapses behind a `<details>`-based burger. All five nav links are
   hidden behind one tap, and the burger affordance is small.
2. **The styling system is hand-rolled CSS.** This was fine when the
   site had three pages; with 15 pages plus per-page `<style>` blocks
   it's getting noisy to keep consistent.

This spec covers a single bundled change that fixes both: replace the
burger with a wrap-on-narrow header that always shows every link, and
migrate the entire site from `register/style.css` to Tailwind v4.

## Goals

- All five top-nav links visible at every viewport width — no taps to
  reveal nav.
- Tailwind v4 as the only styling system; `register/style.css` deleted
  by the end of the migration.
- Visual parity everywhere except the header. This is *not* a visual
  refresh.
- Dark mode preserved (driven by `prefers-color-scheme`, same as today).
- Existing CSP (`script-src 'self'`) unchanged. Tailwind ships as a
  built static CSS file, not via the Play CDN.
- Cloudflare deploy contract unchanged — still a static asset deploy
  via wrangler. No CI build step added.

## Non-goals

- No copy changes, no new pages, no information-architecture changes.
- No new colors. The existing brand accent (`#0060df`) stays the only
  custom color.
- No visual refresh of typography, spacing, or layout outside the
  header.
- No JS framework. The site stays static HTML.
- No pre-commit hooks added in this PR. (Documented build step only;
  enforcement can come later if drift becomes a problem.)

## Approach

### 1. Build pipeline

- Add `package.json` to `runlog-website/` with `@tailwindcss/cli`
  (Tailwind v4) as the only dev dependency. v4's CLI does not require
  a PostCSS config.
- New file `src/input.css`:
  - `@import "tailwindcss";`
  - A `@theme` block declaring the one custom color (`brand: #0060df`)
    and pointing dark mode at the OS media query
    (`@variant dark (&:where(...))` or equivalent v4 syntax — exact
    directive resolved during implementation).
  - `@apply`-based component classes for the recurring patterns (see
    section 3).
- `npm run build` — one-shot build, output to `dist/style.css`,
  **committed** to the repo.
- `npm run dev` — watch-mode build for local development.
- `dist/style.css` is committed; `node_modules/` is gitignored.
- Wrangler config, `_headers`, `_redirects`, and CSP are unchanged.
  Cloudflare keeps deploying the repo as plain static assets.

### 2. Header markup

A single shared header layout used by every page. No `<details>`, no
JavaScript, no burger icon.

```html
<header class="flex flex-wrap items-center gap-x-4 gap-y-2 pb-3 mb-6
               border-b border-zinc-300 dark:border-zinc-700 text-sm"
        aria-label="Site navigation">
  <a href="/" class="font-bold text-base mr-auto">Runlog</a>

  <nav class="order-last basis-full flex flex-wrap gap-x-4 gap-y-1
              sm:order-none sm:basis-auto
              text-zinc-600 dark:text-zinc-400">
    <a href="https://github.com/runlog-org">GitHub</a>
    <a href="/trust/">Trust</a>
    <a href="/agents/">Agents</a>
    <a href="/pricing/">Pricing</a>
    <a href="/blog/">Blog</a>
  </nav>

  <a href="/register/" class="cta-register">Get API key</a>
</header>
```

The wrap mechanism: at narrow widths the `<nav>` has
`order-last basis-full`, so flex-wrap pushes it onto a second row below
brand + CTA, with all five links visible inline. At `sm:` (≥ 640 px)
the nav slots back inline between brand and CTA on a single row.

`aria-current="page"` on the active link is preserved and styled via a
sibling rule in `input.css`. The brand link on `/` keeps its
`aria-current="page"` flag.

### 3. Component classes via `@apply`

The existing CSS has classes that appear dozens of times across pages:
`cta`, `cta-register`, `card`, `note`, `pull`, `compare`, `prose`,
`lede`, `crumbs`, `banner`, `aside-install`, `tile`, `status-line`,
`agents-grid`, `setup-grid`, plus form-input styling on `register/`
pages.

These stay as named classes, defined in `src/input.css` via `@apply`
with Tailwind utilities. Two reasons:

- Inlining all of them as utility-class soup blows up every page's
  HTML by a meaningful amount and makes future tweaks fan out across
  15 files.
- It keeps the migration mechanical — markup mostly keeps the same
  class names, only the stylesheet they resolve against changes.

Pure utility classes are reserved for one-off layout — the per-page
`<style>` overrides on the landing page (tighter prose width, larger
h1), the `why-verification`/`runlog-vs-cq` table-cell widths, etc.
Those become inline utilities on the section/element where they apply.

### 4. Migration order

15 HTML files total. Single PR, but commits batched in this order so
each batch is independently reviewable:

1. **Plumbing.** `package.json`, `src/input.css`, `dist/style.css`,
   `.gitignore` update. Verify `npm run build` succeeds and produces
   a non-empty `dist/style.css`.
2. **`index.html`.** The most complex page (hero, two tease grids,
   FAQ, footer). New header lands here first; visual diff against the
   current production site at 320/360/640/1024 px before continuing.
3. **`agents/`, `pricing/`, `quickstart/`, `trust/`,
   `why-verification/`.** Short content pages, mostly mechanical.
4. **`register/index.html` + `register/verify.html`.** These have
   form-specific styles (`input[type=email]`, `button:disabled`,
   `#status`, `#result`). Translate to `@apply`-based form classes.
5. **`blog/index.html` + 6 blog post folders.** Long-form content,
   mostly prose with occasional `.note`/`.pull` blocks.
6. **Cleanup.** Delete `register/style.css`, remove every per-page
   `<style>` block, update `runlog-website/README.md` with the build
   step.

### 5. Testing

- `wrangler dev` locally; walk every page at 320, 360, 640, 1024 px in
  Chrome devtools.
- Toggle OS dark mode; confirm parity with current dark-mode rendering.
- Network tab: confirm no CSP violations and that `dist/style.css`
  loads from same origin.
- Lighthouse accessibility on `/`, `/register/`, and one blog post —
  must match or beat the current scores.
- Confirm `aria-current="page"` still bolds the active nav link.
- Tab-order check on the header: brand → nav links in order → CTA.
- Side-by-side visual diff of `index.html` and `why-verification/`
  (the highest-stakes pages) against the current production site
  before merging.

## Risks

- **Per-page `<style>` blocks have nuances.** The landing page tightens
  the prose column and bumps the h1 size; `why-verification/` and
  `runlog-vs-cq` set custom `td:first-child` widths on comparison
  tables. Each page's `<style>` block must be translated explicitly,
  not assumed to be redundant. Comparison tables are the highest-effort
  migration target.
- **Tailwind v4 is recent.** v4 changed the config story (no
  `tailwind.config.js`, theme via `@theme` directive). The exact syntax
  for the dark-mode variant and the brand-color theme key will be
  resolved at implementation time against current v4 docs.
- **Generated CSS in git.** Committing `dist/style.css` means PR diffs
  include the build output. Acceptable trade-off for keeping the
  deploy contract simple, but reviewers should be told to ignore the
  `dist/` diff when reviewing source changes.
- **Drift from forgetting to rebuild.** No pre-commit hook in this PR.
  If drift becomes a real problem we can add a hook in a follow-up.

## Out of scope

- Visual refresh of typography, color palette, spacing, or imagery.
- New pages, new sections, copy edits.
- JS framework, hydration, or any client-side scripting beyond the
  one existing `assets/js/copyright.js`.
- Pre-commit hooks, CI build steps, or any change to the deploy
  pipeline.
- Migrating the standalone register-flow JS (`register/app.js`) — only
  its CSS is in scope.

## Open questions

None. All architectural decisions resolved during brainstorming.
