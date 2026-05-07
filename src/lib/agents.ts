// Single source for the supported-agents list. Consumed by the homepage
// (tiles + "Works with …" inline string), the /agents/ page (full cards),
// and /register/ (the trailing list of vendor names). Adding or renaming
// an adapter touches one file.
//
// Order is the canonical display order: reference adapter first, then
// priority-by-adoption, then the ones with caveats.

export type Agent = {
  /** Slug used as the per-vendor anchor on /agents/ and the path under
   *  github.com/runlog-org/runlog-skills/. Must match both. */
  id: string;
  /** Display name. May contain HTML entities (e.g. &nbsp;) — consumers
   *  that render to text should pass it through `set:html` or strip. */
  name: string;
  /** Filename inside /public/assets/img/agents/. */
  logo: string;
  /** One-line headline shown on the /agents/ card. */
  headline: string;
  /** Vendor-specific install path snippet (mono on the card). */
  install: string;
  /** Optional asterisked footnote on the /agents/ card. */
  caveat?: string;
};

export const agents: Agent[] = [
  { id: 'claude-code', name: 'Claude Code',     logo: 'claude-code.png', headline: 'Reference adapter.',                              install: '~/.claude/skills/runlog/' },
  { id: 'cursor',      name: 'Cursor',          logo: 'cursor.png',      headline: 'Highest priority after Claude Code.',             install: '.cursor/rules/runlog.mdc' },
  { id: 'cline',       name: 'Cline',           logo: 'cline.png',       headline: 'Open-source, MCP-native.',                        install: '.clinerules/runlog.md' },
  { id: 'continue',    name: 'Continue.dev',    logo: 'continue.png',    headline: 'Open-source, MCP-native.',                        install: '.continue/config.yaml' },
  { id: 'windsurf',    name: 'Windsurf',        logo: 'windsurf.png',    headline: 'Codeium-based, Cascade agent.',                   install: '.windsurfrules' },
  { id: 'aider',       name: 'Aider',           logo: 'aider.svg',       headline: 'CLI-native, diff-cycle model.',                   install: 'CONVENTIONS.md or --read', caveat: 'MCP support is version-dependent' },
  { id: 'copilot',     name: 'VS&nbsp;Code Copilot', logo: 'copilot.png',headline: 'Requires Copilot agent mode.',                    install: '.github/copilot-instructions.md' },
  { id: 'jetbrains',   name: 'JetBrains&nbsp;AI', logo: 'jetbrains.png', headline: 'IntelliJ, PyCharm, WebStorm, GoLand, …',           install: 'AI Assistant guidelines', caveat: 'Tool-use varies by IDE / plugin version' },
  { id: 'zed',         name: 'Zed',             logo: 'zed.png',         headline: 'Native context_servers + .rules.',                install: '~/.config/zed/settings.json', caveat: 'HTTP context_servers schema is settling' },
];
