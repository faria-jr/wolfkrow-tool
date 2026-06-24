# ADR 0031: Defer Higgsfield + Blotato MCPs to v2

## Status

Accepted · 2026-06-23

## Context

O LionClaw v1.0 shipa dois MCPs remotos nativos via `mcp-remote@latest`:

1. **Higgsfield** (`https://mcp.higgsfield.ai/mcp`) — geração de imagens e vídeos.
   - Autenticação: OAuth browser-based com callback localhost.
   - Session snapshot persiste em `~/.lionclaw/runtime/higgsfield/mcp-auth/` e é espelhado no Vault (keytar).
   - Implementado em `electron/main/higgsfield-auth.ts` (410 linhas): `connectHiggsfield()`, `ensureHiggsfieldMcpWrapperSync()`, `captureHiggsfieldSessionToVault()`, restore no boot.
2. **Blotato** (`https://mcp.blotato.com/mcp`) — posting em redes sociais.
   - Autenticação: API key simples (`BLOTATO_API_KEY`) passada como header.
   - Wrapper de 91 linhas em `electron/main/blotato-auth.ts`.

Ambos são **registrados como `isActive: false`** no seed e só sobem depois que o usuário conecta no Vault. O boot do app garante o wrapper no filesystem (`ensureXxxMcpWrapperSync()`).

A auditoria (item #5 e #6 da seção 2 do `AUDIT_REPORT_LIONCLAW_WOLFKROW.md`) classificou ambos como risco **Médio** e atualmente **não mapeados** no Wolfkrow.

## Decision

**Higgsfield e Blotato ficam explicitamente fora do escopo do Wolfkrow v1.** Não serão criados pacotes em `packages/mcp-servers/` nem entradas em `BUILT_IN_MCP_SERVERS`. Permanecem fora da UI, fora do `seedDatabase()` e fora do PRD.

## Rationale

### 1. Higgsfield exige fluxo OAuth browser-based que o Wolfkrow não tem
O `higgsfield-auth.ts` depende de:
- Janela Electron ou browser headless para abrir a tela de consentimento.
- Captura de callback `localhost:<port>` que entrega o token.
- Snapshot de sessão baseado em cookies/arquivos do `mcp-remote-client`.

O Wolfkrow worker roda em **Node puro dentro do processo Electron** (ADR-0014: `apps/worker/` em Node 24, separado do renderer). Não há mecanismo de browser OAuth sem construir wrapper Electron-only, o que conflita com o PWA-first (ADR-0019) e quebra o caminho "self-hosted single-user".

Para reproduzir isso no Wolfkrow seria necessário:
- Criar rota web `/oauth/callback/higgsfield` no apps/web + fluxo no Vault UI.
- Implementar persistência de tokens com refresh em keytar.
- Spawnar `mcp-remote-client` headless ou abrir Electron BrowserWindow só pra isso.

Isso é ~2-3 dias de trabalho + UI + testes manuais do fluxo OAuth. Justificável em v2 quando o Vault UI estiver maduro.

### 2. Blotato tem base de usuários estreita + rate limits agressivos
Blotato é um agregador de posting social. Requer:
- API key paga (Blotato Pro) — não é free-tier amigável.
- Cada chamada conta créditos do usuário; rate-limit HTTP 429 é frequente.
- Caso de uso é narrow (social media managers) vs o público do Wolfkrow (devs/researchers).

Comparado com `nano-banana` (MCP já implementado em M3.3) que cobre geração de imagens para o caso geral, e ElevenLabs (M3.3) para TTS, **não há gap funcional crítico** deixado por Blotato.

### 3. Custo de manutenção supera o benefício
- Wrapper Blotato: 91 linhas, ok.
- Wrapper Higgsfield: 410 linhas + UI + OAuth round-trip + edge cases de refresh.
- Toda vez que mcp-remote ou os providers upstream mudarem o contrato, o wrapper quebra.
- Sem feedback real de uso que justifique o investimento.

### 4. Risco de billing acidental
Diferente dos MCPs `on-demand` do Wolfkrow (que só executam quando o usuário chama explicitamente), os seed remotos do LionClaw sobem desativados mas prontos. Para um usuário que **ativa Higgsfield sem querer**, qualquer chamada do agente pode custar créditos reais. Para o público self-hosted de baixo custo do Wolfkrow, o risco é desproporcional ao valor.

## Alternatives Considered

1. **Portar Higgsfield como wrapper Electron-only** (mantém paridade LionClaw).
   - Rejeitado: conflita com worker Node-only e adiciona ~2-3 dias sem entregar valor proporcional.
2. **Portar apenas Blotato** (mais simples, só API key).
   - Rejeitado: caso de uso narrow, não há demanda registrada no Wolfkrow, e fica um MCP órfão sem paridade com o ecossistema LionClaw.
3. **Stub ambos como `PLANNED_MCP_SERVERS`** (entradas no catalog sem binário).
   - Rejeitado: a auditoria G9 (FIX-006) já ensinou que planejados sem binário poluem o UI e disparam G5 ("worker bloqueia no start"). Melhor remover da lista explicitamente do que ter fantasma.
4. **Substituir Higgsfield por `nano-banana` no PRD**.
   - Adotado parcialmente: `nano-banana` já está implementado (M3.3) e cobre image gen. PRD/PRD cita nano-banana como caminho para imagens. Higgsfield continua fora.

## Consequences

### Positivas
- Escopo v1 fica focado nos 15 MCPs já implementados (M3.3), cobrindo needs reais.
- Zero risco de billing acidental.
- Worker continua subindo limpo sem dependência de `mcp-remote`/`npx`.
- Decisão transparente em ADR para que qualquer usuário insatisfeito saiba onde propor.

### Negativas / Riscos
- Usuários vindos do LionClaw que usavam Higgsfield perdem a integração. Mitigação: README e changelog deixam claro "v2 roadmap".
- Pressupõe que `nano-banana` é substituto aceitável para image gen. Se não for, plano B é portar Higgsfield pontualmente em v2.

## Migration Notes

- `packages/infra/src/seed/built-in-mcps.ts`: ambos removidos (nem em `BUILT_IN_MCP_SERVERS` nem em `PLANNED_MCP_SERVERS`).
- `docs/FEATURE_MATRIX.md`: lista de "Planned" remove `Higgsfield` e `Blotato` (Blotato nem aparecia antes, mas fica explícito).
- `docs/PRD.md`: substitui "19+ integrações via MCP" por contagem honesta "15 integrações via MCP" na seção de realizações (M3.3 entregou 15).
- `docs/AUDIT_REPORT_LIONCLAW_WOLFKROW.md` items #5 e #6: marcar como `⛔ deferred para v2` (não atualizo o audit retroativamente; o ADR é o registro).
- Próximo release do LionClaw-migrator (`scripts/migrate-lionclaw.ts`): se detectar config de Higgsfield/Blotato no LionClaw, emitir warning "Blotato/Higgsfield não foram portados para Wolfkrow v1; use nano-banana para image gen". Não é bloqueante.

## Trigger para reverter (revogar este ADR)

Reabrir este ADR se:
1. ≥ 3 usuários LionClaw pedirem Higgsfield explicitamente no Wolfkrow.
2. OU LionClaw abandonar Higgsfield/Blotato (torna o gap irrelevante).
3. OU Wolfkrow ganhar Vault UI OAuth flow reutilizável que reduza o esforço para < 0.5 dia por integração.
