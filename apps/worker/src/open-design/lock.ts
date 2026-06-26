/**
 * EPIC 4.2c — Design lock: capture the OD artifact, extract + validate the
 * embedded DesignContract, build the brief, and write the locked artifacts
 * (index.html + design-contract.json + design-brief.md + manifest.json) under
 * the project's design dir. Ported (minimal) from LionClaw lock.ts.
 *
 * On validation failure the lock is rejected with a problems list (no writes)
 * so the studio can iterate; on success the artifacts are frozen for the
 * downstream pipeline phases.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { buildBrief } from './brief-builder';
import type { OpenDesignClient } from './client';
import { parseContractFromHtml, validateContract } from './contract';
import type { DesignContract } from './contract';
import { captureDesignArtifact } from './snapshot';

export interface LockInput {
  client: OpenDesignClient;
  odProjectId: string;
  /** Destination dir (typically <projectPath>/docs/design). */
  outputDir: string;
}

export interface LockProblem {
  rule: string;
  hint: string;
}

export interface LockArtifacts {
  html: string;
  contract: string;
  brief: string;
  manifest: string;
}

export interface LockResult {
  locked: boolean;
  reason: string | null;
  contract: DesignContract | null;
  problems: LockProblem[];
  artifacts: LockArtifacts | null;
}

function rejected(reason: string, problems: LockProblem[] = []): LockResult {
  return { locked: false, reason, contract: null, problems, artifacts: null };
}

async function writeArtifacts(outputDir: string, files: { html: string; contractJson: string; brief: string; manifestJson: string }): Promise<LockArtifacts> {
  const artifactDir = join(outputDir, 'artifact');
  await mkdir(artifactDir, { recursive: true });
  const html = join(artifactDir, 'index.html');
  const contract = join(outputDir, 'design-contract.json');
  const brief = join(outputDir, 'design-brief.md');
  const manifest = join(outputDir, 'manifest.json');
  await Promise.all([
    writeFile(html, files.html, 'utf8'),
    writeFile(contract, files.contractJson, 'utf8'),
    writeFile(brief, files.brief, 'utf8'),
    writeFile(manifest, files.manifestJson, 'utf8'),
  ]);
  return { html, contract, brief, manifest };
}

export async function lockDesign(input: LockInput): Promise<LockResult> {
  const snap = await captureDesignArtifact(input.client, input.odProjectId);
  if (!snap.html) return rejected('no design artifact found — generate a design in the studio first');

  const parsed = parseContractFromHtml(snap.html);
  if (!parsed) return rejected('design contract not embedded in the HTML artifact');

  const { contract, problems } = validateContract(parsed);
  if (!contract) {
    return rejected(
      'design contract failed schema validation',
      problems.map((hint) => ({ rule: 'contract-schema', hint })),
    );
  }

  const brief = buildBrief(contract);
  const manifestJson = JSON.stringify({
    odProjectId: input.odProjectId,
    artifactPath: snap.artifactPath,
    version: contract.version,
    lockedAt: new Date().toISOString(),
  }, null, 2);

  const artifacts = await writeArtifacts(input.outputDir, {
    html: snap.html,
    contractJson: JSON.stringify(contract, null, 2),
    brief,
    manifestJson,
  });

  return { locked: true, reason: null, contract, problems: [], artifacts };
}
