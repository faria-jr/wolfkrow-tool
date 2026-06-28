/**
 * Tests: EPIC 4.2c — contract extraction/validation + brief builder + lock flow.
 */

import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildBrief } from '../brief-builder';
import type { OpenDesignClient } from '../client';
import {
  collectDesignContractIssues,
  isValidDesignContract,
  parseContractFromHtml,
  validateContract,
  type DesignContract,
} from '../contract';
import { lockDesign } from '../lock';

const validContract: DesignContract = {
  version: '1.0',
  visual: {
    direction: 'minimal',
    density: 'balanced',
    tokens: {
      colors: { bg: '#fff' },
      typography: { body: '14px' },
      spacing: { md: '8px' },
      radii: { sm: '4px' },
    },
  },
  navigation: {
    primary: [{ id: 'home', label: 'Home', targetScreenId: 's1', userStoryIds: ['u1'] }],
  },
  screens: [{ id: 's1', title: 'Home', route: '/', userStoryIds: ['u1'] }],
  components: [{ id: 'c1', name: 'Button', type: 'form' }],
};

function htmlWithContract(contract: unknown): string {
  return `<html><script id="lionclaw-design-contract">${JSON.stringify(contract)}</script></html>`;
}

function mockClient(html: string): OpenDesignClient {
  return {
    getProjectFiles: vi.fn(async () => [{ path: 'index.html' }]),
    getProjectFile: vi.fn(async () => html),
  } as unknown as OpenDesignClient;
}

describe('contract extraction + validation', () => {
  it('parses the embedded contract JSON', () => {
    expect(parseContractFromHtml(htmlWithContract(validContract))).toEqual(validContract);
  });

  it('returns null when the script tag is absent', () => {
    expect(parseContractFromHtml('<html>no contract</html>')).toBeNull();
  });

  it('returns null on invalid JSON', () => {
    expect(
      parseContractFromHtml('<script id="lionclaw-design-contract">{bad}</script>')
    ).toBeNull();
  });

  it('validates a well-formed contract', () => {
    expect(isValidDesignContract(validContract)).toBe(true);
    expect(validateContract(validContract).contract).toEqual(validContract);
  });

  it('collects problems for a malformed contract', () => {
    const problems = collectDesignContractIssues({ version: '2.0', visual: {} });
    expect(problems.length).toBeGreaterThan(0);
    expect(problems.some((p) => p.includes('version'))).toBe(true);
    expect(validateContract({ version: '2.0' }).contract).toBeNull();
  });

  it('flags per-field problems on malformed items (DEBT #4.2 validator depth)', () => {
    const problems = collectDesignContractIssues({
      version: '1.0',
      visual: {
        direction: 'x',
        density: 'dense',
        tokens: { colors: {}, typography: {}, spacing: {}, radii: {} },
      },
      navigation: { primary: [{ id: 'n1', targetScreenId: 's1', userStoryIds: [] }] }, // missing label
      screens: [{ id: 's1', title: 'Home', userStoryIds: [] }], // missing route
      components: [{ id: 'c1', name: 'Btn' }], // missing type
    });
    expect(problems.some((p) => p.includes('navigation.primary[0].label'))).toBe(true);
    expect(problems.some((p) => p.includes('screens[0].route'))).toBe(true);
    expect(problems.some((p) => p.includes('components[0].type'))).toBe(true);
  });
});

describe('buildBrief', () => {
  it('renders visual/tokens/screens/navigation sections', () => {
    const brief = buildBrief(validContract);
    expect(brief).toContain('# Design Brief');
    expect(brief).toContain('Direção Visual');
    expect(brief).toContain('Mapa de Telas');
    expect(brief).toContain('Home');
    expect(brief).toContain('| bg | #fff |');
  });
});

describe('lockDesign', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'wk-lock-'));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('locks + writes artifacts when the contract is valid', async () => {
    const client = mockClient(htmlWithContract(validContract));
    const r = await lockDesign({ client, odProjectId: 'wolfkrow-acme', outputDir: dir });
    expect(r.locked).toBe(true);
    expect(r.contract).toEqual(validContract);
    expect(r.artifacts).toBeDefined();

    const brief = await readFile(r.artifacts!.brief, 'utf8');
    expect(brief).toContain('Design Brief');
    const contractFile = await readFile(r.artifacts!.contract, 'utf8');
    expect(JSON.parse(contractFile)).toEqual(validContract);
    const html = await readFile(join(dir, 'artifact', 'index.html'), 'utf8');
    expect(html).toContain('lionclaw-design-contract');
  });

  it('rejects when no artifact exists', async () => {
    const client = { getProjectFiles: vi.fn(async () => []) } as unknown as OpenDesignClient;
    const r = await lockDesign({ client, odProjectId: 'p', outputDir: dir });
    expect(r.locked).toBe(false);
    expect(r.reason).toContain('no design artifact');
  });

  it('rejects when the contract is missing from the HTML', async () => {
    const client = mockClient('<html>no contract here</html>');
    const r = await lockDesign({ client, odProjectId: 'p', outputDir: dir });
    expect(r.locked).toBe(false);
    expect(r.reason).toContain('not embedded');
  });

  it('rejects with schema problems when the contract is malformed', async () => {
    const client = mockClient(htmlWithContract({ version: '2.0' }));
    const r = await lockDesign({ client, odProjectId: 'p', outputDir: dir });
    expect(r.locked).toBe(false);
    expect(r.problems.length).toBeGreaterThan(0);
  });
});
