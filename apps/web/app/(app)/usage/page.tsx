import { BudgetBanner } from '@/components/usage/budget-banner';
import { UsageCharts } from '@/components/usage/usage-charts';

export default function UsagePage() {
  return (
    <div className="flex flex-col gap-4 p-4">
      <div>
        <h1 className="text-xl font-semibold">Usage</h1>
        <p className="text-sm text-muted-foreground">Token analytics and cost tracking</p>
      </div>
      <BudgetBanner />
      <UsageCharts />
    </div>
  );
}
