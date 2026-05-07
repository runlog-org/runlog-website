#!/usr/bin/env node
// Gate: runlog-website/DESIGN.md must match canonical dotgithub/design.md
// after stripping the local "Mirror copy" callout (the only allow-listed delta).
//
// Run automatically before `npm run build` (via the prebuild script). Fails
// the build on drift so a stale mirror cannot ship.
//
// Usage:
//   node scripts/check-design-mirror.mjs           # verify (CI + local)
//   node scripts/check-design-mirror.mjs --update  # refresh the stored hash
//                                                  # from the local umbrella
//                                                  # canonical (requires
//                                                  # ../../dotgithub/design.md)

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOCAL = resolve(__dirname, "..", "DESIGN.md");
const HASH_FILE = resolve(__dirname, "design-canonical.sha256");
const CANONICAL = resolve(__dirname, "..", "..", "dotgithub", "design.md");

const MIRROR_CALLOUT = /^> \*\*Mirror copy\.\*\*[^\n]*\n\n/m;

function sha256(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

function strippedLocal() {
  const text = readFileSync(LOCAL, "utf8");
  if (!MIRROR_CALLOUT.test(text)) {
    fail(
      `${LOCAL} is missing the "> **Mirror copy.**" callout block.\n` +
        `That block is the single allow-listed delta from canonical and must\n` +
        `appear at the top of the file.`,
    );
  }
  return text.replace(MIRROR_CALLOUT, "");
}

function fail(msg) {
  process.stderr.write(`design-mirror gate: ${msg}\n`);
  process.exit(1);
}

if (process.argv.includes("--update")) {
  if (!existsSync(CANONICAL)) {
    fail(
      `--update requires ${CANONICAL} (the umbrella canonical) to be present.\n` +
        `Run this command from a full umbrella checkout, not a runlog-website-only clone.`,
    );
  }
  const canonical = readFileSync(CANONICAL);
  const hash = sha256(canonical);
  writeFileSync(HASH_FILE, `${hash}\n`);
  process.stdout.write(
    `design-mirror gate: stored hash refreshed → ${hash}\n` +
      `Don't forget to sync DESIGN.md content from canonical and commit both files.\n`,
  );
  process.exit(0);
}

if (!existsSync(HASH_FILE)) {
  fail(`missing ${HASH_FILE}. Run with --update from an umbrella checkout to seed it.`);
}

const expected = readFileSync(HASH_FILE, "utf8").trim();
const actual = sha256(strippedLocal());

if (actual === expected) {
  process.exit(0);
}

let hint = "";
if (existsSync(CANONICAL)) {
  const canonicalHash = sha256(readFileSync(CANONICAL));
  if (canonicalHash === actual) {
    hint =
      `\nThe local mirror MATCHES the canonical at ${CANONICAL},\n` +
      `but the stored hash is stale. Run:  node scripts/check-design-mirror.mjs --update`;
  } else if (canonicalHash === expected) {
    hint =
      `\nThe stored hash matches canonical, but DESIGN.md has diverged.\n` +
      `Re-sync DESIGN.md from ${CANONICAL} (keep the Mirror copy callout).`;
  } else {
    hint =
      `\nBoth DESIGN.md and the stored hash diverge from ${CANONICAL}.\n` +
      `Sync DESIGN.md to canonical, then run:  node scripts/check-design-mirror.mjs --update`;
  }
} else {
  hint =
    `\n(Canonical at ${CANONICAL} not reachable in this checkout.\n` +
    `From an umbrella checkout: sync DESIGN.md from canonical, then\n` +
    `run:  node scripts/check-design-mirror.mjs --update)`;
}

fail(
  `DESIGN.md drift detected.\n` +
    `  expected SHA-256 (stripped): ${expected}\n` +
    `  actual   SHA-256 (stripped): ${actual}${hint}`,
);
