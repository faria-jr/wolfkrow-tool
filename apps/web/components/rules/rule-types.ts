export type RuleKind = 'behavior' | 'soul' | 'user' | 'custom';

export interface RuleData {
  id: string;
  userId?: string;
  kind: RuleKind;
  title: string;
  body: string;
  enabled: boolean;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
}

export const RULE_KIND_LABELS: Record<RuleKind, string> = {
  behavior: 'Behavior',
  soul: 'Soul',
  user: 'User',
  custom: 'Custom',
};

export const RULE_KINDS: RuleKind[] = ['behavior', 'soul', 'user', 'custom'];
