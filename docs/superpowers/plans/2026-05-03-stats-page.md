# Stats Page + Homepage Callout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish `https://runlog.org/stats/` (full breakdown) and a "By the numbers" callout on the homepage, both fed by a static `stats.json` regenerated daily from the production database.

**Architecture:** Two repos. (1) In `runlog/`, a new producer script `runlog.scripts.export_stats` reads SQLite + `scope-registry.yaml` and emits one JSON document. A systemd timer + oneshot service on the VPS runs the producer daily, writes the JSON into a long-lived `runlog-website` clone, and `git push`es when the file changes. (2) In `runlog-website/`, a new `/stats/` page and a homepage callout fetch `/stats.json` client-side via vanilla JS (`assets/js/stats.js`) — no HTML templating, no CSP changes, no new build step. Cloudflare Pages auto-deploys on push to `main`, the same as today.

**Tech Stack:** Python 3.12 + sqlite3 + PyYAML (already deps), pytest (already deps), systemd (existing pattern in `server/deploy/auto-pull/`), static HTML + vanilla JS + Tailwind v4 utility classes (already in use), Cloudflare Pages.

**Spec:** `docs/superpowers/specs/2026-05-03-stats-page-design.md`

---

## File Structure

### Repo: `runlog/` (private server, Python)

| Path | Action | Responsibility |
|---|---|---|
| `server/src/runlog/scripts/__init__.py` | create | Package marker for the scripts module. |
| `server/src/runlog/scripts/export_stats.py` | create | Producer: connects to DB, reads vocab, emits stats JSON to stdout. |
| `server/tests/test_export_stats.py` | create | TDD coverage for every counting rule + JSON shape. |
| `server/pyproject.toml` | modify | Add `runlog-export-stats` console script entry. |
| `server/deploy/stats-export/export-stats.sh` | create | Wrapper: run producer → diff against website clone → `git commit && git push`. |
| `server/deploy/stats-export/runlog-export-stats.service` | create | Systemd oneshot unit invoking the wrapper. |
| `server/deploy/stats-export/runlog-export-stats.timer` | create | Daily timer at 07:00 UTC. |
| `server/deploy/stats-export/README.md` | create | One-time VPS setup (deploy key, clone, install units). |

### Repo: `runlog-website/` (public marketing site, static)

| Path | Action | Responsibility |
|---|---|---|
| `stats.json` | create | Initial placeholder served as a static asset until the cron lands a real one. |
| `assets/js/stats.js` | create | Single ~60-line vanilla JS module: fetch, parse, populate, fail-closed. Uses DOM-construction APIs only — never `innerHTML`. |
| `stats/index.html` | create | New section page. Same shell as `trust/index.html`. |
| `index.html` | modify | Add hidden "By the numbers" callout + `<script src="/assets/js/stats.js" defer>`. |
| Footer `<ul>` on every page that has one | modify | Add `<li><a href="/stats/">Stats</a></li>`. |

**No changes to** `_headers`, `wrangler.jsonc`, `package.json`, `src/input.css`, `dist/style.css` (the new page reuses existing utility classes; if any new utility lands during implementation, rebuild Tailwind as a final cleanup step).

---

## Task 1: Producer skeleton + empty-DB test

**Files:**
- Create: `server/src/runlog/scripts/__init__.py`
- Create: `server/src/runlog/scripts/export_stats.py`
- Create: `server/tests/test_export_stats.py`

- [ ] **Step 1: Create the empty package marker**

```bash
touch server/src/runlog/scripts/__init__.py
```

- [ ] **Step 2: Write the failing test for an empty DB**

Create `server/tests/test_export_stats.py`:

```python
"""Tests for runlog.scripts.export_stats."""

from __future__ import annotations

import json
import sqlite3
from pathlib import Path

import pytest
import sqlite_vec
import yaml

from runlog.scripts import export_stats
from runlog.storage import db as storage_db


def _make_conn() -> sqlite3.Connection:
    """In-memory SQLite with sqlite-vec loaded and full schema applied."""
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    conn.enable_load_extension(True)
    sqlite_vec.load(conn)
    conn.enable_load_extension(False)
    storage_db.init_schema(conn)
    return conn


def _write_vocab(tmp_path: Path, mapping: dict[str, str]) -> Path:
    """Write a minimal scope-registry.yaml fixture and return its path."""
    path = tmp_path / "scope-registry.yaml"
    payload = {
        "version": "1",
        "domains": [
            {"tag": tag, "category": cat, "description": "test fixture"}
            for tag, cat in mapping.items()
        ],
    }
    path.write_text(yaml.safe_dump(payload, sort_keys=False))
    return path


def test_build_stats_empty_db(tmp_path: Path) -> None:
    conn = _make_conn()
    vocab = _write_vocab(tmp_path, {"aws": "cloud", "postgres": "database"})

    result = export_stats.build_stats(conn, vocab)

    assert result["entries"] == {"total": 0, "verified": 0, "by_category": []}
    assert result["tags"] == {"covered": 0, "total_in_vocabulary": 2}
    assert result["users"] == {"registered": 0}
    # generated_at must be ISO-8601 UTC with trailing Z
    assert result["generated_at"].endswith("Z")
```

- [ ] **Step 3: Run the test — expect it to fail**

```bash
cd server && uv run pytest tests/test_export_stats.py::test_build_stats_empty_db -v
```

