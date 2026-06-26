import { ArrowLeft, Sparkles } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { PageHeader } from '@/components/common/page-header';
import { PageContent, PageShell } from '@/components/common/page-shell';
import { SkillEditScreen } from '@/components/skills/skill-edit-screen';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Edit skill',
  description: 'Edit a reusable skill',
};

interface PageProps { params: Promise<{ id: string }>; }

export default async function SkillEditPage({ params }: PageProps) {
  const { id } = await params;
  return (
    <PageShell>
      <PageHeader
        title="Edit skill"
        description="Update the skill frontmatter, tags, and markdown instructions."
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
        <SkillEditScreen skillId={id} />
      </PageContent>
    </PageShell>
  );
}
