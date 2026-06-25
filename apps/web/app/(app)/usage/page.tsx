import { BarChart3 } from 'lucide-react';

import { PageHeader } from '@/components/common/page-header';
import { PageContent, PageShell } from '@/components/common/page-shell';
import { BudgetBanner } from '@/components/usage/budget-banner';
import { BudgetSettings } from '@/components/usage/budget-settings';
import { PricingCalculatorCard } from '@/components/usage/pricing-calculator-card';
import { UsageCharts } from '@/components/usage/usage-charts';

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
