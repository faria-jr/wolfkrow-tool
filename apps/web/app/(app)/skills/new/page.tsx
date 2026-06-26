import { ArrowLeft, Sparkles } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { PageHeader } from '@/components/common/page-header';
import { PageContent, PageShell } from '@/components/common/page-shell';
import { SkillCreateScreen } from '@/components/skills/skill-create-screen';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'New skill',
  description: 'Create a reusable skill',
};

export default function NewSkillPage() {
  return (
    <PageShell>
      <PageHeader
        title="New skill"
        description="Write a reusable SKILL.md-style capability with frontmatter fields and markdown instructions."
        icon={<Sparkles className="h-6 w-6" />}
        actions={
          <Button asChild variant="outline">
            <Link href="/skills">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to skills
            </Link>
          </Button>
        }
      />
      <PageContent>
        <SkillCreateScreen />
      </PageContent>
    </PageShell>
  );
}
