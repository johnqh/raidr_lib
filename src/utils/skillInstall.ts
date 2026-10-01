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
  /** The skill's directory name under the skills folder. */
  directory: string;
  /** One command: download SKILL.md into the personal Claude Code skills folder. */
  command: string;
}

/** Raw SKILL.md URL for an API host (served with Content-Disposition: attachment). */
export function skillMarkdownUrl(apiBaseUrl: string, apiHost: string): string {
  return `${apiBaseUrl.replace(/\/+$/, '')}/api/v1/skills/${encodeURIComponent(apiHost)}/SKILL.md`;
}

/**
 * Safe directory name for a skill: letters, digits, `.`, `_`, `-`, with no
 * leading dots, so a name like `..` can never escape the skills folder.
 */
export function skillDirectoryName(skillName: string, apiHost: string): string {
  const cleaned = skillName
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^[.-]+/, '');
  return cleaned.length > 0
    ? cleaned
    : apiHost
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

/** The single install command shown on a skill page. */
export function skillInstallInstructions(
  input: SkillInstallInput
): SkillInstallInstructions {
  const url = skillMarkdownUrl(input.apiBaseUrl, input.apiHost);
  const directory = skillDirectoryName(input.skillName, input.apiHost);
  return {
    markdownUrl: url,
    directory,
    command: `curl -fsSL "${url}" --create-dirs -o ~/.claude/skills/${directory}/SKILL.md`,
  };
}