Expected: FAIL with `ImportError: cannot import name 'build_stats'` (or similar — the module doesn't exist yet).

- [ ] **Step 4: Create the minimal `export_stats.py` to satisfy the empty-DB test**

Create `server/src/runlog/scripts/export_stats.py`:

```python
"""Snapshot-style stats exporter for runlog.org/stats/.

Reads the production SQLite database plus the scope-registry vocabulary
and emits a single JSON document on stdout. Invoked by the daily systemd
timer in ``server/deploy/stats-export/``.

Design: see ``docs/superpowers/specs/2026-05-03-stats-page-design.md`` in
``runlog-website``.
"""

from __future__ import annotations

import json
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import yaml


def load_tag_categories(vocab_path: Path) -> dict[str, str]:
    """Return a mapping of tag → category from scope-registry.yaml."""
    with open(vocab_path) as f:
        data = yaml.safe_load(f)
    return {entry["tag"]: entry["category"] for entry in data["domains"]}


def build_stats(conn: sqlite3.Connection, vocab_path: Path) -> dict[str, Any]:
    """Compute the full stats snapshot. Pure function over (conn, vocab_path)."""
    tag_categories = load_tag_categories(vocab_path)
    return {
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "entries": {"total": 0, "verified": 0, "by_category": []},
        "tags": {"covered": 0, "total_in_vocabulary": len(tag_categories)},
        "users": {"registered": 0},
    }
```

- [ ] **Step 5: Run the test — expect it to pass**

```bash
cd server && uv run pytest tests/test_export_stats.py::test_build_stats_empty_db -v
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
cd server && git add src/runlog/scripts/__init__.py src/runlog/scripts/export_stats.py tests/test_export_stats.py
git commit -m "feat(stats): scaffold export_stats producer (empty-DB shape)"
```

---

## Task 2: Count entries (total + verified)

**Files:**
- Modify: `server/src/runlog/scripts/export_stats.py`
- Modify: `server/tests/test_export_stats.py`

- [ ] **Step 1: Write the failing test**

Append to `server/tests/test_export_stats.py`:

```python
def _insert_entry(
    conn: sqlite3.Connection,
    unit_id: str,
    domain: list[str],
    status: str = "unverified",
) -> None:
    conn.execute(
        "INSERT INTO entries (unit_id, domain_json, payload_json, status) "
        "VALUES (?, ?, ?, ?)",
        (unit_id, json.dumps(domain), "{}", status),
    )
    conn.commit()


def test_build_stats_counts_entries_and_verified(tmp_path: Path) -> None:
    conn = _make_conn()
    vocab = _write_vocab(tmp_path, {"aws": "cloud"})
    _insert_entry(conn, "u1", ["aws"], status="verified")
    _insert_entry(conn, "u2", ["aws"], status="unverified")
    _insert_entry(conn, "u3", ["aws"], status="degraded")

    result = export_stats.build_stats(conn, vocab)

    assert result["entries"]["total"] == 3
    assert result["entries"]["verified"] == 1
```

- [ ] **Step 2: Run the test — expect it to fail**

```bash
cd server && uv run pytest tests/test_export_stats.py::test_build_stats_counts_entries_and_verified -v
```

Expected: FAIL with `assert 0 == 3`.

- [ ] **Step 3: Implement entry counting in `export_stats.py`**

Add this helper above `build_stats`:

```python
def _count_entries(conn: sqlite3.Connection) -> tuple[int, int]:
    """Return (total, verified) entry counts."""
    total = conn.execute("SELECT COUNT(*) FROM entries").fetchone()[0]
    verified = conn.execute(
        "SELECT COUNT(*) FROM entries WHERE status = 'verified'"
    ).fetchone()[0]
    return int(total), int(verified)
```

Replace the placeholder `entries` dict in `build_stats`:

```python
    total, verified = _count_entries(conn)
    return {
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "entries": {"total": total, "verified": verified, "by_category": []},
        "tags": {"covered": 0, "total_in_vocabulary": len(tag_categories)},
        "users": {"registered": 0},
    }
```

- [ ] **Step 4: Run both tests — expect both to pass**

```bash
cd server && uv run pytest tests/test_export_stats.py -v
```

Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
cd server && git add src/runlog/scripts/export_stats.py tests/test_export_stats.py
git commit -m "feat(stats): count total and verified entries"
```

---

## Task 3: Aggregate by category, with multi-tag and missing-tag rules

**Files:**
- Modify: `server/src/runlog/scripts/export_stats.py`
- Modify: `server/tests/test_export_stats.py`

- [ ] **Step 1: Write six failing tests covering the counting rules**

Append to `server/tests/test_export_stats.py`:

```python
def test_by_category_single_tag(tmp_path: Path) -> None:
    conn = _make_conn()
    vocab = _write_vocab(tmp_path, {"aws": "cloud"})
    _insert_entry(conn, "u1", ["aws"])

    result = export_stats.build_stats(conn, vocab)

    assert result["entries"]["by_category"] == [
        {"category": "cloud", "total": 1, "tags": [{"tag": "aws", "count": 1}]},
    ]


def test_by_category_multi_tag_same_category(tmp_path: Path) -> None:
    """An entry tagged [aws, kubernetes] (both 'cloud') contributes +1 to each tag."""
    conn = _make_conn()
    vocab = _write_vocab(tmp_path, {"aws": "cloud", "kubernetes": "cloud"})
    _insert_entry(conn, "u1", ["aws", "kubernetes"])

    result = export_stats.build_stats(conn, vocab)

    [cloud] = result["entries"]["by_category"]
    assert cloud["category"] == "cloud"
    assert cloud["total"] == 2  # sum of in-category tag counts
    assert cloud["tags"] == [
        {"tag": "aws", "count": 1},
        {"tag": "kubernetes", "count": 1},
    ]


def test_by_category_multi_tag_different_categories(tmp_path: Path) -> None:
    """An entry tagged across categories appears in each."""
    conn = _make_conn()
    vocab = _write_vocab(tmp_path, {"aws": "cloud", "postgres": "database"})
    _insert_entry(conn, "u1", ["aws", "postgres"])

    result = export_stats.build_stats(conn, vocab)

    cats = {row["category"]: row for row in result["entries"]["by_category"]}
    assert set(cats) == {"cloud", "database"}
    assert cats["cloud"]["tags"] == [{"tag": "aws", "count": 1}]
    assert cats["database"]["tags"] == [{"tag": "postgres", "count": 1}]


def test_by_category_unknown_tag_buckets_under_other(tmp_path: Path) -> None:
    conn = _make_conn()
    vocab = _write_vocab(tmp_path, {"aws": "cloud"})
    _insert_entry(conn, "u1", ["aws", "totally-new-tag"])

    result = export_stats.build_stats(conn, vocab)

    cats = {row["category"]: row for row in result["entries"]["by_category"]}
    assert "other" in cats
    assert cats["other"]["tags"] == [{"tag": "totally-new-tag", "count": 1}]


def test_by_category_tags_sorted_count_desc_then_alpha(tmp_path: Path) -> None:
    conn = _make_conn()
    vocab = _write_vocab(tmp_path, {"a": "x", "b": "x", "c": "x"})
    # Three entries: "a" appears 2x, "b" 1x, "c" 1x. Within count==1 ties,
    # alphabetical order (b before c).
    _insert_entry(conn, "u1", ["a", "b"])
    _insert_entry(conn, "u2", ["a", "c"])

    result = export_stats.build_stats(conn, vocab)

    [bucket] = result["entries"]["by_category"]
    assert [t["tag"] for t in bucket["tags"]] == ["a", "b", "c"]
    assert [t["count"] for t in bucket["tags"]] == [2, 1, 1]


def test_by_category_categories_sorted_alphabetically(tmp_path: Path) -> None:
    conn = _make_conn()
    vocab = _write_vocab(
        tmp_path,
        {"redis": "database", "aws": "cloud", "kafka": "tooling"},
    )
    _insert_entry(conn, "u1", ["redis"])
    _insert_entry(conn, "u2", ["aws"])
    _insert_entry(conn, "u3", ["kafka"])

    result = export_stats.build_stats(conn, vocab)

    cats = [row["category"] for row in result["entries"]["by_category"]]
    assert cats == ["cloud", "database", "tooling"]
```

- [ ] **Step 2: Run them — expect six failures**

```bash
cd server && uv run pytest tests/test_export_stats.py -v
```

Expected: 2 passing (from prior tasks), 6 failing (the new ones).

- [ ] **Step 3: Implement the aggregator**

Add at the top of `export_stats.py` (next to existing imports):

```python
from collections import defaultdict
```

Add a new helper above `build_stats`:

```python
def _aggregate_by_category(
    conn: sqlite3.Connection, tag_categories: dict[str, str]
) -> tuple[list[dict[str, Any]], int]:
    """Return (by_category list, distinct_tag_count).

    Counting rules:
      - Each entry's domain_json is a JSON array of tags.
      - Every tag contributes +1 to its category bucket and +1 to that
        category's tag-count for the tag.
      - Tags absent from ``tag_categories`` go under category "other".
      - Categories are alphabetized; tags within a category are sorted
        by count descending, then alphabetically.
    """
    bucket_tags: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    distinct_tags: set[str] = set()

    for row in conn.execute("SELECT domain_json FROM entries"):
        for tag in json.loads(row["domain_json"]):
            distinct_tags.add(tag)
            category = tag_categories.get(tag, "other")
            bucket_tags[category][tag] += 1

    result: list[dict[str, Any]] = []
    for category in sorted(bucket_tags):
        tags = bucket_tags[category]
        sorted_tags = sorted(tags.items(), key=lambda kv: (-kv[1], kv[0]))
        result.append(
            {
                "category": category,
                "total": sum(tags.values()),
                "tags": [{"tag": t, "count": c} for t, c in sorted_tags],
            }
        )
    return result, len(distinct_tags)
```

Update `build_stats` to call it (also wire `tags.covered`):

```python
def build_stats(conn: sqlite3.Connection, vocab_path: Path) -> dict[str, Any]:
    """Compute the full stats snapshot. Pure function over (conn, vocab_path)."""
    tag_categories = load_tag_categories(vocab_path)
    total, verified = _count_entries(conn)
    by_category, covered = _aggregate_by_category(conn, tag_categories)
    return {
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "entries": {"total": total, "verified": verified, "by_category": by_category},
        "tags": {"covered": covered, "total_in_vocabulary": len(tag_categories)},
        "users": {"registered": 0},
    }
```

- [ ] **Step 4: Run the suite — all eight should pass**

```bash
cd server && uv run pytest tests/test_export_stats.py -v
```

Expected: 8 passed.

- [ ] **Step 5: Commit**

```bash
cd server && git add src/runlog/scripts/export_stats.py tests/test_export_stats.py
git commit -m "feat(stats): aggregate entries by vocabulary category"
```

---

## Task 4: Count registered users + finalize `build_stats`

**Files:**
- Modify: `server/src/runlog/scripts/export_stats.py`
- Modify: `server/tests/test_export_stats.py`

Background: registered users are stored in `api_keys`. The default `status` is `'active'`. We use `WHERE status = 'active'` (matches the user-visible concept "completed registration", does not require a public key to have been registered yet).

- [ ] **Step 1: Write the failing test**

Append to `server/tests/test_export_stats.py`:

```python
def _insert_api_key(conn: sqlite3.Connection, key_id: str, status: str = "active") -> None:
    conn.execute(
        "INSERT INTO api_keys (id, email_hash, key_hash, status) "
        "VALUES (?, ?, ?, ?)",
        (key_id, "h", "h", status),
    )
    conn.commit()


def test_build_stats_counts_active_api_keys(tmp_path: Path) -> None:
    conn = _make_conn()
    vocab = _write_vocab(tmp_path, {"aws": "cloud"})
    _insert_api_key(conn, "k1", status="active")
    _insert_api_key(conn, "k2", status="active")
    _insert_api_key(conn, "k3", status="revoked")  # excluded

    result = export_stats.build_stats(conn, vocab)

    assert result["users"]["registered"] == 2
```

- [ ] **Step 2: Run it — expect failure**

```bash
cd server && uv run pytest tests/test_export_stats.py::test_build_stats_counts_active_api_keys -v
```

Expected: FAIL with `assert 0 == 2`.

- [ ] **Step 3: Implement `_count_registered_users` and wire it in**

Add to `export_stats.py`:

```python
def _count_registered_users(conn: sqlite3.Connection) -> int:
    """Count api_keys rows that completed registration (status='active')."""
    row = conn.execute(
        "SELECT COUNT(*) FROM api_keys WHERE status = 'active'"
    ).fetchone()
    return int(row[0])
```

Update `build_stats` to call it:

```python
        "users": {"registered": _count_registered_users(conn)},
```

- [ ] **Step 4: Run the full suite**

```bash
cd server && uv run pytest tests/test_export_stats.py -v
```

Expected: 9 passed.

- [ ] **Step 5: Commit**

```bash
cd server && git add src/runlog/scripts/export_stats.py tests/test_export_stats.py
git commit -m "feat(stats): count registered (active) api_keys"
```

---

## Task 5: CLI `main()`, pyproject entry, end-to-end JSON test

**Files:**
- Modify: `server/src/runlog/scripts/export_stats.py`
- Modify: `server/tests/test_export_stats.py`
- Modify: `server/pyproject.toml`

- [ ] **Step 1: Write a failing test asserting `main()` writes valid JSON to stdout**

Append to `server/tests/test_export_stats.py`:

```python
def test_main_writes_valid_json_to_stdout(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    """main() opens db.session(), reads scope_registry_path(), writes JSON to stdout."""
    # Point both DB and vocab at temp resources.
    db_file = tmp_path / "runlog.db"
    monkeypatch.setenv("RUNLOG_DB_PATH", str(db_file))

    vocab_dir = tmp_path / "vocab"
    vocab_dir.mkdir()
    _write_vocab(vocab_dir, {"aws": "cloud"})  # writes scope-registry.yaml inside
    monkeypatch.setenv("RUNLOG_VOCABULARIES_PATH", str(vocab_dir))

    # Bootstrap an empty schema in the DB file so main() finds the tables.
    conn = storage_db.connect(db_file)
    storage_db.init_schema(conn)
    conn.close()

    rc = export_stats.main()
    captured = capsys.readouterr()

    assert rc == 0
    parsed = json.loads(captured.out)
    assert parsed["entries"]["total"] == 0
    assert parsed["tags"]["total_in_vocabulary"] == 1
    assert parsed["users"]["registered"] == 0
```

Note: this test relies on `_write_vocab` writing `scope-registry.yaml` to whatever directory it gets as its first argument. The helper from Task 1 does exactly that (`tmp_path / "scope-registry.yaml"`). Passing `vocab_dir` here lands the file at `vocab_dir / "scope-registry.yaml"`, which is what `RUNLOG_VOCABULARIES_PATH` expects (the env var points at the *directory* containing `scope-registry.yaml`).

`RUNLOG_DB_PATH` is the env var read by `runlog.config.db_path()`. **Verify this in the next step before running the test.**

- [ ] **Step 2: Verify the env-var name in `config.py`**

```bash
grep -n "db_path\|DB_PATH" server/src/runlog/config.py
```

Use whatever name the function reads. Update Step 1's `monkeypatch.setenv` line accordingly. (If `db_path()` does not consult an env var, fall back to patching `db.get_db_path` via `monkeypatch.setattr` to return the tmp_path file directly.)

- [ ] **Step 3: Run the test — expect failure (no `main` defined yet)**

```bash
cd server && uv run pytest tests/test_export_stats.py::test_main_writes_valid_json_to_stdout -v
```

Expected: FAIL — `AttributeError: module 'runlog.scripts.export_stats' has no attribute 'main'` (or similar).

- [ ] **Step 4: Implement `main()` in `export_stats.py`**

Add at the end of `export_stats.py`:

```python
def main() -> int:
    """CLI entry: print the stats snapshot as JSON on stdout, return exit code."""
    from runlog.sanitize._paths import scope_registry_path
    from runlog.storage import db as storage_db

    with storage_db.session() as conn:
        stats = build_stats(conn, scope_registry_path())
    json.dump(stats, sys.stdout, indent=2, sort_keys=False)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 5: Run the test — expect pass**

```bash
cd server && uv run pytest tests/test_export_stats.py::test_main_writes_valid_json_to_stdout -v
```

Expected: PASS.

- [ ] **Step 6: Wire the console script in `pyproject.toml`**

In `server/pyproject.toml`, find this block:

```toml
[project.scripts]
runlog-server = "runlog.mcp.server:main"
runlog-load-seeds = "runlog.storage.seeds:_main"
```

Append one line so it reads:

```toml
[project.scripts]
runlog-server = "runlog.mcp.server:main"
runlog-load-seeds = "runlog.storage.seeds:_main"
runlog-export-stats = "runlog.scripts.export_stats:main"
```

- [ ] **Step 7: Sync deps and smoke-test the console script**

```bash
cd server && uv sync && uv run runlog-export-stats | head -20
```

Expected: a JSON document beginning with `{` and including `"generated_at"`, `"entries"`, etc. Counts will reflect whatever is in your local dev DB (probably zero unless you ran `runlog-load-seeds`).

- [ ] **Step 8: Run the full suite + ruff + mypy**

```bash
cd server && uv run pytest tests/test_export_stats.py -v && uv run ruff check src/runlog/scripts && uv run mypy src/runlog/scripts
```

Expected: all tests pass, no ruff or mypy errors.

- [ ] **Step 9: Commit**

```bash
cd server && git add src/runlog/scripts/export_stats.py tests/test_export_stats.py pyproject.toml uv.lock
git commit -m "feat(stats): wire runlog-export-stats console script"
```

---

## Task 6: Cron wrapper (`export-stats.sh`)

**Files:**
- Create: `server/deploy/stats-export/export-stats.sh`

This script runs on the VPS as user `runlog`. It produces `stats.json` and pushes the change to `runlog-website` if anything actually changed.

- [ ] **Step 1: Write `export-stats.sh`**

Create `server/deploy/stats-export/export-stats.sh`:

```bash
#!/bin/bash
# Generate stats.json from the production DB and push it to runlog-website
# when (and only when) the file changes.
#
# Idempotent: a no-op when the producer's output matches what's already in
# the website clone. Refuses to merge non-fast-forwards on the website
# clone — operator resolves manually.
#
# Installed under /home/runlog/bin/export-stats.sh, owned runlog:runlog 0755.
# Invoked by /etc/systemd/system/runlog-export-stats.timer (daily 07:00 UTC).
#
# Prereqs (one-time, see deploy/stats-export/README.md):
#   - Long-lived clone of runlog-website at /home/runlog/site/
#   - SSH config entry "github-runlog-website" using a deploy key with
#     write access to runlog-org/runlog-website
#   - The clone's origin uses host alias "github-runlog-website"

set -euo pipefail

REPO=/home/runlog/app
SERVER_DIR="$REPO/server"
SITE=/home/runlog/site
UV=/home/runlog/.local/bin/uv

cd "$SERVER_DIR"

# Generate to a tmp file first so we never half-write into the clone.
tmp=$(mktemp)
trap 'rm -f "$tmp"' EXIT

if ! "$UV" run runlog-export-stats > "$tmp"; then
  echo "export-stats: producer failed; aborting without push" >&2
  exit 1
fi

# Refuse the trivially-broken case: an empty file.
if [ ! -s "$tmp" ]; then
  echo "export-stats: producer wrote an empty file; aborting" >&2
  exit 1
fi

# Validate JSON before we write it to the website clone.
if ! python3 -c 'import json,sys; json.load(open(sys.argv[1]))' "$tmp"; then
  echo "export-stats: producer wrote invalid JSON; aborting" >&2
  exit 1
fi

cd "$SITE"

# Stay on main and fast-forward — never resolve unexpected divergence here.
git fetch --quiet origin main
read -r ahead behind <<<"$(git rev-list --left-right --count HEAD...origin/main)"

if [ "$ahead" != "0" ]; then
  echo "export-stats: site clone has $ahead local-only commit(s); refusing to push" >&2
  exit 1
fi

if [ "$behind" != "0" ]; then
  if ! git merge --ff-only origin/main >/dev/null 2>&1; then
    echo "export-stats: fast-forward refused on site clone; manual review needed" >&2
    exit 1
  fi
fi

mv "$tmp" "$SITE/stats.json"
trap - EXIT

if git diff --quiet stats.json; then
  exit 0  # no change, no commit, no push
fi

git add stats.json
git commit -m "stats: refresh $(date -u +%Y-%m-%dT%H:%M:%SZ)" >/dev/null
git push --quiet origin main
echo "export-stats: pushed refreshed stats.json"
```

- [ ] **Step 2: Lint with shellcheck**

```bash
shellcheck server/deploy/stats-export/export-stats.sh
```

Expected: no findings (or only style-level suggestions; address them inline).

- [ ] **Step 3: Make it executable and commit**

```bash
chmod +x server/deploy/stats-export/export-stats.sh
cd server && git add deploy/stats-export/export-stats.sh
git update-index --chmod=+x deploy/stats-export/export-stats.sh
git commit -m "feat(stats): add export-stats.sh wrapper for VPS cron"
```

---

## Task 7: Systemd unit + timer + deploy README

**Files:**
- Create: `server/deploy/stats-export/runlog-export-stats.service`
- Create: `server/deploy/stats-export/runlog-export-stats.timer`
- Create: `server/deploy/stats-export/README.md`

- [ ] **Step 1: Write the service unit**

Create `server/deploy/stats-export/runlog-export-stats.service`:

```ini
[Unit]
Description=Generate stats.json and push to runlog-website
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
User=runlog
ExecStart=/home/runlog/bin/export-stats.sh
```

- [ ] **Step 2: Write the timer unit**

Create `server/deploy/stats-export/runlog-export-stats.timer`:

```ini
[Unit]
Description=Run runlog stats export daily at 07:00 UTC

[Timer]
OnCalendar=*-*-* 07:00:00 UTC
Persistent=true
Unit=runlog-export-stats.service

[Install]
WantedBy=timers.target
```

`Persistent=true` makes the timer fire on next boot if the previous run was missed (VPS reboot in the morning, etc.).

- [ ] **Step 3: Write the deploy README**

Create `server/deploy/stats-export/README.md`:

```markdown
# stats-export — daily stats.json regeneration

Runs `runlog-export-stats` once a day, writes the JSON into a long-lived
clone of `runlog-website`, and `git push`es when the file changes.
Cloudflare Pages auto-deploys on the push.

## One-time VPS setup

Run these as user `runlog`.

### 1. Generate a deploy key for the website push

```bash
ssh-keygen -t ed25519 -C "runlog-stats-deploy" -f ~/.ssh/runlog-stats-deploy -N ""
```

Add `~/.ssh/runlog-stats-deploy.pub` as a deploy key on
`github.com/runlog-org/runlog-website` with **write access checked**.
This key must NOT be reused for any other repo.

### 2. SSH config so the right key is used for that repo only

Append to `~/.ssh/config`:

```
Host github-runlog-website
  HostName github.com
  User git
  IdentityFile ~/.ssh/runlog-stats-deploy
  IdentitiesOnly yes
```

### 3. Clone the site using the host alias

```bash
git clone github-runlog-website:runlog-org/runlog-website.git ~/site
cd ~/site
git config user.email "runlog@volkerotto.net"
git config user.name "runlog stats bot"
```

Sanity-check the remote: `git remote -v` must show
`github-runlog-website:runlog-org/runlog-website.git` (not `github.com:...`).

### 4. Install the wrapper script into `~/bin/`

```bash
ln -sf ~/app/server/deploy/stats-export/export-stats.sh ~/bin/export-stats.sh
chmod +x ~/app/server/deploy/stats-export/export-stats.sh
```

(`~/bin/` is already in PATH from the auto-pull setup.)

### 5. Install + enable the systemd units

As root (one-time):

```bash
ln -sf /home/runlog/app/server/deploy/stats-export/runlog-export-stats.service \
       /etc/systemd/system/runlog-export-stats.service
ln -sf /home/runlog/app/server/deploy/stats-export/runlog-export-stats.timer \
       /etc/systemd/system/runlog-export-stats.timer
systemctl daemon-reload
systemctl enable --now runlog-export-stats.timer
systemctl list-timers --all | grep export-stats
```

### 6. Smoke-test once

```bash
sudo systemctl start runlog-export-stats.service
journalctl -u runlog-export-stats.service -n 50 --no-pager
```

Confirm the journal shows either `pushed refreshed stats.json` (first
run) or no output beyond unit start/exit (subsequent unchanged runs).

## Operations

- View logs: `journalctl -u runlog-export-stats.service`
- View timer state: `systemctl list-timers runlog-export-stats.timer`
- Force a run: `sudo systemctl start runlog-export-stats.service`
- Disable: `sudo systemctl disable --now runlog-export-stats.timer`

## Failure modes

- **Producer fails** — service exits non-zero; nothing is pushed; the
  existing `stats.json` keeps serving until the next successful run.
- **Producer writes invalid JSON** — wrapper detects and aborts before
  touching the website clone.
- **Site clone diverged** — wrapper refuses to push; operator inspects
  `~/site/` and resolves manually.

The website-side staleness check (3-day grace, then a "stale —" prefix
on `/stats/`) is the user-visible signal that this pipeline is broken.
```

- [ ] **Step 4: Commit**

```bash
cd server && git add deploy/stats-export/runlog-export-stats.service \
                     deploy/stats-export/runlog-export-stats.timer \
                     deploy/stats-export/README.md
git commit -m "feat(stats): systemd service + timer + VPS deploy README"
```

(The actual deploy/install on the VPS happens after the website work is merged — see Task 12.)

---

## Task 8: Initial placeholder `stats.json` + `assets/js/stats.js`

**Switch to the `runlog-website` repo for tasks 8-12.**

**Files:**
- Create: `runlog-website/stats.json`
- Create: `runlog-website/assets/js/stats.js`

- [ ] **Step 1: Write the placeholder `stats.json`**

The placeholder ships zeros and a generated_at timestamp old enough that the staleness path on `/stats/` triggers, so the page never claims "0 entries" as if it were real data — it shows the "stale" prefix until cron lands a real one.

Create `runlog-website/stats.json`:

```json
{
  "generated_at": "2000-01-01T00:00:00Z",
  "entries": { "total": 0, "verified": 0, "by_category": [] },
  "tags": { "covered": 0, "total_in_vocabulary": 0 },
  "users": { "registered": 0 }
}
```

- [ ] **Step 2: Write `assets/js/stats.js`**

Use DOM-construction APIs only. Never assign to `.innerHTML` — neither for clearing nor for writing. (Setting `.innerHTML = ""` is technically safe; setting it with content is XSS-prone and easy to drift into. Banning it everywhere keeps the rule simple.)

Create `runlog-website/assets/js/stats.js`:

```javascript
// Hydrate the homepage "By the numbers" callout and the /stats/ page from
// /stats.json. Fail closed on the homepage (callout stays hidden); on
// /stats/ replace the body with a "temporarily unavailable" line.
//
// Uses textContent + DOM construction APIs only — no innerHTML assignment
// anywhere in this file. If you find yourself reaching for innerHTML,
// build the element tree with createElement / appendChild instead.

(function () {
  "use strict";

  var STALE_THRESHOLD_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

  function clearChildren(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function setText(id, value) {
    var el = document.getElementById(id);
    if (el) el.textContent = String(value);
  }

  function formatGeneratedAt(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toUTCString().replace(" GMT", " UTC");
  }

  function renderHeadline(stats) {
    setText("stat-entries-total", stats.entries.total);
    setText("stat-entries-verified", stats.entries.verified);
    setText("stat-tags-covered", stats.tags.covered);
    setText("stat-tags-total", stats.tags.total_in_vocabulary);
    setText("stat-users-registered", stats.users.registered);
  }

  function renderByCategory(container, stats) {
    clearChildren(container);
    stats.entries.by_category.forEach(function (cat) {
      var section = document.createElement("section");
      section.className = "stats-category";

      var heading = document.createElement("h3");
      heading.textContent =
        cat.category.charAt(0).toUpperCase() +
        cat.category.slice(1) +
        " — " +
        cat.total +
        " entries";
      section.appendChild(heading);

      var line = document.createElement("p");
      line.className = "stats-tags";
      line.textContent = cat.tags
        .map(function (t) {
          return t.tag + " (" + t.count + ")";
        })
        .join(" · "); // middle dot
      section.appendChild(line);

      container.appendChild(section);
    });
  }

  function renderGeneratedAt(stats) {
    var el = document.getElementById("stat-generated-at");
    if (!el) return;
    var iso = stats.generated_at;
    var d = new Date(iso);
    var stale =
      isFinite(d.getTime()) && Date.now() - d.getTime() > STALE_THRESHOLD_MS;
    el.textContent = (stale ? "stale — " : "") + formatGeneratedAt(iso);
  }

  function showOnStatsPageError() {
    var page = document.getElementById("stats-page-body");
    if (!page) return;
    clearChildren(page);
    var msg = document.createElement("p");
    msg.className = "note";
    msg.textContent =
      "Stats temporarily unavailable — try again shortly.";
    page.appendChild(msg);
  }

  function showHomepageCallout() {
    var callout = document.getElementById("stats-callout");
    if (callout) callout.removeAttribute("hidden");
  }

  fetch("/stats.json", { cache: "no-cache" })
    .then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    })
    .then(function (stats) {
      renderHeadline(stats);
      var byCat = document.getElementById("stat-by-category");
      if (byCat) {
        renderByCategory(byCat, stats);
        renderGeneratedAt(stats);
      }
      showHomepageCallout();
    })
    .catch(function () {
      showOnStatsPageError();
      // Homepage callout stays hidden — fail closed.
    });
})();
```

- [ ] **Step 3: Commit**

```bash
cd /home/vo/share/runlog/runlog-website
git add stats.json assets/js/stats.js
git commit -m "feat(stats): add stats.json placeholder + client-side hydration script"
```

---

## Task 9: `/stats/` page

**Files:**
- Create: `runlog-website/stats/index.html`

- [ ] **Step 1: Sample `trust/index.html` for the page shell**

```bash
cat /home/vo/share/runlog/runlog-website/trust/index.html | head -80
```

The shell to copy/adapt: `<!DOCTYPE>` + `<head>` (title, meta, OG/Twitter, JSON-LD) + `<body>` shared header + `<main>` + standard `<footer>`.

- [ ] **Step 2: Write `stats/index.html`**

Create `runlog-website/stats/index.html`. Key content blocks below; copy the surrounding shell (header, footer, JSON-LD `Organization`+`WebSite` nodes) verbatim from `trust/index.html` and adjust only what's listed here.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Stats — Runlog</title>
  <meta name="description" content="How many entries Runlog covers, broken down by vocabulary category, plus the registered-user count. Refreshed daily.">
  <link rel="canonical" href="https://runlog.org/stats/">
  <meta name="theme-color" content="#0060df">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Runlog">
  <meta property="og:url" content="https://runlog.org/stats/">
  <meta property="og:title" content="Stats — Runlog">
  <meta property="og:description" content="How many entries Runlog covers, broken down by vocabulary category, plus the registered-user count. Refreshed daily.">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="Stats — Runlog">
  <meta name="twitter:description" content="How many entries Runlog covers, broken down by vocabulary category, plus the registered-user count. Refreshed daily.">
  <link rel="stylesheet" href="/dist/style.css">
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": "https://runlog.org/#organization",
        "name": "Runlog",
        "url": "https://runlog.org/",
        "email": "runlog@volkerotto.net",
        "sameAs": ["https://github.com/runlog-org"]
      },
      {
        "@type": "WebSite",
        "@id": "https://runlog.org/#website",
        "url": "https://runlog.org/",
        "name": "Runlog",
        "publisher": {"@id": "https://runlog.org/#organization"},
        "inLanguage": "en"
      },
      {
        "@type": "BreadcrumbList",
        "itemListElement": [
          {"@type": "ListItem", "position": 1, "name": "Runlog", "item": "https://runlog.org/"},
          {"@type": "ListItem", "position": 2, "name": "Stats", "item": "https://runlog.org/stats/"}
        ]
      },
      {
        "@type": "WebPage",
        "@id": "https://runlog.org/stats/#page",
        "name": "Stats",
        "url": "https://runlog.org/stats/",
        "isPartOf": {"@id": "https://runlog.org/#website"},
        "inLanguage": "en"
      }
    ]
  }
  </script>
