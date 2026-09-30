import { describe, expect, it } from 'vitest';
import { skillInstallInstructions, skillMarkdownUrl } from './skillInstall';

describe('skillInstall', () => {
  it('points at the raw SKILL.md route', () => {
    expect(skillMarkdownUrl('https://api.raidr.app/', 'api.example.com')).toBe(
      'https://api.raidr.app/api/v1/skills/api.example.com/SKILL.md'
    );
  });
  it('writes into a directory named after the skill', () => {
    const i = skillInstallInstructions({
      apiHost: 'api.example.com',
      skillName: 'api-example-com',
      apiBaseUrl: 'https://api.raidr.app',
    });
    expect(i.claudeCurl).toContain('~/.claude/skills/api-example-com/SKILL.md');
    expect(i.agentsCurl).toContain('~/.agents/skills/api-example-com/SKILL.md');
  });
});
