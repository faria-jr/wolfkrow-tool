/**
 * EPIC 4.2c — Bootstrap an Open Design session tied to a Wolfkrow project.
 *
 * Ported (minimal) from LionClaw bootstrap.ts. The OD daemon's createProject
 * accepts a `pendingPrompt`, so bootstrapping = create an OD project named
 * `wolfkrow-<sanitized-id>` with the design-brief as the pending prompt + the
 * Wolfkrow linkage in metadata. The iframed studio then opens that project and
 * the prompt seeds the design conversation.
 *
 * LionClaw additionally drives /api/chat + /api/runs to force the first
 * generation; that orchestration is deferred (the pending prompt is enough for
 * the studio to start). Returns the studio URL for the iframe.
 */

import type { OpenDesignClient } from './client';
import { buildDesignBriefPrompt } from './prompt-builder';

export interface BootstrapInput {
  wolfkrowProjectId: string;
  name: string;
  specContent: string;
  /** Base web URL of the running engine (from OpenDesignSidecarManager state). */
  webUrl: string;
  designSystemId?: string;
}

export interface BootstrapResult {
  openDesignProjectId: string;
  conversationId: string;
  studioUrl: string;
  prompt: string;
}

/** Sanitize a Wolfkrow id into an OD-safe project id segment. */
export function sanitizeOdProjectId(wolfkrowProjectId: string): string {
  const slug = wolfkrowProjectId.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return `wolfkrow-${slug || 'project'}`;
}

/** Build the studio URL for an OD project (host + locale params for embed mode). */
export function buildStudioUrl(webUrl: string, odProjectId: string): string {
  return `${webUrl.replace(/\/$/, '')}/projects/${encodeURIComponent(odProjectId)}?host=wolfkrow&locale=pt-BR`;
}

export async function bootstrapDesignSession(
  client: OpenDesignClient,
  input: BootstrapInput,
): Promise<BootstrapResult> {
  const prompt = buildDesignBriefPrompt({
    projectName: input.name,
    specContent: input.specContent,
    ...(input.designSystemId !== undefined ? { designSystemId: input.designSystemId } : {}),
  });

  const odId = sanitizeOdProjectId(input.wolfkrowProjectId);
  const { project, conversationId } = await client.createProject({
    id: odId,
    name: input.name,
    pendingPrompt: prompt,
    designSystemId: input.designSystemId ?? null,
    metadata: {
      kind: 'prototype',
      fidelity: 'high-fidelity',
      source: 'wolfkrow',
      wolfkrowProjectId: input.wolfkrowProjectId,
    },
  });

  return {
    openDesignProjectId: project.id,
    conversationId,
    studioUrl: buildStudioUrl(input.webUrl, project.id),
    prompt,
  };
}