</head>
<body>
  <main class="prose">
    <!-- COPY the <header> nav element from trust/index.html verbatim. -->
    <!-- After the shared header, the page body: -->

    <article id="stats-page-body">
      <h1>Stats</h1>

      <p class="lede">
        A daily snapshot of what Runlog covers and who's signed up.
        Counts come from the production database; the tag→category
        mapping comes from
        <a href="https://github.com/runlog-org/runlog-vocabularies/blob/main/scope-registry.yaml">scope-registry.yaml</a>.
      </p>

      <section class="stats-headline" aria-label="Headline numbers">
        <dl>
          <div><dt>Entries</dt><dd><span id="stat-entries-total">—</span></dd></div>
          <div><dt>Verified</dt><dd><span id="stat-entries-verified">—</span></dd></div>
          <div><dt>Tags covered</dt><dd><span id="stat-tags-covered">—</span> of <span id="stat-tags-total">—</span></dd></div>
          <div><dt>Registered users</dt><dd><span id="stat-users-registered">—</span></dd></div>
        </dl>
      </section>

      <h2>Coverage by category</h2>
      <div id="stat-by-category">
        <p class="note">Loading…</p>
      </div>

      <h2>Methodology</h2>
      <p>
        The numbers above come from a snapshot of the production database
        regenerated daily. Tags are bucketed by category using
        <a href="https://github.com/runlog-org/runlog-vocabularies/blob/main/scope-registry.yaml">scope-registry.yaml</a>.
        The raw JSON behind this page is
        <a href="/stats.json">stats.json</a>.
      </p>
      <p class="generated-at">
        Generated: <span id="stat-generated-at">—</span>
      </p>
    </article>

    <!-- COPY the <footer class="site-footer"> from trust/index.html, with
         the new <li><a href="/stats/">Stats</a></li> entry already added in
         Task 11. -->
  </main>
  <script src="/assets/js/copyright.js" defer></script>
  <script src="/assets/js/stats.js" defer></script>
