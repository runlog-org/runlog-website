# Runlog Website — Public-Facing Static Site

> Part of the **[Runlog](https://github.com/runlog-org)** project — see the [project home](https://github.com/runlog-org) for the overview.

**Repo:** [`runlog-org/runlog-website`](https://github.com/runlog-org/runlog-website) — public, MIT
**Content:** Static HTML, CSS, and vanilla JS
**Deploy target:** edge runtime (static assets + secrets binding) serving `runlog.org` and `runlog.org/register`

> **About this project:** Runlog is a hobby side project by [Volker Otto](https://volkerotto.net) — not a commercial product today. A paid model is not ruled out for a later stage. See [About this project](https://runlog.org/#about) for the canonical framing.

Marketing and registration surface for Runlog. Extracted into its own public repo at first release because the static site has a different deploy path (edge runtime, static assets) and release cadence than the MCP server — a CSS tweak to the landing page should never require a server deploy, and vice versa.

## Layout

- `register/index.html` — email-input form shown at `runlog.org/register`; POSTs to `api.runlog.org/register`; always shows the same confirmation message to prevent email enumeration
- `register/verify.html` — landing page for the verification link at `runlog.org/register/verify?token=…`; fetches `api.runlog.org/register/verify?token=…` and renders the API key exactly once with a copy button
- `register/app.js` — vanilla JS (ES2020, no framework, no build step) that drives both pages; dispatches on `location.pathname`
- `dist/style.css` — compiled Tailwind v4 stylesheet served as a static asset (do not edit directly; rebuild from `src/input.css`)

## Building CSS

The site styles are built from `src/input.css` (Tailwind v4) into
`dist/style.css`, which is committed to the repo and served as a
static asset.

After installing dependencies once:

```sh
npm install
```

Build the CSS bundle (one-shot):

```sh
npm run build
```

Or watch for changes during local development:

```sh
npm run dev
```

Always rebuild and commit `dist/style.css` along with any change to
`src/input.css` or HTML class usage. The site is deployed as static
assets — there is no build step on the Cloudflare side.

## Dev loop

Serve the directory with Python's built-in server:

```
python -m http.server 8080 --directory website
```

Then open `http://localhost:8080/register/`.

The `POST /register` and `GET /register/verify` endpoints are served by the runlog MCP server (private repo: [`runlog-org/runlog`](https://github.com/runlog-org/runlog)). In production these live at `api.runlog.org`; in local dev point at `http://localhost:8000` by editing the `data-api-base` attribute on `#register-form` in `register/index.html` and on `<main>` in `register/verify.html`.

## Depends on

- [`runlog-org/runlog`](https://github.com/runlog-org/runlog) (private) — `POST /register` and `GET /register/verify` endpoints at runtime (no build-time dep)

## LICENSE

MIT — see [`LICENSE`](./LICENSE).
