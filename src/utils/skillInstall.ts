/**
 * Install instructions for a published skill.
 */

export interface SkillInstallInput {
  apiHost: string;
  /** Skill name from its frontmatter; becomes the directory name. */
  skillName: string;
  apiBaseUrl: string;
}

export interface SkillInstallInstructions {
  markdownUrl: string;
  /** Downloads SKILL.md into the personal Claude Code skills directory. */
  claudeCurl: string;
  /** Same for the cross-runtime `.agents` directory (Codex, Gemini CLI, Copilot CLI). */
  agentsCurl: string;
  /** Uses raidr_crawler's installer when the checkout is present. */
  crawlerCommand: string;
}

export function skillMarkdownUrl(apiBaseUrl: string, apiHost: string): string {
  return `${apiBaseUrl.replace(/\/+$/, '')}/api/v1/skills/${encodeURIComponent(apiHost)}/SKILL.md`;
}

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
