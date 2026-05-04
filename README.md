# Runlog Website — Public-Facing Static Site

> Part of the **[Runlog](https://github.com/runlog-org)** project — see the [project home](https://github.com/runlog-org) for the overview.

**Repo:** [`runlog-org/runlog-website`](https://github.com/runlog-org/runlog-website) — public, MIT
**Stack:** [Astro](https://astro.build/) (hybrid output) + [Tailwind v4](https://tailwindcss.com/) — SSG today, ready for SSR routes (account, API key management) without a refactor
**Deploy target:** edge runtime (static assets + Worker entrypoint) serving `runlog.org` and `runlog.org/register`

> **About this project:** Runlog is a hobby side project by [Volker Otto](https://volkerotto.net) — not a commercial product today. A paid model is not ruled out for a later stage. See [About this project](https://runlog.org/#about) for the canonical framing.

Marketing and registration surface for Runlog. Extracted into its own public repo at first release because the static site has a different deploy path (edge runtime, static assets) and release cadence than the MCP server — a CSS tweak to the landing page should never require a server deploy, and vice versa.

## Layout

```
src/
├── content.config.ts          # Astro Content Collection schema (blog)
├── content/blog/*.md          # blog posts (Markdown w/ raw HTML)
├── layouts/Base.astro         # shared <head>, JSON-LD, nav, footer slot
├── components/Nav.astro       # primary nav + register CTA
├── components/Footer.astro    # footer with build-time copyright year
├── lib/schema.ts              # JSON-LD building blocks (Org, WebSite, Breadcrumb, …)
├── styles/global.css          # Tailwind v4 + theme tokens + component classes
└── pages/                     # file-routed pages — see Astro docs for [slug] dynamics
public/
├── assets/{fonts,img,js}/     # served as-is (fonts, vendor logos, badges, register-app.js, stats.js)
├── _headers                   # Cloudflare Pages security headers (CSP, HSTS, …)
├── _redirects                 # Cloudflare Pages 301s (/register → /register/)
├── stats.json                 # daily snapshot powering /stats/ + homepage callout
└── .well-known/security.txt
```

## Dev loop

```sh
npm install
npm run dev      # Astro dev server, ~localhost:4321
npm run build    # produces dist/ (static HTML + dist/_worker.js for Cloudflare)
npm run preview  # local preview of the built worker
```

The build target is the Cloudflare Workers adapter (hybrid mode): static pages prerender to `dist/<route>/index.html`, server-rendered routes (none today, but the account section will live here) compile into `dist/_worker.js/`. `wrangler.jsonc` points at `dist/`.

Local dev against the staging API:
- `/register/` and `/register/verify` both load `public/assets/js/register-app.js`, which reads the API base from `data-api-base` on the host element.
- For local API testing, edit `data-api-base="http://localhost:8000"` (port allowed by `register-app.js`'s allowlist) on `<form id="register-form">` in `src/pages/register/index.astro` and on the wrapper div in `src/pages/register/verify.astro`.

## Adding a blog post

Drop a Markdown file into `src/content/blog/<slug>.md`:

```md
---
title: "Post title"
description: "One-line description for OG + meta + listing summary."
pubDate: 2026-05-10
readTime: "~6 min read"
---

<section aria-labelledby="hero-title" class="prose">
<h1 id="hero-title">Post title</h1>
<p class="meta"><time datetime="2026-05-10">2026-05-10</time> &middot; ~6 min read</p>
<p class="lede">Lede paragraph.</p>
<p>Body…</p>
</section>

<section aria-labelledby="next-title" class="prose">
<h2 id="next-title">Next section</h2>
…
</section>
```

The blog index (`/blog/`) and the `/blog/<slug>/` pages pick up the new post automatically. Markdown bodies can use the design-system component classes (`.prose`, `.callout`, `.pull`, `.drench`, `.compare`, `.verdict`) — they're defined in `src/styles/global.css`.

## Depends on

- [`runlog-org/runlog`](https://github.com/runlog-org/runlog) (private) — `POST /register` and `GET /register/verify` endpoints at runtime (no build-time dep)

## LICENSE

MIT — see [`LICENSE`](./LICENSE).
