---
title: "The four-point client contract: how Runlog plugs into your agent"
description: "Every supported agent ships read, author, and harvest skills implementing the same four-point contract. Without the skill, Runlog is just three MCP tools the agent doesn't know when to call."
pubDate: 2026-05-03
readTime: "~8 min read"
---

<section aria-labelledby="hero-title" class="prose">
  <h1 id="hero-title">The four-point client contract: how Runlog plugs into your agent</h1>
  <p class="meta"><time datetime="2026-05-03">2026-05-03</time> &middot; ~8 min read</p>
  <p class="lede">
    Every supported agent ships read, author, and harvest skills implementing the same
    four-point contract. Without the skill, Runlog is just three MCP tools the agent
    doesn&rsquo;t know when to call.
  </p>
  <p>
    This is the fourth post in the <a href="/blog/inside-runlog-overview/">Inside Runlog</a>
    series. The previous posts covered the overall design, the verification mechanism, and
    the sanitization pipeline. This post is about the agent-facing layer: how Runlog is
    installed, what the three MCP tools actually do, why the skill wrapper matters, and
    what the four-point contract requires of every official integration.
  </p>
</section>

<section aria-labelledby="three-tools-title" class="prose">
  <h2 id="three-tools-title">Three tools, one contract</h2>
  <p>
    The Runlog MCP server exposes three primary tools. Their signatures are backwards-compatible
    by design &mdash; once shipped, the name, every existing input parameter, and every
    existing output field are locked. Skills installed months apart will call the same
    signatures, and the server must understand all of them indefinitely.
  </p>
  <p>
    <strong><code>runlog_search</code></strong> takes a natural-language query, a list of
    domain tags, and optional version constraints. It returns ranked entries with confidence
    scores, verification status, and submitter trust scores. This is the read path: called
    mid-session when the agent encounters a problem it suspects concerns an external
    dependency.
  </p>
  <p>
    <strong><code>runlog_submit</code></strong> takes a structured entry and a signed
    verification bundle. It returns an entry ID and an estimated confidence threshold for
    the entry to reach verified status. This is the author path: called after the agent has
    found a reproducible fix, run the verifier, and assembled the signed bundle. Every
    submission passes through the four-layer sanitization pipeline described in the
    <a href="/blog/inside-runlog-scope-rule/">scope rule post</a>. A rejected submission
    returns an error code that names the layer.
  </p>
  <p>
    <strong><code>runlog_report</code></strong> takes an entry ID, an outcome
    (<code>success</code> or <code>failure</code>), and a session manifest. It returns an
    acknowledgment and an updated confidence score. This is the harvest path: called at
    the end of a session to report whether entries retrieved during that session worked.
    The session manifest is what enables the dependency-manifest correlation described in
    the <a href="/blog/inside-runlog-verification/">verification post</a> &mdash; the
    mechanism that catches delayed failures by correlating error reports with their Runlog
    entry provenance.
  </p>
  <p>
    Three tools is a deliberately small surface. The design philosophy is that Runlog
    should be easy to implement against, easy to audit, and hard to break accidentally.
    An agent that knows how to call these three tools and understands what they return
    has the full read/write/report surface. What it does not have, without additional
    instruction, is any sense of when to call them.
  </p>
</section>

<section aria-labelledby="skill-title" class="prose">
  <h2 id="skill-title">Why the skill exists</h2>
  <p>
    Exposing three MCP tools is not the same as integrating with an agent. An MCP server
    makes its tools discoverable, but an agent that discovers a tool still needs to know
    when that tool is appropriate to call, how to classify the problem before calling, what
    to do with the result, and how to route a new learning after the session ends.
  </p>
  <p>
    Without a skill, an agent given access to <code>runlog_search</code> might call it on
    every problem &mdash; including problems about internal systems that should stay in
    team memory, and problems that team memory already answers. It might call
    <code>runlog_submit</code> without having run the verifier, producing a submission that
    the sanitization pipeline will reject. It might never call <code>runlog_report</code>
    at all, leaving the session manifest empty and depriving the trust-scoring system of
    the confirmation signal it needs.
  </p>
  <p>
    The skill is the instruction layer that teaches the agent when and how to use the
    tools. It is installed once per agent host and does not require re-installation when
    the server adds features. Skills are intentionally frozen after installation &mdash;
    there is no auto-update mechanism &mdash; which is one of the reasons the MCP tool
    signatures are backwards-compatibility locked: skills from older installs must continue
    to work against a server that has evolved.
  </p>
</section>

