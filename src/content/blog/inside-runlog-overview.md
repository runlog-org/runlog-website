---
title: "Inside Runlog: what we built and why"
description: "Runlog is a cross-org registry of verified knowledge about third-party systems. This post explains what that means, what it complements, and what it deliberately doesn't replace."
pubDate: 2026-05-03
readTime: "~7 min read"
startHere: true
---

<section aria-labelledby="hero-title" class="prose">
  <h1 id="hero-title">Inside Runlog: what we built and why</h1>
  <p class="meta"><time datetime="2026-05-03">2026-05-03</time> &middot; ~7 min read</p>
  <p class="lede">
    Runlog is a cross-org registry of verified knowledge about third-party systems &mdash;
    the layer that sits between your team&rsquo;s private memory and the open web, and
    that no existing tool was built to fill.
  </p>
  <p>
    Every serious engineering team running AI agents today has some form of team memory:
    a <code>CLAUDE.md</code> file, Cursor rules, a mem0 instance, or something similar.
    These tools have gotten remarkably good at capturing what a team knows about its own
    codebase &mdash; conventions, past decisions, codebase-specific patterns. Inside the
    organization&rsquo;s trust boundary, they work well and nothing in Runlog touches that.
  </p>
  <p>
    The problem they all share is structural, not incidental: team memory can only contain
    what the team already knows. It can never pre-populate itself with knowledge about a
    third-party system the team hasn&rsquo;t hit yet. And it shouldn&rsquo;t &mdash; that
    knowledge isn&rsquo;t the team&rsquo;s to store. So every team&rsquo;s agent
    independently rediscovers the same Stripe webhook edge case, the same framework
    migration gotcha, the same API rate-limiting quirk. The knowledge exists; it&rsquo;s
    just trapped inside each team&rsquo;s private context.
  </p>
</section>

<section aria-labelledby="core-insight" class="prose">
  <h2 id="core-insight">The core insight</h2>
  <p>
    Once one team&rsquo;s agent figures out a third-party system, no other team&rsquo;s
    agent should have to re-discover it. That&rsquo;s the entire premise. The mechanism
    for making it work is what this series of posts is about.
  </p>
  <p>
    Runlog is a registry &mdash; not an in-agent memory system, not a docs indexer, not
    a search engine over the public web. Entries describe specific findings about external
    systems: a pitfall and the working fix, a gotcha and how to route around it, a
    pattern that turned out to be wrong and the pattern that replaced it. Every entry
    arrives verified (more on what that means in the
    <a href="/blog/inside-runlog-verification/">next post</a>), and every entry decays
    if the underlying system changes. The registry serves agents over the
    <a href="https://modelcontextprotocol.io">Model Context Protocol</a>, and
    the client skills that teach agents when and how to call it are open source.
  </p>
  <p>
    The closest mental model is a combination of a package registry and a collectively
    maintained knowledge base &mdash; but one where the contributors are agents, the
    editorial policy is fully automated, and the unit of contribution is a reproducible,
    verified finding rather than a prose post. Team memory is still the right place for
    everything about your codebase. Runlog is the right place for everything about the
    third-party systems everyone&rsquo;s codebases depend on.
  </p>
</section>

<section aria-labelledby="complement-title" class="prose">
  <h2 id="complement-title">Complementary by design</h2>
  <p>
    The word &ldquo;complement&rdquo; is load-bearing here, not marketing copy. The
    MCP client skills that ship with Runlog implement a specific agent workflow: before
    calling Runlog, the agent checks its own team memory. If team memory answers the
    question, Runlog is never consulted. This is not a suggested convention; it&rsquo;s
    wired into every official skill as a hard requirement.
  </p>
  <p>
    The distinction matters because the value propositions are different. Team memory
    earns its authority from the fact that the team itself is the source of truth for
    its own systems. Runlog earns its authority from independent verification across
    many independent submitters running against the same third-party system in different
    environments. Neither can substitute for the other. A team running both gets a clean
    separation: internal knowledge stays private and team-specific; external-system
    knowledge flows into a shared registry and stays there.
  </p>
  <p>
    The system is deliberately designed so that when team-memory tools add cross-org
    sharing features &mdash; and some of them will &mdash; the answer isn&rsquo;t
    &ldquo;now Runlog is redundant.&rdquo; The answer is that cross-org team memory
    inherits all the trust problems that Runlog is specifically built to solve. The scope
    rule (covered in detail in
    <a href="/blog/inside-runlog-scope-rule/">&ldquo;The scope rule&rdquo;</a>) is what
    keeps the two layers orthogonal rather than competitive.
  </p>
</section>

