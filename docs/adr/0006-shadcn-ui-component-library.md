# ADR-0006: shadcn/ui como Biblioteca de Componentes

**Status**: ✅ Aceito
**Data**: 2026-06-20

## Contexto

O LionClaw v3 tem UI components implementados ad-hoc com Tailwind inline:

- `AgentFormModal.tsx` (1765 linhas) — form gigante
- `PipelineMetricsReport.tsx` (1647 linhas) — relatório complexo
- `SprintExecutionView.tsx` (1643 linhas) — execução
- 50+ outros componentes com classes Tailwind duplicadas

Problemas:
1. **Inconsistência visual**: espaçamentos, cores, typography variam
2. **Refactor caro**: mudar design = editar 50+ arquivos
3. **Acessibilidade**: ARIA attributes adicionados manualmente (muitos faltando)
4. **Bundle bloat**: cada componente reimplementa Button, Input, etc
5. **Sem design tokens**: cores hardcoded (`zinc-950`, `amber-500`)

## Decisão

**shadcn/ui** como biblioteca de componentes base.

```bash
pnpm dlx shadcn@latest add button card input label dialog sheet tabs
```

Componentes são **copiados para o projeto** (`apps/web/components/ui/`), não instalados como npm dep. Isso permite:
- Customização total
- Zero vendor lock-in
- Tree-shaking perfeito
- Ownership do código

## Consequências

### Positivas

- **49+ componentes prontos**: Button, Card, Input, Dialog, Sheet, Tabs, Command, Form, DataTable, Calendar, Chart, etc
- **Base sólida**: Radix UI primitives (acessibilidade WCAG AAA)
- **Customizável**: copy to project, edit as needed
- **Tailwind nativo**: zero CSS-in-JS, zero runtime overhead
- **Design tokens via CSS variables**: `--background`, `--foreground`, etc
- **Dark mode built-in**: via next-themes
- **TypeScript first**: todos componentes tipados

### Negativas

- **Componentes copiados**: atualizações requerem re-pull manual
- **Componentes faltando**: VoiceOrb, GraphCanvas, Terminal não têm equivalente
- **Bundle size**: cada componente tem suas deps Radix (~5-20KB cada)

### Mitigações

- shadcn CLI regenera componentes facilmente
- Custom components para o que falta
- Tree-shaking remove deps Radix não usadas

## Componentes a Instalar

### Core (Dia 1)
- `button`, `card`, `input`, `label`, `textarea`
- `dialog`, `sheet`, `popover`, `dropdown-menu`
- `tabs`, `accordion`, `collapsible`
- `select`, `checkbox`, `radio-group`, `switch`, `slider`
- `form` (react-hook-form integration)
- `toast` (sonner)
- `tooltip`
- `separator`
- `scroll-area`
- `skeleton`
- `badge`
- `progress`
- `avatar`
- `alert-dialog`

### Advanced (Dia 2-3)
- `command` (cmdk-based search/command palette)
- `data-table` (TanStack Table wrapper)
- `calendar` (react-day-picker)
- `chart` (recharts wrappers)
- `carousel` (embla-carousel)
- `drawer` (vaul)
- `breadcrumb`
- `pagination`
- `resizable`
- `sidebar` (custom for our app)
- `sonner` (toast)
- `kbd` (keyboard shortcuts display)

## Customização via Design Tokens

### `apps/web/app/globals.css`
```css
@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 240 10% 3.9%;
    --primary: 24 95% 53%;  /* amber-500 */
    --primary-foreground: 0 0% 98%;
    --secondary: 240 4.8% 95.9%;
    --muted: 240 4.8% 95.9%;
    --accent: 240 4.8% 95.9%;
    --destructive: 0 84.2% 60.2%;
    --border: 240 5.9% 90%;
    --ring: 24 95% 53%;
    --radius: 0.5rem;
  }
  
  .dark {
    --background: 240 10% 3.9%;
    --foreground: 0 0% 98%;
    --primary: 24 95% 53%;
    --secondary: 240 3.7% 15.9%;
    /* ... */
  }
}
```

