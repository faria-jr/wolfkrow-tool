import { PIPELINE_TEMPLATES } from '@wolfkrow/infra';

interface Props {
  onSelect: (templateId: string) => void;
}

export function PipelineTemplatePicker({ onSelect }: Props) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {PIPELINE_TEMPLATES.map((t) => (
        <div key={t.id} className="bg-card flex flex-col gap-2 rounded-lg border p-3">
          <div>
            <p className="text-sm font-medium">{t.name}</p>
            <p className="text-muted-foreground text-xs">{t.description}</p>
          </div>
          <button
            onClick={() => onSelect(t.id)}
            className="bg-primary text-primary-foreground mt-auto rounded px-3 py-1.5 text-xs font-medium"
          >
            Use
          </button>
        </div>
      ))}
    </div>
  );
}
