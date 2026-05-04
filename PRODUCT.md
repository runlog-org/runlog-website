# Product

## Register

brand

## Users

Working software engineers who use coding agents — Claude Code, Cursor, Cline, Continue, Windsurf, Aider, VS Code Copilot, JetBrains AI, Zed. Sophisticated, skeptical readers who already live in terminals, GitHub issues, and RFCs. They hit external-dependency problems daily (a quirk of an SDK, an undocumented edge case in a public API, a protocol gotcha) and they recognise the difference between a product that ships verified knowledge and a product that ships marketing about verified knowledge.

The visitor lands on `runlog.org` in one of three states: (1) referred from another developer or a tweet, curious enough to evaluate; (2) actively in pain on a third-party-system bug, looking for whether Runlog could have prevented it; (3) installing the MCP plugin for the first time and looking for the API-key flow. The site has to serve all three without funnelling them.

Secondary audiences: technically literate decision-makers (CTOs, staff engineers) doing diligence; the open-source / agent-tooling community evaluating whether to adapt or contribute; researchers interested in the verification model.

## Product Purpose

Make the right visitor register for an API key, install the matching vendor adapter, and walk away with a calibrated understanding of what Runlog does and doesn't replace. The "right" visitor is one whose work involves third-party systems and who is already running a coding agent — anyone else should leave understanding why this isn't for them, not feeling pitched.

Three jobs the site has to do:

1. **Position cleanly against the team-memory category.** Runlog complements `CLAUDE.md`, Cursor rules, mem0, Letta — it doesn't replace them. The site says this explicitly and repeatedly, because the wrong framing burns trust before the product can earn it.
2. **Make the verification model legible.** "Trust earned through signed verification and field telemetry, not votes" is the core differentiation. The site has to explain it in enough depth that a sceptical engineer believes it without reading the source.
3. **Honest expectations.** Runlog is a hobby side project today. No pricing, no SLAs, no support contracts. The site says so on the homepage. Visitors who'd resent that calibration self-select out, which is the desired outcome.

Success is a registered API key, a successful first `runlog_search` call, and a returning visit a week later. Conversion-funnel optimisation is explicitly **not** a goal.

## Brand Personality

**Technical · Plainspoken · Self-aware.**

The voice is an engineer who has shipped production systems, has read the RFCs, and has nothing to prove. Confidence comes from precision and openness about limitations, never from superlatives. Reads like a well-written `README.md`, not a SaaS landing page. Acknowledges the ecosystem honestly (Stack Overflow, Context7, mem0, Letta all get named directly and treated fairly). Talks to readers as peers, not leads.

Specific voice rules — already canonical in [`design.md` §7](./DESIGN.md):

- Prefer "verified" over "trusted." Verification is a process; trust is a feeling.
- Prefer "registry" over "platform." Registry is a thing; platform is a category.
- Avoid "AI-powered," "next-generation," "revolutionary." Those words are noise.
- Code voice in code, prose voice in prose.

## Anti-references

- **Generic AI / SaaS landing pages** — gradient meshes, hero CTAs in giant pill buttons, illustrations of robots holding clipboards, "Get started in seconds" above-the-fold. The category Runlog explicitly is *not* part of.
- **Vector-DB / "agent memory platform" marketing** (mem0, Letta, Zep). Runlog is adjacent to and complementary to these tools, not a competing platform — the site cannot read like one of theirs.
- **Stack Overflow's voting / reputation aesthetic.** Karma scores, gold/silver/bronze, leaderboards. Runlog's whole thesis is that votes don't earn trust; the visual language has to match.
- **Crypto / web3 sites** — neon on black, "the future of …" copy, glassmorphic stacked cards, mascot illustrations. Wrong audience, wrong tone, wrong category.
- **Stripe-clone marketing** *(narrowly).* The visual aesthetic borrows from Stripe — clean, light surfaces, soft purple-blues, generous whitespace. The *copy* must not. Stripe pages are polished consumer-marketing; Runlog pages are engineer-to-engineer.
- **Hero-metric template** — big number, small label, supporting stats, gradient accent. Runlog has real numbers (verified entries, vendor count) but those go in the page where they belong, never as decoration.

## Design Principles

1. **Practise what we preach.** The site claims Runlog is verified, decay-aware, infrastructure for engineers. The site itself has to read as verified, decay-aware infrastructure: real code blocks that copy-paste cleanly, real API URLs, real version numbers, no screenshots used as proof.

2. **Honesty as feature.** Limitations live above the fold, not below the cut. "Hobby side project — not a commercial product today" is on the homepage on purpose. Visitors who can't accept that calibration self-select out, which is the right outcome.

3. **Stay in lane, loudly.** Every page reinforces what Runlog does *not* do. Team-memory tools own internal knowledge; Runlog stays out of that scope. Explicit complementarity beats implicit competition.

4. **Engineer-readable, not skim-readable.** Dense paragraphs over bullet stacks. Definition lists when comparing concepts. Code samples that work copy-pasted. Optimised for someone who reads `man` pages, not someone who skims tweets.

5. **Earned attention only.** No exit-intent modals, no scroll-jacking, no "Get a demo" CTAs, no chat-widget bubble, no cookie banner that demands a choice for non-essential cookies (because there are none). The reader's time is finite; respect it visibly.

## Accessibility & Inclusion

- **WCAG 2.1 AA target.** Contrast ratios on the indigo-on-paper palette already pass AA at body sizes (4.5:1) and AAA at heading sizes. Audit pending — `$impeccable audit` will validate.
- **Reduced motion.** Site has minimal motion today; any animation added must respect `prefers-reduced-motion: reduce`.
- **Bilingual content.** English is primary; German is required for `/impressum` and `/datenschutz` (legal compliance). Latin-1 subset on the self-hosted fonts covers German diacritics.
- **Auto dark/light.** Switches on `prefers-color-scheme` — no manual toggle in v1, by design (one less control to maintain, one less thing to mis-design). Both themes are first-class, not afterthoughts.
- **Screen-reader navigation.** Semantic landmarks (`<header>`, `<main>`, `<nav>`, `<article>`, `<section>` with `aria-labelledby`) are already in place across most pages. Heading hierarchy stays sensible (no skipping from `h1` to `h3`).
- **Keyboard navigation.** Focus-visible outlines use the brand indigo; tab order should follow visual reading order. To be verified in audit.
