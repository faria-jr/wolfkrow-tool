import { RulesEditor } from '@/components/rules/rules-editor';

export default function RulesPage() {
  return (
    <div className="flex flex-col gap-4 p-4">
      <div>
        <h1 className="text-xl font-semibold">Rules</h1>
        <p className="text-sm text-muted-foreground">Global rules injected into every prompt</p>
      </div>
      <RulesEditor />
    </div>
  );
}
