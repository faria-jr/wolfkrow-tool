/**
 * EPIC 4.2c — Builds the initial design-brief prompt that seeds an Open Design
 * session. Ported (minimal) from LionClaw's prompt-builder.ts; the full
 * LionClaw builder has elaborate spec/prd parsing — this captures the intent
 * (high-fidelity prototype directive + spec context + design-contract ask) so
 * the OD session produces the same artifact shape.
 */

export interface DesignBriefInput {
  projectName: string;
  specContent: string;
  designSystemId?: string;
  locale?: string;
}

export function buildDesignBriefPrompt(input: DesignBriefInput): string {
  const spec = input.specContent.trim() || '(no spec provided — infer scope from the project name)';
  const locale = input.locale ?? 'pt-BR';
  return [
    `Design a high-fidelity, interactive prototype for: ${input.projectName}.`,
    '',
    'Specification / context:',
    spec,
    '',
    'Produce a complete screen set with navigation and loading/empty/error/success',
    'states; consistent design tokens (colors, typography, spacing, radii); and a',
    'design-contract describing visual direction, navigation, screens, components,',
    'data requirements and API expectations.',
    input.designSystemId ? `Apply design system: ${input.designSystemId}.` : '',
    `Locale: ${locale}. Respond in ${locale === 'pt-BR' ? 'português (Brasil)' : locale}.`,
  ]
    .filter((line) => line.length > 0)
    .join('\n');
}