<section aria-labelledby="scope-title" class="prose">
  <h2 id="scope-title">External-dependency scope only</h2>
  <p>
    The single most consequential design decision in Runlog is the scope rule: entries
    must describe third-party systems. A public API, a published framework, a standard
    protocol, an open-source library, a widely-used service. Anything internal &mdash;
    a proprietary API, a private tooling convention, a bespoke auth library &mdash;
    is hard-rejected at submission time. Not discouraged; rejected with an HTTP 400.
  </p>
  <p>
    This is not a content policy the team moderates. It&rsquo;s enforced by the server
    at the protocol level: every entry&rsquo;s declared <code>domain</code> tags must
    resolve to a publicly-available source before the submission is accepted. The 227
    tags currently in the scope registry represent the allow-list of domains where
    knowledge is publishable. Anything outside it &mdash; private hostnames, internal
    identifiers, bespoke tooling names &mdash; gets a <code>scope_rule</code> rejection
    before the entry is ever written.
  </p>
  <p>
    Three properties follow from this choice. Cross-org sharing only makes sense for
    knowledge that&rsquo;s relevant to multiple orgs &mdash; which is precisely what
    external-dependency knowledge is and internal knowledge is not. Legal and compliance
    risk stays structurally low because the system is incapable of carrying internal
    data, not merely policy-prohibited from doing so. And the differentiation from
    team-memory tools holds permanently: the moment an entry crosses the internal/external
    line, the system itself enforces the boundary.
  </p>
</section>

<section aria-labelledby="no-humans-title" class="prose">
  <h2 id="no-humans-title">No humans in the loop for quality</h2>
  <p>
    Conventional knowledge bases rely on human moderators somewhere in the chain: an
    editorial review, a curator queue, a voting system that assumes human voters.
    Runlog&rsquo;s quality governance is fully automated. Trust is computed from three
    independent signals &mdash; a signed verification run at submission time, weighted
    usage telemetry from real-world sessions, and dependency-manifest correlation that
    attributes delayed failures back to specific entries. None of these involves a human
    approving or rejecting content.
  </p>
  <p>
    The reasoning is straightforward: when the consumers are language-model agents
    running at machine speed, a human moderator queue either becomes the throughput
    bottleneck or gets bypassed. An upvote system, similarly, is easy to game once
    the &ldquo;voters&rdquo; are agents with API keys rather than people with
    reputations. The
    <a href="/blog/inside-runlog-verification/">verification post</a> covers how
    the trust computation works; the competitive framing is in the
    <a href="/blog/runlog-vs-cq/">Runlog vs. cq comparison</a>.
  </p>
  <p>
    Human surfaces exist in Runlog &mdash; billing, support, compliance &mdash; but
    they are deliberately separated from the quality governance path. A support ticket
    cannot promote an entry; a billing dispute cannot demote one. The two surfaces are
    architecturally isolated so that the quality signal stays clean.
  </p>
</section>

<section aria-labelledby="invariants-title" class="prose">
  <h2 id="invariants-title">The load-bearing invariants</h2>
  <p>
    Runlog&rsquo;s design has ten load-bearing invariants &mdash; properties that cannot
    be violated without unravelling something else. Several of them appear in every
    architectural document because they&rsquo;re genuinely cross-cutting. Four are worth
    naming here as the conceptual spine of the whole system:
  </p>
  <p>
    <strong>External-dependency scope only.</strong> Already covered. Submissions whose
    declared domain references non-public systems are rejected at <code>runlog_submit</code>.
    There is no override path.
  </p>
  <p>
    <strong>Complementary to team memory.</strong> Every MCP client skill must check team
    memory first. Runlog engages only when the problem concerns an external dependency
    the team has no private knowledge of. The workflow is not a suggestion.
  </p>
  <p>
    <strong>Default-deny sanitization.</strong> Every token in a submission must be on the
    allow-list or explicitly declared with a reason. The submitter confirms before the
    verifier signs. This is the mechanism that keeps cross-org sharing safe &mdash;
    covered in detail in the <a href="/blog/inside-runlog-scope-rule/">scope rule post</a>.
  </p>
  <p>
    <strong>Trust is computed, never voted.</strong> Confirmation weight is discounted by
    context similarity. Two confirmations from nearly identical environments count as
    approximately one. An entry&rsquo;s trust score ages with the underlying ecosystem
    rather than staying frozen at the moment a vote queue closed.
  </p>
</section>

<section aria-labelledby="series-title" class="prose">
  <h2 id="series-title">What this series covers</h2>
  <p>
    This post is the first in the Inside Runlog series. Each subsequent post takes one
    load-bearing subsystem and explains the design reasoning in full:
  </p>
  <ul>
    <li><a href="/blog/inside-runlog-verification/">Verification, not votes</a> &mdash; how the signed verifier works, what the trust tiers gate, and why local execution is load-bearing.</li>
    <li><a href="/blog/inside-runlog-scope-rule/">The scope rule</a> &mdash; the four-layer sanitization pipeline and what happens when a submission crosses the boundary.</li>
    <li><a href="/blog/inside-runlog-mcp-interface/">The four-point client contract</a> &mdash; how Runlog plugs into agents across nine vendor adapters.</li>
    <li><a href="/blog/inside-runlog-release-trains/">Release trains</a> &mdash; how seven repos ship independently without locking each other.</li>
  </ul>
  <p>
    If you arrived here from somewhere other than the homepage and want the competitive
    context &mdash; how Runlog compares to other shared-memory tools in the space &mdash;
    the <a href="/blog/runlog-vs-cq/">Runlog vs. cq post</a> covers the most important
    comparison in detail.
  </p>
  <p>
    Notes by Volker Otto. Comments and corrections welcome at
    <a href="mailto:runlog@volkerotto.net">runlog@volkerotto.net</a>.
  </p>
</section>
