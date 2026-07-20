import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('project harness', () => {
  it('defines at least twelve agents and matching skills', () => {
    const agents = readdirSync('.codex/agents').filter((name) => name.endsWith('.md'));
    expect(agents).toHaveLength(12);
    for (const file of agents) {
      const name = file.replace(/\.md$/, '');
      expect(readFileSync(`.codex/skills/${name}/skill.md`, 'utf8')).toContain(`name: ${name}`);
    }
  });
});
