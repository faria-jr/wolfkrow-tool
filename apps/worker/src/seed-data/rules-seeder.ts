import { GlobalRule } from '@wolfkrow/domain';
import type { GlobalRuleRepo } from '@wolfkrow/domain';

import { createLogger } from '../logger';

const logger = createLogger('seed:rules');

interface BuiltInRule {
  kind: 'behavior' | 'soul' | 'user' | 'custom';
  title: string;
  body: string;
  sortOrder: number;
}

const BUILT_IN_RULES: BuiltInRule[] = [
  {
    kind: 'behavior',
    title: 'Comportamento padrão',
    body: `- Responda sempre em português (Brasil), salvo instrução explícita do usuário.
- Seja direto, objetivo e técnico. Evite respostas longas e prolixas.
- Prefira exemplos concretos a explicações abstratas.
- Quando executar ações, confirme o resultado ao usuário.
- Em caso de dúvida sobre intenção do usuário, pergunte antes de agir.`,
    sortOrder: 0,
  },
  {
    kind: 'soul',
    title: 'Identidade e valores',
    body: `- Você é um assistente técnico especializado em desenvolvimento de software.
- Priorize qualidade, segurança e boas práticas em todas as recomendações.
- Seja honesto sobre limitações e incertezas.
- Não execute ações destrutivas sem confirmação explícita do usuário.
- Preserve o trabalho do usuário — nunca destrua dados sem backup confirmado.`,
    sortOrder: 1,
  },
  {
    kind: 'user',
    title: 'Preferências do usuário',
    body: `<!-- Adicione aqui suas preferências pessoais, estilo de trabalho e contexto. -->
<!-- Este bloco é editável e nunca é sobrescrito pelo sistema. -->`,
    sortOrder: 2,
  },
];

/**
 * Idempotent: seeds default rules only when the user has zero rules.
 * User-created or user-edited rules are never touched after the first seed.
 */
export async function ensureBuiltInRules(repo: GlobalRuleRepo, userId: string): Promise<number> {
  const existing = await repo.findAll(userId);
  if (existing.length > 0) return 0;

  let inserted = 0;
  for (const def of BUILT_IN_RULES) {
    const rule = GlobalRule.create({
      userId,
      kind: def.kind,
      title: def.title,
      body: def.body,
      enabled: true,
      sortOrder: def.sortOrder,
    });
    await repo.save(rule);
    inserted += 1;
  }

  if (inserted > 0) {
    logger.info({ userId, count: inserted }, 'Seeded built-in rules');
  }
  return inserted;
}
