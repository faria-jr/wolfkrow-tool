export interface PipelineTemplate {
  id: string;
  name: string;
  description: string;
  stages: string[];
}

export const PIPELINE_TEMPLATES: readonly PipelineTemplate[] = [
  {
    id: 'security-audit',
    name: 'Security Audit',
    description: 'Full security review: threat modeling, OWASP checks, auth analysis, and remediation report.',
    stages: ['discovery', 'spec_build', 'spec_validate', 'approval', 'implementation'],
  },
  {
    id: 'architecture-review',
    name: 'Architecture Review',
    description: 'Deep-dive architectural analysis: patterns, dependencies, module boundaries, and ADR generation.',
    stages: ['discovery', 'spec_build', 'spec_validate', 'approval', 'implementation'],
  },
  {
    id: 'feature-pipeline',
    name: 'Feature Pipeline',
    description: 'End-to-end feature delivery: discovery, spec, validation, approval, and TDD implementation.',
    stages: ['discovery', 'spec_build', 'spec_validate', 'approval', 'implementation'],
  },
  {
    id: 'development-v2',
    name: 'Development V2',
    description: 'Accelerated development cycle with parallel spec build and inline code review.',
    stages: ['discovery', 'spec_build', 'approval', 'implementation'],
  },
  {
    id: 'enrich-pipeline',
    name: 'Enrich Pipeline',
    description: 'Knowledge enrichment: validate data quality, run enrichment, and generate output report.',
    stages: ['discovery', 'spec_validate', 'implementation'],
  },
] as const;
