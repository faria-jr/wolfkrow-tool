import { ArrowLeft, ScrollText } from 'lucide-react';
import Link from 'next/link';

import { PageHeader } from '@/components/common/page-header';
import { PageContent, PageShell } from '@/components/common/page-shell';
import { RuleEditScreen } from '@/components/rules/rule-edit-screen';
import { Button } from '@/components/ui/button';

export const metadata = { title: 'Edit rule' };

interface PageProps { params: Promise<{ id: string }>; }

export default async function EditRulePage({ params }: PageProps) {
  const { id } = await params;
  return (
    <PageShell>
      <PageHeader
        title="Edit rule"
        description="Update the rule metadata and markdown body."
        icon={<ScrollText className="h-6 w-6" />}
        actions={<Button asChild variant="outline"><Link href="/rules"><ArrowLeft className="mr-2 h-4 w-4" />Back to rules</Link></Button>}
      />
      <PageContent>
        <RuleEditScreen ruleId={id} />
      </PageContent>
    </PageShell>
  );
}