</body>
</html>
```

When copying the header and footer from `trust/index.html`: the only divergence is the new `<li><a href="/stats/">Stats</a></li>` entry, which Task 11 adds across all pages.

- [ ] **Step 3: Local smoke test**

```bash
cd /home/vo/share/runlog/runlog-website && npx wrangler pages dev --port 8788 . &
sleep 2
curl -sf http://localhost:8788/stats/ | head -20
curl -sf http://localhost:8788/stats.json | head -5
kill %1
```

Expected: both return 200. The `/stats/` HTML contains `id="stat-by-category"`. Open `http://localhost:8788/stats/` in a browser and confirm: the headline numbers all show `0`, `Coverage by category` is empty (because the placeholder's `by_category` is empty), and the generated-at line is prefixed with `stale —`. That's the expected pre-cron state. (The JS does NOT replace `0` with em-dashes — em-dashes only appear pre-fetch as the static HTML default; once the fetch resolves, real values replace them.)

- [ ] **Step 4: Commit**

```bash
cd /home/vo/share/runlog/runlog-website
git add stats/index.html
git commit -m "feat(stats): add /stats/ page"
```

---

## Task 10: Homepage callout

**Files:**
- Modify: `runlog-website/index.html`

- [ ] **Step 1: Identify the callout's slot**

