# Runlog Website — Public-Facing Static Site

> Part of the **[Runlog](https://github.com/runlog-org)** project — see the [project home](https://github.com/runlog-org) for the overview.

**Repo:** [`runlog-org/runlog-website`](https://github.com/runlog-org/runlog-website) — public, MIT
**Content:** Static HTML, CSS, and vanilla JS
**Deploy target:** Cloudflare Pages serving `runlog.org` and `runlog.org/register`

Marketing and registration surface for Runlog. Extracted into its own public repo at first release because the static site has a different deploy path (Cloudflare Pages) and release cadence than the MCP server — a CSS tweak to the landing page should never require a server deploy, and vice versa.

## Layout

- `register/index.html` — email-input form shown at `runlog.org/register`; POSTs to `api.runlog.org/register`; always shows the same confirmation message to prevent email enumeration
- `register/verify.html` — landing page for the verification link at `runlog.org/register/verify?token=…`; fetches `api.runlog.org/register/verify?token=…` and renders the API key exactly once with a copy button
- `register/app.js` — vanilla JS (ES2020, no framework, no build step) that drives both pages; dispatches on `location.pathname`
- `register/style.css` — minimal system-font stylesheet, single-column, mobile-friendly, `prefers-color-scheme: dark` support; no external assets

## Dev loop

Serve the directory with Python's built-in server:

```
python -m http.server 8080 --directory website
```

Then open `http://localhost:8080/register/`.

The `POST /register` and `GET /register/verify` endpoints are served by the runlog MCP server (private repo: [`runlog-org/runlog`](https://github.com/runlog-org/runlog)). In production these live at `api.runlog.org`; in local dev point at `http://localhost:8000` by setting `window.RUNLOG_API_BASE` in an inline `<script>` before `app.js` loads, or by editing the `data-api-base` attribute on `#register-form` in `index.html`.

## Depends on

- [`runlog-org/runlog`](https://github.com/runlog-org/runlog) (private) — `POST /register` and `GET /register/verify` endpoints at runtime (no build-time dep)

## LICENSE

MIT — see [`LICENSE`](./LICENSE).
