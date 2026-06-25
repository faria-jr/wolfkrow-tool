import { BarChart3 } from 'lucide-react';

import { PageHeader } from '@/components/common/page-header';
import { BudgetBanner } from '@/components/usage/budget-banner';
import { BudgetSettings } from '@/components/usage/budget-settings';
import { PricingCalculatorCard } from '@/components/usage/pricing-calculator-card';
import { UsageCharts } from '@/components/usage/usage-charts';

export default function UsagePage() {
  return (
    <div className="flex flex-col gap-4 p-4">
      <PageHeader title="Usage" description="Token analytics and cost tracking" icon={<BarChart3 className="h-6 w-6" />} />
      <BudgetBanner />
      <BudgetSettings />
      <PricingCalculatorCard />
      <UsageCharts />
    </div>
  );
}
