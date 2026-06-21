/**
 * Built-in skills (14 from .wolfkrow/skills/)
 */

export const BUILT_IN_SKILLS = [
  {
    name: 'skill-creator',
    description: 'Create new skills following best practices',
    content: `# Skill Creator\n\nThis skill helps you create new skills...`,
    tags: ['meta', 'authoring'] as string[],
    version: '1.0.0',
  },
  {
    name: 'pdf',
    description: 'Process PDF documents (extract text, tables, metadata)',
    content: `# PDF Processing\n\nUse pdf-parse or pdfjs-dist...`,
    tags: ['documents', 'parsing'] as string[],
    version: '1.0.0',
  },
  {
    name: 'webapp-testing',
    description: 'Test web applications using Playwright',
    content: `# Web App Testing\n\nUse Playwright for E2E tests...`,
    tags: ['testing', 'e2e'] as string[],
    version: '1.0.0',
  },
  {
    name: 'mcp-builder',
    description: 'Build MCP servers following the protocol',
    content: `# MCP Builder\n\nMCP servers use JSON-RPC over stdio...`,
    tags: ['mcp', 'integrations'] as string[],
    version: '1.0.0',
  },
  {
    name: 'frontend-design',
    description: 'Design principles for modern frontend',
    content: `# Frontend Design\n\nDesign tokens, components, layouts...`,
    tags: ['design', 'frontend'] as string[],
    version: '1.0.0',
  },
  {
    name: 'design-taste-frontend',
    description: 'Curated design taste and aesthetics',
    content: `# Design Taste (Frontend)\n\nAesthetics, typography, color theory...`,
    tags: ['design'] as string[],
    version: '1.0.0',
  },
  {
    name: 'design-visual-alto-nivel',
    description: 'High-end visual design language',
    content: `# High-Level Visual Design\n\nApple-tier aesthetics...`,
    tags: ['design', 'visual'] as string[],
    version: '1.0.0',
  },
  {
    name: 'ui-brutalista-industrial',
    description: 'Brutalist / industrial UI style',
    content: `# Brutalist Industrial UI\n\nRaw, monospace, high contrast...`,
    tags: ['design', 'ui-style'] as string[],
    version: '1.0.0',
  },
  {
    name: 'ui-minimalista',
    description: 'Minimalist UI style',
    content: `# Minimalist UI\n\nLess is more...`,
    tags: ['design', 'ui-style'] as string[],
    version: '1.0.0',
  },
  {
    name: 'ui-premium-veo3',
    description: 'Premium / cinematic UI style',
    content: `# Premium Cinematic UI\n\nMotion, depth, atmosphere...`,
    tags: ['design', 'ui-style'] as string[],
    version: '1.0.0',
  },
  {
    name: 'stitch-design-taste',
    description: 'Stitch design taste curation',
    content: `# Stitch Design Taste\n\nCurated patterns and aesthetics...`,
    tags: ['design'] as string[],
    version: '1.0.0',
  },
  {
    name: 'redesign-projetos-existentes',
    description: 'Redesign existing projects with modern patterns',
    content: `# Redesign Existing Projects\n\nMigration strategies...`,
    tags: ['refactor', 'migration'] as string[],
    version: '1.0.0',
  },
  {
    name: 'context-cleanup',
    description: 'Clean and optimize context for agents',
    content: `# Context Cleanup\n\nReduce noise, focus attention...`,
    tags: ['optimization', 'context'] as string[],
    version: '1.0.0',
  },
  {
    name: 'dreaming',
    description: 'Background memory maintenance',
    content: `# Dreaming\n\nIdle maintenance tasks...`,
    tags: ['memory', 'background'] as string[],
    version: '1.0.0',
  },
] as const;
