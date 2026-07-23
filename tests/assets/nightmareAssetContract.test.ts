import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { NIGHTMARE_THEME_IDS } from '../../src/game/stages/stageIdentity';
import {
  NIGHTMARE_ASSETS,
  NIGHTMARE_ROOT,
} from '../../tools/assets/nightmareAssetContract.mjs';
import {
  validateNightmareAssets,
} from '../../tools/assets/validateNightmareAssets.mjs';

describe('nightmare 3D asset contract', () => {
  it('defines exact nightmare motion and vfx frame contracts', () => {
    expect(NIGHTMARE_ASSETS.filter(({ group }) => group === 'motion')
      .map(({ id, frames }) => [id, frames])).toEqual([
      ['shadow-slime-bounce', 6],
      ['vampire-bat-fly', 8],
      ['skeleton-knight-walk', 6],
      ['obsidian-golem-walk', 6],
      ['lich-king-float', 8],
    ]);
    expect(NIGHTMARE_ASSETS.filter(({ group }) => group === 'vfx')
      .map(({ id, frames }) => [id, frames])).toEqual([
      ['shield-open', 6],
      ['shield-block', 4],
      ['shield-break', 6],
      ['split-burst', 6],
      ['slow-resist', 4],
      ['lich-aura', 8],
      ['lich-phase-two', 8],
      ['elite-rune', 4],
    ]);
  });

  it('defines nine map pieces for each of six themes', () => {
    const maps = NIGHTMARE_ASSETS.filter(({ group }) => group === 'map');
    expect(maps).toHaveLength(54);
    for (const theme of NIGHTMARE_THEME_IDS) {
      expect(maps.filter((asset) => asset.theme === theme)).toHaveLength(9);
    }
  });

  it('routes only refined enemy motion through the v2 render root', () => {
    const expectedV1 = path.join(
      path.dirname(NIGHTMARE_ROOT),
      'nightmare-v1',
    );
    const expectedV2 = path.join(
      path.dirname(NIGHTMARE_ROOT),
      'nightmare-v2',
    );

    expect(NIGHTMARE_ASSETS.filter(({ group }) => group === 'motion')
      .map(({ root }) => root)).toEqual(Array(5).fill(expectedV2));
    expect(NIGHTMARE_ASSETS.filter(({ group }) => group !== 'motion')
      .every(({ root }) => root === expectedV1)).toBe(true);
  });

  it('defines readable semantic detail for every refined enemy', async () => {
    const contractPath = path.resolve(
      'tools/assets/nightmareEnemyDetailContract.mjs',
    );
    const exists = existsSync(contractPath);
    expect(exists).toBe(true);
    if (!exists) return;

    const { NIGHTMARE_ENEMY_DETAIL_CONTRACT } = await import(
      '../../tools/assets/nightmareEnemyDetailContract.mjs'
    );
    expect(Object.keys(NIGHTMARE_ENEMY_DETAIL_CONTRACT)).toEqual([
      'shadow-slime-bounce',
      'vampire-bat-fly',
      'skeleton-knight-walk',
      'obsidian-golem-walk',
      'lich-king-float',
    ]);
    for (const contract of Object.values(
      NIGHTMARE_ENEMY_DETAIL_CONTRACT,
    ) as Array<{
      minimumParts: number;
      requiredRoles: readonly string[];
    }>) {
      expect(contract.minimumParts).toBeGreaterThanOrEqual(18);
      expect(contract.requiredRoles.length).toBeGreaterThanOrEqual(6);
    }
  });

  it('validates refined motion and retained support assets from mixed roots', async () => {
    const page = {
      evaluate: async (
        _callback: unknown,
        {
          expectedHeight,
          expectedWidth,
        }: { expectedHeight: number; expectedWidth: number },
      ) => ({
        corners: [0, 0, 0, 0],
        height: expectedHeight,
        width: expectedWidth,
        dimensionsOk: true,
      }),
      close: async () => undefined,
    };
    const chromiumApi = {
      launch: async () => ({
        newPage: async () => page,
        close: async () => undefined,
      }),
    };

    await expect(validateNightmareAssets({ chromiumApi })).resolves.toMatchObject({
      assetCount: 67,
      fileCount: 134,
    });
  });

  it('exposes the validator and approval-sheet package commands', async () => {
    const packageJson = await import('../../package.json', {
      with: { type: 'json' },
    });
    const validator = await import(
      '../../tools/assets/validateNightmareAssets.mjs'
    );
    const sheet = await import(
      '../../tools/assets/buildNightmareApprovalSheet.mjs'
    );

    expect(packageJson.default.scripts['assets:nightmare:validate'])
      .toBe('node tools/assets/validateNightmareAssets.mjs');
    expect(packageJson.default.scripts['assets:nightmare:sheet'])
      .toBe('node tools/assets/buildNightmareApprovalSheet.mjs');
    expect(validator.validateNightmareAssets).toEqual(expect.any(Function));
    expect(sheet.buildNightmareApprovalSheet).toEqual(expect.any(Function));
    expect(sheet.renderNightmareEnemyApprovalHtml)
      .toEqual(expect.any(Function));
  });

  it('protects existing Blender data and exposes the refined v2 build stages', () => {
    const source = readFileSync('tools/blender/nightmare_assets.py', 'utf8');

    expect(source).toContain('OWNER = "nightmare-v2"');
    expect(source).toContain('OUTPUT = REPO / "assets/renders/nightmare-v2"');
    expect(source).toContain(
      'ENEMY_BLEND_OUTPUT = REPO / "assets/blender/nightmare-enemies-v2.blend"',
    );
    expect(source).toContain('SOURCE_BLEND_NAMES');
    expect(source).not.toContain('read_factory_settings');
    expect(source).toContain('scene.render.engine = "BLENDER_EEVEE_NEXT"');
    expect(source).toContain('except TypeError:');
    expect(source).toContain('scene.render.engine = "BLENDER_EEVEE"');
    for (const entrypoint of [
      'reset_nightmare_scene',
      'build_enemy_models',
      'build_trait_vfx',
      'build_map_kit',
      'render_master_and_mobile',
      'save_blend_files',
      'build_all',
    ]) {
      expect(source).toContain(`def ${entrypoint}(`);
    }
    for (const metadata of [
      'nightmare_detail_version',
      'nightmare_detail_roles',
      'nightmare_part_count',
    ]) {
      expect(source).toContain(metadata);
    }
    for (const role of [
      '"body-shell"',
      '"wing-membrane"',
      '"shield-rim"',
      '"lava-crack"',
      '"crown-spire"',
      '"soul-flame"',
    ]) {
      expect(source).toContain(role);
    }
    for (const primitive of [
      '"shadow_slime"',
      '"vampire_bat"',
      '"skeleton_knight"',
      '"obsidian_golem"',
      '"lich_king"',
    ]) {
      expect(source).toContain(primitive);
    }
  });
});
