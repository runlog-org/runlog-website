# Runlog — Brand & Design

> **Mirror copy.** The canonical source lives in [`runlog-org/.github/design.md`](https://github.com/runlog-org/.github/blob/main/design.md) (locally `../dotgithub/design.md`). Edit there, then refresh this file. This local copy exists so impeccable's loader and any project-local tooling can find a `DESIGN.md` at the website root.

A starting point for Runlog's visual identity. Cross-repo: applies to the
website, public READMEs, blog headers, and any future surfaces (slides,
social cards, docs site).

Aesthetic anchor: **Stripe-clean** — light, generous whitespace, soft
blue-violet hues, multi-step grey scale for typographic hierarchy. The
bracketed `[R]` logo gives Runlog a code-syntax accent that Stripe doesn't
have; we lean into that.

---

## 1. Identity in one paragraph

Runlog is a **registry of verified knowledge for coding agents.** The brand
should read as *technical, calm, trustworthy*: a place where claims are
signed and checked, not marketed. Visual language stays close to the tools
its users already live in — terminals, code editors, API consoles. No
gradients-as-personality, no mascot, no exclamation marks. The `[R]` logo
is the only ornament that needs to do work.

---

## 2. Color tokens

Two palettes — **light** (default) and **dark** — with parallel token names.
All values are HEX. The website's existing `--color-*` variables map onto
these one-to-one (see §6).

### 2.1 Brand

| Token | Light | Dark | Use |
|---|---|---|---|
| `brand/indigo`   | `#5B5BD6` | `#8A8AFF` | Primary — links, focus rings, CTAs, [R] accent fill |
| `brand/cobalt`   | `#2D63E2` | `#6CA0FF` | Secondary blue — diagrams, secondary CTAs, badges |
| `brand/lavender` | `#EDEBFE` | `#1E1B3A` | Tinted surface — install boxes, hero panels, "verified" chips |
| `brand/ink`      | `#0E1116` | `#F4F5F7` | The logo. Always near-black on light, near-white on dark |

`indigo` is the "purple-blue" — it reads violet next to white, blue next to
red. `cobalt` is the cleaner blue for moments where indigo would compete
with the logo. Use indigo 80% of the time; reach for cobalt only when you
need a second voice.

### 2.2 Neutral scale (greys for type)

Five steps. Pick **by role**, not by visual taste — that's how the scale
stays consistent across surfaces.

| Token | Light | Dark | Role |
|---|---|---|---|
| `ink/900` | `#0E1116` | `#F4F5F7` | Headings, hero copy, logo |
| `ink/700` | `#1F2330` | `#D4D7DD` | Body text |
| `ink/500` | `#4B5563` | `#9098A4` | Secondary text, metadata |
| `ink/400` | `#6B7280` | `#7B8390` | Muted — captions, footer, "lede" subtitles |
| `ink/300` | `#9CA3AF` | `#5C6470` | Hairline labels, placeholders, disabled |

### 2.3 Surface

| Token | Light | Dark | Role |
|---|---|---|---|
| `surface/page`    | `#FAFAFB` | `#0B0D12` | Body background |
| `surface/card`    | `#FFFFFF` | `#13161D` | Cards, modals, raised panels |
| `surface/code`    | `#F6F7F9` | `#0F1218` | `<pre>` and `<code>` blocks |
| `surface/hairline`| `#E5E7EB` | `#1F2430` | 1px borders, dividers |

The page background is **off-white, slightly cool**, not pure white.
Distinguishing page from card surfaces is what makes the layout feel
Stripe-like rather than Notion-like.

### 2.4 Semantic

| Token | Light | Dark | Use |
|---|---|---|---|
| `state/success` | `#0F9D58` | `#34D399` | "verified" status, signed checkmarks |
| `state/warn`    | `#B45309` | `#F59E0B` | Stale entries, decay warnings |
| `state/error`   | `#B42318` | `#F87171` | Rejection reasons, sanitization fails |

Use sparingly. These are **status colors**, not decoration.

### 2.5 Qualitative diagram palette

For diagrams that need to **encode categories** (architecture diagrams,
flow charts, sequence labels, "this kind of node vs. that kind"), use this
4-color scale. Cobalt is intentionally **excluded** here — it's too close
to indigo for small marks. Order matters: when you only need 2 colors, use
the first two.

| Slot | Token | Light | Dark |
|---|---|---|---|
| 1 | `qual/indigo` | `#5B5BD6` | `#8A8AFF` |
| 2 | `qual/teal`   | `#0E9384` | `#5EEAD4` |
| 3 | `qual/amber`  | `#D97706` | `#FBBF24` |
| 4 | `qual/rose`   | `#DB2777` | `#F472B6` |

Two cools (indigo, teal) + two warms (amber, rose) — perceptually distinct
even at small sizes and in greyscale print. **Do not** mix qualitative
colors with semantic status colors in the same diagram; the reader can't
tell which axis is which. If a diagram needs both, draw status as
shape/icon and category as fill.

A 5th slot, if ever needed, is `slate` `#475569` / `#94A3B8` — desaturated,
recedes behind the others.

---

## 3. Typography

| Role | Family | Notes |
|---|---|---|
| UI / display | **Inter**, fallback `system-ui, -apple-system, sans-serif` | Geometric, neutral, ships everywhere. Stripe-adjacent. |
| Mono / code  | **JetBrains Mono**, fallback `ui-monospace, SFMono-Regular, Menlo, monospace` | Reinforces the `[R]` bracket logo and the registry-of-code-knowledge story. |
| Numerals     | Tabular figures (`font-feature-settings: "tnum"`) for tables, prices, version strings | |

Both families are **self-hosted** — no Google Fonts CDN, no third-party
requests. Ship two weights each (400, 600) as `woff2`, latin subset
(German diacritics covered by the latin-1 supplement block), served
from the same origin under `/assets/fonts/`. All four `@font-face`
rules use `font-display: swap`.

Preload only the **always-rendered** weights (Inter 400 + 600). Mono
fires only when `<pre>`/`<code>` enters the layout, so it lazy-loads
via `@font-face`:

```html
<link rel="preload" href="/assets/fonts/Inter-400.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/assets/fonts/Inter-600.woff2" as="font" type="font/woff2" crossorigin>
```

Total wire weight ≈ 91 KB across the four files (Inter 400 ~24 KB, Inter
600 ~25 KB, JetBrains Mono 400 ~21 KB, 600 ~22 KB). Cached for one year
via `Cache-Control: public, max-age=31536000, immutable` — bumping a
font means renaming the file, not editing in place.

Source: `@fontsource/inter@5` and `@fontsource/jetbrains-mono@5`,
downloaded directly from `cdn.jsdelivr.net` (no npm dependency, files
vendored into the repo).

Scale (light theme):

| Use | Size | Line | Weight | Color |
|---|---|---|---|---|
| Hero / H1   | 2.25rem | 1.1  | 600 | `ink/900` |
| H2          | 1.5rem  | 1.25 | 600 | `ink/900` |
| H3          | 1.125rem| 1.3  | 600 | `ink/900` |
| Body        | 1rem    | 1.55 | 400 | `ink/700` |
| Lede        | 1.15rem | 1.5  | 400 | `ink/500` |
| Small / meta| 0.875rem| 1.45 | 400 | `ink/400` |
| Code        | 0.9rem  | 1.5  | 400 | `ink/700` on `surface/code` |

---

## 4. Geometry

- **Radii:** `4px` for inputs/buttons/code blocks, `6px` for cards, `999px` for chips. No softer than that — Runlog is an instrument, not a toy.
- **Borders:** 1px, `surface/hairline`. Avoid heavy borders; rely on hairlines + surface contrast.
- **Shadows:** None on the website itself. Reserve for floating UI (tooltips, dropdowns) at `0 1px 2px rgba(14,17,22,0.06), 0 4px 12px rgba(14,17,22,0.04)`.
- **Spacing:** 4-px base grid. Use the named scale, not raw values — picking `var(--space-6)` over `1.5rem` is what keeps surfaces aligned across pages.
- **Content width:**
  - **Mobile / tablet** (viewport < 60rem): page max `44rem`, `.prose` capped at `38rem` for comfortable line length.
  - **Desktop** (viewport ≥ 60rem): page max `56rem`, `.prose` fills the page — no separate prose cap. The wider container *is* the line-length budget.
  - Marketing heroes may pin tighter via inline `max-width` (e.g. the homepage hero stays at `36rem`).

Spacing scale (CSS custom properties, all in `rem`):

| Token | Value | Typical use |
|---|---|---|
| `--space-1` | 0.25 | Hairline gaps inside chips |
| `--space-2` | 0.5  | Heading → first paragraph, inline gaps |
| `--space-3` | 0.75 | Inputs, button padding |
| `--space-4` | 1    | Default body padding (mobile), card padding |
| `--space-5` | 1.25 | Compact section padding |
| `--space-6` | 1.5  | h3 top margin, card padding (roomy) |
| `--space-8` | 2    | Body padding (mobile), block-level margins |
| `--space-10`| 2.5  | Section gaps on mobile |
| `--space-12`| 3    | Body padding (desktop) |
| `--space-16`| 4    | Section gaps on desktop |
| `--space-20`| 5    | Hero / marketing breathing room |

Three semantic tokens compose the scale:

| Token | Mobile | Desktop (≥60rem) | Drives |
|---|---|---|---|
| `--page-y`    | `--space-8`  | `--space-12` | `<body>` vertical padding |
| `--page-x`    | `--space-4`  | `--space-6`  | `<body>` horizontal padding |
| `--section-y` | `--space-10` | `--space-16` | top margin of every `<h2>` |

---

## 5. Logo usage

The `[R]` monogram is the primary mark. Three lockups:

1. **Monogram only** — `[R]` in `brand/ink`. Use for favicons, app icons, social avatars.
2. **Wordmark** — `Runlog` set in Inter 600, tracking `-0.01em`. Use in nav bars and footers where the monogram would be redundant.
3. **Lockup** — `[R]` + `Runlog` horizontal, with the bracket height matching the cap height of the wordmark.

Rules:

- Clear space around the monogram = the height of one bracket arm. Nothing closer.
- Minimum size: 16 px monogram, 20 px lockup.
- Color: `brand/ink` on light surfaces, `brand/ink` (light token) on dark surfaces. Single color only — **no gradient fills, no outlines, no rotation, no animation**.
- One sanctioned tinted variant: `brand/indigo` monogram on `brand/lavender` background, used as a chip/badge ("Runlog Verified").

---

## 6. Mapping to the current website

The site already has the right token shape — it just needs the values
swapped and one or two new tokens added. In `runlog-website/src/input.css`:

```css
@theme {
  --color-bg:        #FAFAFB;   /* was #ffffff */
  --color-fg:        #1F2330;   /* was #1a1a1a */
  --color-muted:     #6B7280;   /* was #555555 */
  --color-border:    #E5E7EB;   /* was #cccccc */
  --color-brand:     #5B5BD6;   /* was #0060df — indigo, not pure blue */
  --color-accent:    #2D63E2;   /* NEW — secondary cobalt */
  --color-tint:      #EDEBFE;   /* NEW — lavender tint */
  --color-code-bg:   #F6F7F9;   /* was #f4f4f4 */
  --color-on-brand:  #FFFFFF;
  --color-ink:       #0E1116;   /* NEW — heading ink */

  --font-sans: "Inter", system-ui, -apple-system, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
}

@media (prefers-color-scheme: dark) {
  :root {
    --color-bg:       #0B0D12;
    --color-fg:       #D4D7DD;
    --color-muted:    #9098A4;
    --color-border:   #1F2430;
    --color-brand:    #8A8AFF;
    --color-accent:   #6CA0FF;
    --color-tint:     #1E1B3A;
    --color-code-bg:  #0F1218;
    --color-ink:      #F4F5F7;
  }
}
```

Touch points elsewhere:

- `<meta name="theme-color">` in every `*.html` head: `#5B5BD6` (was `#0060df`).
- README badge colors: switch the brand-blue badges to `5B5BD6`.
- Blog post headers: H1 in `--color-ink`, lede in `--color-muted`.

---

## 7. Voice & tone

One sentence: **plain technical English, no hype**.

- Prefer "verified" over "trusted." Verification is a process; trust is a feeling.
- Prefer "registry" over "platform." Registry is a thing; platform is a category.
- Avoid "AI-powered," "next-generation," "revolutionary." Avoid em dashes used as drama.
- Code voice in code, prose voice in prose. Don't quote function names mid-sentence to sound technical — only use code formatting when the reader would type the literal characters.

---

*Canonical home: [`runlog-org/.github`](https://github.com/runlog-org/.github)
(checked out locally at `dotgithub/`). Public on purpose — every Runlog
surface, public or private, consumes these tokens.*