```bash
grep -n "Get started\|cta\|class=\"hero" /home/vo/share/runlog/runlog-website/index.html | head -20
```

Pick a slot just below the hero block / primary CTA. The exact line number depends on what you find — the goal is to insert above an existing major content block, not interrupt the hero.

- [ ] **Step 2: Insert the callout block**

Insert this verbatim, immediately after whatever closing tag of the hero / primary CTA block you identified in Step 1 (typically a `</section>` or the closing `</div>` of the hero):

```html
<section id="stats-callout" class="stats-callout" hidden aria-label="By the numbers">
  <h2>By the numbers</h2>
  <p>
    <strong><span id="stat-entries-total">0</span></strong> entries ·
    <strong><span id="stat-entries-verified">0</span></strong> verified ·
    <strong><span id="stat-tags-covered">0</span></strong> tags covered ·
    <strong><span id="stat-users-registered">0</span></strong> registered users
  </p>
  <p><a href="/stats/">View full breakdown →</a></p>
</section>
```

The block uses the same element IDs as `/stats/`. `stats.js` populates whichever elements exist on the current page; on the homepage there's no `stat-by-category`, so the script's `if (byCat) { ... }` branch correctly skips that work.

- [ ] **Step 3: Add the script tag**

Find the existing `<script src="/assets/js/copyright.js" defer></script>` line near the bottom of `index.html` and add a sibling line right after it:

