/**
 * EPIC 4.2c — Open Design session configuration (per Wolfkrow project).
 * Ported (minimal) from LionClaw src/types/open-design.ts OpenDesignSessionConfig.
 * Credentials stay in the Wolfkrow Vault — only agent/model/design-system
 * selection is carried here.
 */

export interface OpenDesignSessionConfig {
  agentId: string;
  model?: string;
  reasoning?: 'low' | 'medium' | 'high';
  designSystemId?: string;
  memoryEnabled?: boolean;
}
