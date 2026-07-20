import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

type DefinitionExpectation = {
  content: string;
  expectedName: string;
  requiredHeadings: string[];
};

function assertDefinition({ content, expectedName, requiredHeadings }: DefinitionExpectation) {
  const frontmatter = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!frontmatter) {
    throw new Error('missing YAML frontmatter');
  }

  if (!new RegExp(`^name: ${expectedName}$`, 'm').test(frontmatter[1])) {
    throw new Error(`missing matching name: ${expectedName}`);
  }
  if (!/^description:\s+\S/m.test(frontmatter[1])) {
    throw new Error('missing description');
  }

  for (const heading of requiredHeadings) {
    if (!new RegExp(`^## ${heading}$`, 'm').test(content)) {
      throw new Error(`missing heading: ${heading}`);
    }
  }
}

describe('project harness', () => {
  it('rejects an incomplete in-memory agent definition', () => {
    expect(() => assertDefinition({
      content: '---\nname: incomplete\ndescription: "fixture"\n---\n\n## 핵심 역할\n',
      expectedName: 'incomplete',
      requiredHeadings: ['핵심 역할', '작업 원칙'],
    })).toThrow('missing heading: 작업 원칙');
  });

  it('defines exactly twelve agent definitions and matching specialist skills', () => {
    const agents = readdirSync('.codex/agents')
      .filter((name) => name.endsWith('.md'))
      .sort();
    const agentNames = agents.map((file) => file.replace(/\.md$/, ''));

    expect(agents).toHaveLength(12);
    expect(new Set(agentNames)).toHaveLength(12);

    for (const [index, file] of agents.entries()) {
      const name = agentNames[index];
      const agent = readFileSync(`.codex/agents/${file}`, 'utf8');
      const skill = readFileSync(`.codex/skills/${name}/skill.md`, 'utf8');

      assertDefinition({
        content: agent,
        expectedName: name,
        requiredHeadings: ['핵심 역할', '작업 원칙', '출력 형식', '협업'],
      });
      assertDefinition({
        content: skill,
        expectedName: name,
        requiredHeadings: ['워크플로우', '검증', '출력 규칙'],
      });
    }

    expect(existsSync('.codex/commands')).toBe(false);
  });

  it('defines explicit asset and test-first code review gates in the orchestrator', () => {
    const orchestrator = readFileSync('.codex/skills/huchu-defense-orchestrator/skill.md', 'utf8');

    for (const token of [
      'blender-asset-producer',
      'sprite-pipeline-engineer',
      'performance-accessibility-reviewer',
      '승인 전에는 에셋을 통합하지 않는다',
      'RED',
      '최소 구현',
      'GREEN',
      '독립 리뷰',
    ]) {
      expect(orchestrator).toContain(token);
    }
  });

  it('keeps specialist constraints aligned with the landscape no-upgrade MVP', () => {
    const architect = readFileSync('.codex/agents/game-architect.md', 'utf8');
    const balanceDesigner = readFileSync('.codex/agents/balance-economy-designer.md', 'utf8');

    expect(architect).toContain('모바일 가로 화면 16:9');
    expect(architect).not.toMatch(/세로 화면.*먼저|세로.*우선/);
    expect(balanceDesigner).toContain('타워 배치 비용');
    expect(balanceDesigner).toContain('업그레이드·판매·이동은 MVP 범위에서 제외');
    expect(balanceDesigner).not.toContain('업그레이드 비용');
  });
});
