import { BarChart3 } from 'lucide-react';
import dynamic from 'next/dynamic';

import { PageHeader } from '@/components/common/page-header';
import { PageContent, PageShell } from '@/components/common/page-shell';
import { BudgetBanner } from '@/components/usage/budget-banner';
import { BudgetSettings } from '@/components/usage/budget-settings';
import { PricingCalculatorCard } from '@/components/usage/pricing-calculator-card';

// recharts is heavy — lazy-load the charts so the /usage route owns the cost
// instead of every route.
const UsageCharts = dynamic(
  () => import('@/components/usage/usage-charts').then((m) => m.UsageCharts),
);

export default function UsagePage() {
  return (
    <PageShell>
      <PageHeader title="Usage" description="Token analytics and cost tracking" icon={<BarChart3 className="h-6 w-6" />} />
      <PageContent className="space-y-4">
        <BudgetBanner />
        <BudgetSettings />
        <PricingCalculatorCard />
        <UsageCharts />
      </PageContent>
    </PageShell>
  );
}
