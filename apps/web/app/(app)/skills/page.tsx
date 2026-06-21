import { SkillsView } from '@/components/skills/skills-view';

export const metadata = { title: 'Skills' };

export default function SkillsPage() {
  return (
    <div className="container py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Skills</h1>
        <p className="text-muted-foreground">Reusable capabilities injected into agent system prompts.</p>
      </div>
      <SkillsView />
    </div>
  );
}
