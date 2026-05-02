# Releasing runlog-website

Production deploys for [runlog.org](https://runlog.org) are driven by
Cloudflare's auto-deploy on push-to-`main` — **not** by this release
workflow. The [`release`](.github/workflows/release.yml) workflow
exists to mark release points: a tag a future maintainer can pin to
or audit ("what was on prod when we shipped X?"). It re-runs the same
gates [`ci.yml`](.github/workflows/ci.yml) uses (wrangler offline
dry-run, htmlhint, `node --check` on site JS) on the exact tag commit,
then creates a GitHub Release with auto-generated notes. There are no
build artefacts beyond the source archive GitHub auto-attaches.

## What this doesn't do

Tagging is **not** a deploy trigger. Cloudflare watches `main` and
deploys whatever lands there; the release tag is for traceability and
audit, not for pushing code to prod. Don't wire deploy credentials
into this workflow — if you need to ship a hotfix, merge to `main` and
let the existing auto-deploy run; tag afterwards (or alongside) to
mark the release point.

## Cut a release

1. Make sure CI is green on `main`, the live site reflects the commit
   you intend to tag, and you're on `main`:

       git checkout main && git pull --ff-only

2. Pick a version. Tag shape is `website/vX.Y.Z` (path-scoped — this
   repo is one of seven under the `runlog-org` umbrella, and tags are
   namespaced by repo so a future consolidated tag stream stays
   unambiguous). See "Versioning policy" below for bump rules.

3. Tag and push:

       git tag -a website/v0.1.0 -m "Release website v0.1.0"
       git push origin website/v0.1.0

   Tags matching `website/v*-rc*`, `website/v*-beta*`, or
   `website/v*-alpha*` ship as **prereleases**; everything else ships
   as a normal release.

4. Watch the workflow on GitHub Actions. On success, the tag appears
   on the Releases page with auto-generated notes (commits + merged
   PRs since the previous tag) and the source `.tar.gz` / `.zip`
   GitHub attaches.

## Versioning policy

Pre-1.0, so the leading `0.` is held and changes are made in the
`MINOR.PATCH` slots:

- **PATCH** (`v0.1.0` → `v0.1.1`) — marketing copy edits, install-step
  wording, link updates, asset swaps that don't change the
  information architecture.
- **MINOR** (`v0.1.x` → `v0.2.0`) — structural site changes: a new
  top-level page, removing a page, reorganising the IA, restructuring
  navigation.
- **MAJOR** (`v0.x.y` → `v1.0.0`) — rebrand-level overhaul, domain
  change, or moving off the current static-site shape entirely.

There is no `VERSION` file at the repo root: the git tag is the
authoritative version. If a script needs the current version,
`git describe --tags --match 'website/v*' --abbrev=0` reads it.

See [`runlog-docs/13-release-trains.md`](https://github.com/runlog-org/runlog-docs/blob/main/13-release-trains.md)
for the path-scoped tag convention and the full list of components.
