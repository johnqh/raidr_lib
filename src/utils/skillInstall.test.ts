import { describe, expect, it } from 'vitest';
import {
  skillDirectoryName,
  skillInstallInstructions,
  skillMarkdownUrl,
} from './skillInstall';

describe('skillInstall', () => {
  it('points at the raw SKILL.md route', () => {
    expect(skillMarkdownUrl('https://api.raidr.app/', 'api.example.com')).toBe(
      'https://api.raidr.app/api/v1/skills/api.example.com/SKILL.md'
    );
  });

  it('is one command that writes into a directory named after the skill', () => {
    const i = skillInstallInstructions({
      apiHost: 'api.example.com',
      skillName: 'api-example-com',
      apiBaseUrl: 'https://api.raidr.app',
    });
    expect(i.command).toBe(
      'curl -fsSL "https://api.raidr.app/api/v1/skills/api.example.com/SKILL.md" --create-dirs -o ~/.claude/skills/api-example-com/SKILL.md'
    );
  });

  it('never lets a skill name escape the skills folder', () => {
    expect(skillDirectoryName('..', 'api.example.com')).toBe('api-example-com');
    expect(skillDirectoryName('../../etc', 'api.example.com')).toBe('etc');
    expect(skillDirectoryName('.hidden', 'h.com')).toBe('hidden');
  });
});