<section aria-labelledby="four-points-title" class="prose">
  <h2 id="four-points-title">The four-point contract</h2>
  <p>
    Every official MCP client skill &mdash; and every third-party skill that wants to be
    listed as officially compatible &mdash; must implement the same four-point contract.
    These are not recommendations; they are the requirements that make the integration
    correct:
  </p>
  <p>
    <strong>Point 1: Check team memory first.</strong> Before calling <code>runlog_search</code>,
    the skill must consult the agent&rsquo;s team-memory surface. If team memory answers
    the question, <code>runlog_search</code> is not called. This keeps Runlog in the
    position of a complement rather than a substitute: it is the fallback for external
    knowledge the team doesn&rsquo;t have, not the first stop for every question.
  </p>
  <p>
    <strong>Point 2: Classify before calling.</strong> The skill must determine whether
    the problem concerns an external dependency before calling <code>runlog_search</code>.
    Problems about internal code, team conventions, or anything the agent&rsquo;s
    existing context can resolve stay out of Runlog entirely. Only problems that are
    genuinely about a third-party system trigger a search call. This classification is
    what prevents the registry from becoming a catch-all retrieval backend for problems
    it was never designed to answer.
  </p>
  <p>
    <strong>Point 3: Route learnings to the correct layer.</strong> When the agent solves
    a problem, the skill must determine where the learning belongs. Team memory gets
    internal-domain knowledge: conventions, codebase-specific decisions, things only
    relevant to the current org. Runlog gets external-system knowledge: reproducible
    findings about third-party systems that other teams would benefit from. The skill is
    responsible for this classification, and the sanitization pipeline on the server is
    the backstop that rejects misclassifications.
  </p>
  <p>
    <strong>Point 4: Maintain the manifest and report outcomes.</strong> The skill must
    track the IDs of every Runlog entry retrieved during the session and submit the
    session manifest with <code>runlog_report</code> at session end. Empty manifests are
    accepted from clients that haven&rsquo;t wired a tracker yet, but they do not
    contribute to the trust-scoring signals. The manifest is the data structure that makes
    delayed failure attribution possible &mdash; and a skill that never sends one is
    contributing to the public commons without contributing to its quality.
  </p>
</section>

<section aria-labelledby="workflow-title" class="prose">
  <h2 id="workflow-title">What the workflow looks like in practice</h2>
  <p>
    The agent encounters a problem. The skill checks team memory: is this answered by a
    CLAUDE.md rule, a Cursor context file, or a mem0 lookup? If yes, apply the answer and
    move on. If no, the skill classifies: is this about an external dependency? If not,
    the agent solves it directly and updates team memory if the solution is team-specific.
  </p>
  <p>
    If the problem is external, the skill calls <code>runlog_search</code> with the query
    and the relevant domain tags. The server returns ranked entries. The skill applies the
    most relevant one. The entry ID is recorded in the session manifest.
  </p>
  <p>
    If the search returns no useful result and the agent independently finds a fix, the
    skill checks whether the fix is generic to the external system. If it is, it triggers
    the author flow: the verifier runs on the submitter&rsquo;s machine, the signed bundle
    is assembled, and <code>runlog_submit</code> is called. If the submission passes the
    sanitization pipeline, a new entry lands in the registry.
  </p>
  <p>
    At session end, <code>runlog_report</code> is called with the full session manifest
    and the outcome of each entry used. Successful applications contribute positive
    confirmation weight. Failed applications trigger the dependency-manifest correlation
    that may eventually surface a problem with a specific entry across many independent
    sessions.
  </p>
  <p>
    This workflow is the concrete form of the &ldquo;complementary by design&rdquo;
    principle from the <a href="/blog/inside-runlog-overview/">overview post</a>. The
    skill is what ensures Runlog never competes with team memory, never calls the registry
    for problems outside its scope, and never leaves the trust-scoring system without
    the confirmation data it needs.
  </p>
</section>

<section aria-labelledby="adapters-title" class="prose">
  <h2 id="adapters-title">Nine vendor adapters</h2>
  <p>
    The official skills are open source in the
    <a href="https://github.com/runlog-org/runlog-skills">runlog-skills</a> repository.
    Each is a thin adapter that wraps the four-point contract in the convention of a
    specific agent host &mdash; the SKILL.md format that Claude Code reads, the rules
    file that Cursor applies, the context document that a continue or Cline session
    loads. The contract is identical across all of them; what differs is how the
    instructions are surfaced to the agent.
  </p>
  <p>
    The full list of supported agents is at <a href="/agents/">/agents/</a>. Third-party
    skills are welcome and can be submitted for official-compatible listing if they
    implement the four-point contract. The contract is the requirement; the adapter format
    is the implementation choice.
  </p>
  <p>
    The final post in this series covers how the seven repos that make up Runlog ship
    independently without locking each other. See
    <a href="/blog/inside-runlog-release-trains/">&ldquo;Release trains: how seven
    repos ship independently.&rdquo;</a>
  </p>
  <p>
    Notes by Volker Otto. Comments and corrections welcome at
    <a href="mailto:runlog@volkerotto.net">runlog@volkerotto.net</a>.
  </p>
</section>
