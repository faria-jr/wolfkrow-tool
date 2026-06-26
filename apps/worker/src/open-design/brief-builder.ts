/**
 * EPIC 4.2c — Build a Markdown design brief from a validated DesignContract.
 * Ported from LionClaw brief-builder.ts (deterministic: same contract → same brief).
 */

import type { DesignComponent, DesignContract, DesignDelta, DesignNavItem, DesignScreen } from './contract';

function tokenTable(title: string, tokens: Record<string, string>): string[] {
  if (Object.keys(tokens).length === 0) return [];
  return [
    `### ${title}`, '',
    '| Token | Valor |', '|-------|-------|',
    ...Object.entries(tokens).map(([k, v]) => `| ${k} | ${v} |`),
    '',
  ];
}

function visualSection(v: DesignContract['visual']): string[] {
  const lines = ['## Direção Visual', '', `**Direção:** ${v.direction || '(não especificada)'}`];
  if (v.designSystem) lines.push(`**Design System:** ${v.designSystem}`);
  lines.push(`**Densidade:** ${v.density}`, '');
  return lines;
}

function screensSection(screens: DesignScreen[]): string[] {
  const lines = ['## Mapa de Telas', ''];
  if (screens.length === 0) { lines.push('(nenhuma tela declarada)', ''); return lines; }
  for (const s of screens) {
    const stories = s.userStoryIds.length > 0 ? ` — stories: ${s.userStoryIds.join(', ')}` : '';
    lines.push(`- **${s.title}** (\`${s.id}\`) — rota: \`${s.route}\`${stories}`);
  }
  return [...lines, ''];
}

function navSection(items: DesignNavItem[]): string[] {
  const lines = ['## Navegação Principal', ''];
  if (items.length === 0) { lines.push('(nenhum item de navegação declarado)', ''); return lines; }
  for (const item of items) {
    const stories = item.userStoryIds.length > 0 ? ` — stories: ${item.userStoryIds.join(', ')}` : '';
    lines.push(`- **${item.label}** (\`${item.id}\`) -> tela \`${item.targetScreenId}\`${stories}`);
  }
  return [...lines, ''];
}

function componentsSection(components: DesignComponent[]): string[] {
  const lines = ['## Componentes Principais', ''];
  if (components.length === 0) { lines.push('(nenhum componente declarado)', ''); return lines; }
  for (const c of components) lines.push(`- **${c.name}** (\`${c.id}\`) — tipo: \`${c.type}\``);
  return [...lines, ''];
}

function deltasSection(deltas: DesignDelta[]): string[] {
  if (deltas.length === 0) return [];
  const lines = ['## Deltas', ''];
  for (const d of deltas) {
    const badge = d.requiresRequirementsChange ? ' [REQUER MUDANÇA DE REQUISITOS]' : '';
    lines.push(`- **${d.type}** (\`${d.id}\`) — impacto: ${d.impact}${badge}`, `  ${d.description}`);
  }
  return [...lines, ''];
}

export function buildBrief(contract: DesignContract): string {
  const { tokens } = contract.visual;
  return [
    '# Design Brief', '',
    ...visualSection(contract.visual),
    '## Tokens', '',
    ...tokenTable('Cores', tokens.colors),
    ...tokenTable('Tipografia', tokens.typography),
    ...tokenTable('Espaçamento', tokens.spacing),
    ...tokenTable('Radii', tokens.radii),
    ...screensSection(contract.screens),
    ...navSection(contract.navigation.primary),
    ...componentsSection(contract.components),
    ...deltasSection(contract.deltas ?? []),
  ].join('\n');
}