```html
<script src="/assets/js/stats.js" defer></script>
```

- [ ] **Step 4: Local smoke test**

```bash
cd /home/vo/share/runlog/runlog-website && npx wrangler pages dev --port 8788 . &
sleep 2
curl -sf http://localhost:8788/ | grep -A1 stats-callout
kill %1
```

Expected: `grep` matches the callout block. Open `http://localhost:8788/` in a browser; the callout should be visible (since the placeholder JSON is valid, the script unhides it). All four numbers will show `0`. That's the expected pre-cron state.

- [ ] **Step 5: Commit**

```bash
cd /home/vo/share/runlog/runlog-website
git add index.html
git commit -m "feat(stats): add 'By the numbers' callout to homepage"
```

---

## Task 11: Footer link sweep

**Files:**
- Modify: every HTML file under `runlog-website/` whose `<footer>` block lists nav links.

- [ ] **Step 1: Enumerate the affected files**

```bash
cd /home/vo/share/runlog/runlog-website
grep -rl 'href="/trust/"' --include="*.html" .
```

Expected matches: `index.html`, `agents/index.html`, `blog/index.html`, every `blog/inside-runlog-*/index.html`, `blog/runlog-vs-cq/index.html`, `quickstart/index.html`, `register/index.html`, `register/verify.html`, `trust/index.html`, `why-verification/index.html`, and the new `stats/index.html` from Task 9.

