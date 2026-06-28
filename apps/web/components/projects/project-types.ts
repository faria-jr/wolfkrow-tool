export interface ProjectData {
  id: string;
  userId: string;
  name: string;
  description?: string;
  rootPath?: string;
  specPath?: string;
  defaultProviderId?: string;
  defaultPlannerModel?: string;
  defaultCoderModel?: string;
  tags: string[];
  status: 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export function statusVariant(status: string): 'default' | 'secondary' | 'outline' {
  return status === 'archived' ? 'outline' : 'default';
}