### `apps/web/components.json`
```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "app/globals.css",
    "baseColor": "zinc",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils"
  }
}
```

## Componentes Customizados (não-shadcn)

Alguns componentes não têm equivalente em shadcn e precisam ser criados:

### `VoiceOrb`
Visualizador de voice conversation (orb animado com Web Audio analyser).

### `GraphCanvas`
Knowledge graph (D3 force layout) — `react-flow` ou custom.

### `Terminal`
xterm.js wrapper para CodeBurn PTY.

### `StreamIndicator`
Live SSE indicator (animated dot).

### `MarkdownEditor`
Markdown com frontmatter parser + preview.

### `VoiceRecorder`
Web Audio API capture + waveform visualization.

## Refactor Targets

### Forms (maior impacto)

| Componente atual | Linhas | Target |
|---|---|---|
| AgentFormModal | 1765 | 400 (shadcn Form) |
| ExternalProvidersPanel | 1097 | 300 (shadcn Form) |
| OrchestratorSelector | 633 | 200 (RadioGroup + Card) |
| NewPipelineModal | 597 | 200 (Dialog + Form) |
| TaskFormModal | 422 | 200 (Dialog + Form) |
| SyncAgentsModal | 672 | 300 (Dialog + DataTable) |

### Visualizadores

| Componente atual | Linhas | Target |
|---|---|---|
| PipelineMetricsReport | 1647 | 600 (DataTable + Charts) |
| SprintExecutionView | 1643 | 500 (Tabs + Cards + Stream) |
| ArchitectureReviewArtifactView | 858 | 300 (ScrollArea + Code + Badge) |
| AuditFinalSummaryView | 600+ | 250 (Accordion) |
| KnowledgePage | 1564 | 500 (Tabs + DataTable + Upload) |

**Total reduction**: ~12.000 linhas → ~4.500 linhas (~62%).

## Acessibilidade (built-in via Radix)

shadcn/ui usa Radix UI primitives que são WCAG AAA compliant:

- **Keyboard navigation**: Tab, Enter, Escape, Arrow keys
- **ARIA attributes**: role, aria-label, aria-describedby, etc
- **Focus management**: trap focus in modals, restore on close
- **Screen reader**: anúncios corretos
- **High contrast**: respeita prefers-contrast

## Alternativas Consideradas

### A. Material UI / Chakra UI / Mantine

**Prós**: Maduro, completo
**Contras**: Vendor lock-in, CSS-in-JS runtime, design opinionated, bundle pesado
**Decisão**: ❌ Rejeitado — shadcn é mais leve e customizável

### B. Headless UI (Tailwind Labs)

**Prós**: Tailwind-native, mantido pelos criadores do Tailwind
**Contras**: Menos componentes, mais boilerplate
**Decisão**: ❌ Aceitável, mas shadcn constrói em cima disso com mais componentes

### C. Radix UI direto

**Prós**: Máxima flexibilidade
**Contras**: Muito boilerplate, sem styling
**Decisão**: ❌ Rejeitado — shadcn já combina Radix + Tailwind perfeitamente

### D. Componentes custom (status quo)

**Prós**: Zero deps
**Contras**: 50+ componentes para manter, inconsistência
**Decisão**: ❌ Rejeitado — é o problema

### E. NextUI / HeroUI

**Prós**: Bonito, baseado em Tailwind
**Contras**: Mais opinionated, menos customizável que shadcn
**Decisão**: ❌ Rejeitado — shadcn tem melhor DX

## References

- [shadcn/ui](https://ui.shadcn.com/)
- [Radix UI](https://www.radix-ui.com/)
- [next-themes](https://github.com/pacocoursey/next-themes)
- [cmdk](https://cmdk.paco.me/)
- [react-day-picker](https://react-day-picker.js.org/)
- [recharts](https://recharts.org/)
- [vaul](https://vaul.emilkowal.ski/)