These are exactly the files where a `<li><a href="/stats/">Stats</a></li>` entry needs to be added next to the existing trust link in the footer nav.

- [ ] **Step 2: Add the link with `sed` (verify before applying)**

Dry-run on a single file first to confirm the substitution:

```bash
sed -n 's|<li><a href="/trust/">How trust works</a></li>|<li><a href="/trust/">How trust works</a></li>\n        <li><a href="/stats/">Stats</a></li>|p' index.html | head
```

Expected: prints the modified line(s). If your existing footer indentation differs from `        ` (eight spaces), adjust the replacement to match the file's indentation — `cat -A` on a sample footer reveals it.

Apply across every matched file:

```bash
grep -rl 'href="/trust/"' --include="*.html" . | xargs sed -i \
  's|<li><a href="/trust/">How trust works</a></li>|<li><a href="/trust/">How trust works</a></li>\n        <li><a href="/stats/">Stats</a></li>|'
```

- [ ] **Step 3: Verify the sweep**

```bash
grep -rL 'href="/stats/"' --include="*.html" . | grep -v 'docs/superpowers\|node_modules\|dist\|\.wrangler' || echo "all pages updated"
```

Expected: prints only files that legitimately have no footer (e.g., partials, design notes if any), or `all pages updated` if every HTML file got the link. Manually verify any file in the residual list — if it has a footer that links to `/trust/` but not `/stats/`, that's a miss.

