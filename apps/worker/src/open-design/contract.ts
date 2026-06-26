/**
 * EPIC 4.2c — DesignContract types + extraction + validation.
 *
 * Ported (minimal subset) from LionClaw src/types/open-design.ts (the 415-line
 * file) + electron/main/open-design/contract.ts. The OD-generated HTML embeds
 * the contract as `<script id="lionclaw-design-contract">{json}</script>`; this
 * parses it + validates the schema. Full LionClaw validator has deep per-field
 * rules (25KB) — this ports the structural checks that gate the design lock.
 */

export interface DesignNavItem {
  id: string;
  label: string;
  targetScreenId: string;
  userStoryIds: string[];
}
export interface DesignScreen {
  id: string;
  title: string;
  route: string;
  userStoryIds: string[];
}
export interface DesignComponent {
  id: string;
  name: string;
  type: string;
}
export interface DesignDelta {
  id: string;
  type: string;
  description: string;
  impact: string;
  requiresRequirementsChange: boolean;
}
export interface DesignContract {
  version: '1.0';
  visual: {
    direction: string;
    designSystem?: string;
    density: string;
    tokens: { colors: Record<string, string>; typography: Record<string, string>; spacing: Record<string, string>; radii: Record<string, string> };
  };
  navigation: { primary: DesignNavItem[]; secondary?: DesignNavItem[] };
  screens: DesignScreen[];
  components: DesignComponent[];
  deltas?: DesignDelta[];
}

const CONTRACT_SCRIPT_RE = /<script[^>]*id=["']lionclaw-design-contract["'][^>]*>([\s\S]*?)<\/script>/i;
const TOKEN_KEYS = ['colors', 'typography', 'spacing', 'radii'] as const;

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

/** Parse the embedded design-contract JSON from OD-generated HTML (null if absent/invalid JSON). */
export function parseContractFromHtml(html: string): unknown | null {
  const match = CONTRACT_SCRIPT_RE.exec(html);
  if (!match?.[1]) return null;
  try {
    return JSON.parse(match[1].trim());
  } catch {
    return null;
  }
}

function tokenIssues(tokens: unknown): string[] {
  if (!isRecord(tokens)) return ['visual.tokens is missing'];
  return TOKEN_KEYS.flatMap((k) => (isRecord(tokens[k]) ? [] : [`visual.tokens.${k} must be an object`]));
}

function visualIssues(visual: unknown): string[] {
  if (!isRecord(visual)) return ['visual is missing'];
  const issues: string[] = [];
  if (typeof visual['direction'] !== 'string') issues.push('visual.direction must be a string');
  if (typeof visual['density'] !== 'string') issues.push('visual.density must be a string');
  issues.push(...tokenIssues(visual['tokens']));
  return issues;
}

function itemStringFields(item: unknown, index: number, path: string, fields: readonly string[]): string[] {
  if (!isRecord(item)) return [`${path}[${index}] must be an object`];
  return fields.flatMap((f) => (typeof item[f] === 'string' ? [] : [`${path}[${index}].${f} must be a string`]));
}

/** Per-field checks for navigation items, screens, components (DEBT #4.2 parity). */
function collectionItemIssues(x: Record<string, unknown>): string[] {
  const issues: string[] = [];
  const navigation = x['navigation'];
  if (isRecord(navigation) && Array.isArray(navigation['primary'])) {
    navigation['primary'].forEach((item, i) => {
      issues.push(...itemStringFields(item, i, 'navigation.primary', ['id', 'label', 'targetScreenId']));
      if (isRecord(item) && !Array.isArray(item['userStoryIds'])) issues.push(`navigation.primary[${i}].userStoryIds must be an array`);
    });
  }
  if (Array.isArray(x['screens'])) {
    x['screens'].forEach((screen, i) => {
      issues.push(...itemStringFields(screen, i, 'screens', ['id', 'title', 'route']));
      if (isRecord(screen) && !Array.isArray(screen['userStoryIds'])) issues.push(`screens[${i}].userStoryIds must be an array`);
    });
  }
  if (Array.isArray(x['components'])) {
    x['components'].forEach((comp, i) => issues.push(...itemStringFields(comp, i, 'components', ['id', 'name', 'type'])));
  }
  return issues;
}

function collectionIssues(x: Record<string, unknown>): string[] {
  const issues: string[] = [];
  if (x['version'] !== '1.0') issues.push('version must be "1.0"');
  const navigation = x['navigation'];
  if (!isRecord(navigation) || !Array.isArray(navigation['primary'])) issues.push('navigation.primary must be an array');
  if (!Array.isArray(x['screens'])) issues.push('screens must be an array');
  if (!Array.isArray(x['components'])) issues.push('components must be an array');
  return [...issues, ...collectionItemIssues(x)];
}

/** Collect human-readable schema problems (drives the lock rejection report). */
export function collectDesignContractIssues(x: unknown): string[] {
  if (!isRecord(x)) return ['contract is not an object'];
  return [...visualIssues(x['visual']), ...collectionIssues(x)];
}

/** Structural schema check for a parsed design contract. */
export function isValidDesignContract(x: unknown): x is DesignContract {
  return collectDesignContractIssues(x).length === 0;
}

/** Type guard result carrying the validated contract (null + issues otherwise). */
export function validateContract(parsed: unknown): { contract: DesignContract; problems: [] } | { contract: null; problems: string[] } {
  const problems = collectDesignContractIssues(parsed);
  if (problems.length > 0) return { contract: null, problems };
  return { contract: parsed as DesignContract, problems: [] };
}
