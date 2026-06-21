import { DesignStudio } from '@/components/sidecar/design-studio';

export default function DesignPage() {
  return (
    <div className="flex flex-col gap-4 p-4 h-full">
      <div>
        <h1 className="text-xl font-semibold">Design Studio</h1>
        <p className="text-sm text-muted-foreground">Open Design — visual editor</p>
      </div>
      <div className="flex-1 min-h-0">
        <DesignStudio />
      </div>
    </div>
  );
}