- [ ] **Step 4: Local smoke test**

```bash
cd /home/vo/share/runlog/runlog-website && npx wrangler pages dev --port 8788 . &
sleep 2
for url in / /trust/ /agents/ /quickstart/ /stats/; do
  echo "=== $url ==="
  curl -sf "http://localhost:8788$url" | grep -c 'href="/stats/"'
done
kill %1
```

Expected: each page reports a count ≥ 1 (the footer link, plus possibly a body link if the page references `/stats/`).

- [ ] **Step 5: Commit**

```bash
cd /home/vo/share/runlog/runlog-website
git add -A
git status  # verify only HTML files changed; no stray edits
git commit -m "site: add /stats/ to the footer nav across all pages"
```

---

## Task 12: End-to-end smoke test + push + VPS install

**Files:** none changed — this task verifies and deploys.

- [ ] **Step 1: Run the website locally and click through it as a user would**

```bash
cd /home/vo/share/runlog/runlog-website && npx wrangler pages dev --port 8788 .
```

In a browser, verify:

- `http://localhost:8788/` — homepage loads, the "By the numbers" callout appears with `0`s and a "View full breakdown →" link.
- Click the link → `/stats/` loads, headline numbers show `0`, Coverage section is empty, Methodology paragraph and `Generated:` line are present, generated-at is prefixed with `stale —`.
- Footer on every page (sample 4–5) includes a `Stats` link.
- Browser devtools → Network → confirm `/stats.json` is fetched once per page load (200, ~200 bytes).
- Browser devtools → Console → no errors.

Stop wrangler when satisfied.

- [ ] **Step 2: Push the website branch**

```bash
cd /home/vo/share/runlog/runlog-website
git log --oneline origin/main..HEAD
```

Expected: a clean linear history of the four commits from Tasks 8–11.

```bash
git push origin main
```

- [ ] **Step 3: Verify the live site**

Wait for Cloudflare Pages to redeploy (typically 30–60 seconds). Then:

```bash
curl -sf https://runlog.org/stats.json | head -3
curl -sf https://runlog.org/stats/ | grep -c 'stat-by-category'
curl -sf https://runlog.org/ | grep -c 'stats-callout'
```

Expected: all three return non-empty / non-zero counts.

- [ ] **Step 4: Push the server branch**

```bash
cd /home/vo/share/runlog/runlog
git log --oneline origin/main..HEAD
```

Expected: a clean linear history of the seven commits from Tasks 1–7.

```bash
git push origin main
```

(The auto-pull timer on the VPS will fast-forward `/home/runlog/app/` within 2 minutes. The new code is harmless until the VPS install in Step 5 enables the timer that uses it.)

- [ ] **Step 5: Run the VPS one-time install**

SSH to the VPS as `runlog` and follow `server/deploy/stats-export/README.md` Steps 1–6 verbatim. After Step 6's `systemctl start runlog-export-stats.service` and the subsequent `journalctl -u runlog-export-stats.service`, expect the journal to show either `pushed refreshed stats.json` (first run) or a clean exit with no push (if zero diff).

If the run pushed: re-fetch `https://runlog.org/stats.json` after Cloudflare Pages redeploys; confirm `generated_at` is recent (not the year-2000 placeholder), `entries.total > 0`, and the homepage callout no longer shows zeros.

- [ ] **Step 6: Final acceptance**

Open `https://runlog.org/` in a browser, click into `/stats/`, confirm:

- Homepage callout shows real numbers (e.g., `25 entries · 25 verified · …`).
- Coverage by category lists categories with their tag breakdowns.
- The `Generated:` line shows today's date and is NOT prefixed with `stale —`.

This is the definition of done.

---

## Self-review checklist (already performed during plan-writing)

- **Spec coverage:** every Goal in the spec maps to one or more tasks. Counting rules in §2 of the spec → Tasks 2–4. Cron behaviour from §3 → Tasks 6–7. Consumer surfaces from §4 → Tasks 8–11. Failure modes from §5 surface in Task 6 (producer/wrapper aborts) and Task 8 (fail-closed JS).
- **Placeholder scan:** no `TBD`, `TODO`, "implement later", or "similar to Task N". Every code step shows actual code.
- **Type consistency:** helper names (`_count_entries`, `_count_registered_users`, `_aggregate_by_category`, `load_tag_categories`, `build_stats`, `main`) and JSON keys (`generated_at`, `entries.total`, `entries.verified`, `entries.by_category`, `tags.covered`, `tags.total_in_vocabulary`, `users.registered`) are consistent across the producer code, the JS consumer, the page markup, and the test assertions. Element IDs (`stat-entries-total`, `stat-entries-verified`, `stat-tags-covered`, `stat-tags-total`, `stat-users-registered`, `stat-generated-at`, `stat-by-category`, `stats-callout`, `stats-page-body`) are consistent across `assets/js/stats.js`, `index.html`, and `stats/index.html`.
- **Security note:** `stats.js` uses DOM construction APIs only — no `innerHTML` assignment anywhere. The fetched JSON is treated as untrusted; every dynamic value lands via `textContent`.
