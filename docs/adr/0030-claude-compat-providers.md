# ADR 0030: Claude-compat Providers (Z.ai, MiniMax, Moonshot, Qwen)

## Status

Accepted · 2026-06-23

## Context

O LionClaw v1.0 usava um `claude-compat-sdk` que instanciava o SDK da Anthropic (`@anthropic-ai/sdk`) com `baseURL` customizado para providers compatíveis com a API Anthropic:

- **Z.ai (GLM)**: `https://api.z.ai/api/anthropic`
- **MiniMax TokenPlan**: `https://api.minimax.io/anthropic`

O usuário solicitou manter OpenRouter como opção unificada e adicionar:

- **Moonshot (Kimi)** via endpoint Anthropic-compat
- **Qwen (DashScope)** via endpoint Anthropic-compat

No Wolfkrow, o provider `claude-compat.ts` existente usava o SDK OpenAI apontando para `api.anthropic.com/v1`, o que não replicava a abordagem do LionClaw.

## Decision

1. Modelar os presets Claude-compat no domínio (`packages/domain/src/services/claude-compat-presets.ts`) como value object + catálogo imutável.
2. Refatorar `ClaudeCompatProvider` para usar `@anthropic-ai/sdk` com `baseURL` do preset.
3. Adicionar runtime `claude-compat` à entidade `Agent` e coluna `provider` opcional no banco.
4. Estender a factory para aceitar `claude-compat:${presetId}` (ex: `claude-compat:zai`).
5. No orchestrator, inferir o provider pelo prefixo do modelo quando `provider` não estiver explícito.
6. Manter OpenRouter, Anthropic, Codex, Ollama e demais providers intactos.

## Presets

| ID | Nome | Base URL | Conta keytar |
|---|---|---|---|
| `zai` | Z.ai (GLM) | `https://api.z.ai/api/anthropic` | `zai-api-key` |
| `minimax` | MiniMax TokenPlan | `https://api.minimax.io/anthropic` | `minimax-api-key` |
| `moonshot` | Moonshot (Kimi) | `https://api.moonshot.cn/anthropic` | `moonshot-api-key` |
| `qwen` | Qwen (DashScope) | `https://dashscope.aliyuncs.com/compatible-mode/anthropic` | `qwen-api-key` |

## Consequences

- **Positivas**:
  - Paridade funcional com LionClaw v1.0 para Z.ai e MiniMax.
  - Suporte a Moonshot e Qwen via mesmo padrão.
  - Separação limpa entre domínio (presets) e infra (provider).
  - Fallback por prefixo de modelo (`glm-*`, `MiniMax-*`, `kimi-*`, `qwen-*`).

- **Negativas / Riscos**:
  - Endpoints compatíveis podem divergir da API Anthropic; presets centralizam a manutenção.
  - Tool calls são degradados graciosamente (texto apenas), igual ao `AnthropicProvider` base.
  - Usuário precisa configurar chaves separadas para cada provider no Vault/keytar.

## Alternatives Considered

- Usar OpenRouter para todos os novos providers: rejeitado porque o usuário solicitou providers diretos além do OpenRouter.
- Manter `ClaudeCompatProvider` com OpenAI SDK: rejeitado porque não reflete o LionClaw e limita suporte a recursos Anthropic.

## Migration Notes

- Seed agents com runtime `cloud` que deveriam usar Z.ai/MiniMax devem ser migrados para `runtime: claude-compat` + `provider: zai|minimax`.
- A migration `0002_secret_komodo.sql` adiciona a coluna `provider` na tabela `agents`.
