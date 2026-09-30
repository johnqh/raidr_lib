/**
 * Install instructions for a published skill. Pure string building; the
 * SKILL.md itself is served by raidr_api.
 */

/** Inputs for `skillInstallInstructions`. */
export interface SkillInstallInput {
  apiHost: string;
  /** Skill name from its frontmatter; becomes the directory name. */
  skillName: string;
  apiBaseUrl: string;
}

/** Copy-ready install commands for one skill. */
export interface SkillInstallInstructions {
  markdownUrl: string;
  /** Downloads SKILL.md into the personal Claude Code skills directory. */
  claudeCurl: string;
  /** Same for the cross-runtime `.agents` directory (Codex, Gemini CLI, Copilot CLI). */
  agentsCurl: string;
  /** Uses raidr_crawler's installer when the checkout is present. */
  crawlerCommand: string;
}

/**
 * Absolute URL of the raw SKILL.md. Duplicates
 * `RaidrClient.skillMarkdownUrl` so it can be called without a client.
 */
export function skillMarkdownUrl(apiBaseUrl: string, apiHost: string): string {
  return `${apiBaseUrl.replace(/\/+$/, '')}/api/v1/skills/${encodeURIComponent(apiHost)}/SKILL.md`;
}

/**
 * Install commands for one skill. The skill name becomes the directory name,
 * with runs of characters outside `[A-Za-z0-9._-]` replaced by `-` so the
 * path is shell-safe.
 */
export function skillInstallInstructions(
  input: SkillInstallInput
): SkillInstallInstructions {
  const url = skillMarkdownUrl(input.apiBaseUrl, input.apiHost);
  const dir = input.skillName.replace(/[^A-Za-z0-9._-]+/g, '-');
  return {
    markdownUrl: url,
    claudeCurl: `curl -fsSL "${url}" --create-dirs -o ~/.claude/skills/${dir}/SKILL.md`,
    agentsCurl: `curl -fsSL "${url}" --create-dirs -o ~/.agents/skills/${dir}/SKILL.md`,
    crawlerCommand: `raidr-crawler install --claude   # installs the raidr-publish skill; site skills come from the URL above`,
  };
}
