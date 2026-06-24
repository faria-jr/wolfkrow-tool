export function isExcalidrawTool(name: string): boolean {
  const lower = name.toLowerCase();
  if (!lower.includes('excalidraw')) return false;
  return (
    lower.endsWith('create_view') ||
    lower.endsWith('export_to_excalidraw') ||
    lower.endsWith('save_checkpoint')
  );
}

function parseElements(value: unknown): unknown[] | null {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return null;
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function parseContentObject(value: unknown): { elements: unknown[]; appState: Record<string, unknown> } | null {
  if (typeof value !== 'string') return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const obj = parsed as Record<string, unknown>;
    const elements = parseElements(obj['elements']);
    if (!elements) return null;
    const appState = obj['appState'] && typeof obj['appState'] === 'object'
      ? (obj['appState'] as Record<string, unknown>)
      : {};
    return { elements, appState };
  } catch {
    return null;
  }
}

type ElementsExtractor = (input: Record<string, unknown>) => { elements: unknown[]; appState: Record<string, unknown> } | null;

const extractFromArrayElements: ElementsExtractor = (input) => {
  if (!Array.isArray(input['elements'])) return null;
  const appState = input['appState'] && typeof input['appState'] === 'object'
    ? (input['appState'] as Record<string, unknown>)
    : {};
  return { elements: input['elements'] as unknown[], appState };
};

const extractFromStringElements: ElementsExtractor = (input) => {
  if (typeof input['elements'] !== 'string') return null;
  const elements = parseElements(input['elements']);
  return elements ? { elements, appState: {} } : null;
};

const extractFromContentArray: ElementsExtractor = (input) => {
  if (!Array.isArray(input['content'])) return null;
  return { elements: input['content'] as unknown[], appState: {} };
};

const extractFromContentObject: ElementsExtractor = (input) => {
  if (typeof input['content'] !== 'string') return null;
  return parseContentObject(input['content']);
};

const extractors: ElementsExtractor[] = [
  extractFromArrayElements,
  extractFromStringElements,
  extractFromContentObject,
  extractFromContentArray,
];

export function extractElements(input: Record<string, unknown>): {
  elements: unknown[];
  appState: Record<string, unknown>;
  title: string;
} | null {
  for (const extract of extractors) {
    const result = extract(input);
    if (result && result.elements.length > 0) {
      const title = (typeof input['title'] === 'string' ? input['title'] : undefined) ??
        (typeof input['name'] === 'string' ? input['name'] : undefined) ??
        'Excalidraw';
      return { elements: result.elements, appState: result.appState, title };
    }
  }
  return null;
}

export function buildExcalidrawFile(elements: unknown[], appState: Record<string, unknown>): string {
  return JSON.stringify({
    type: 'excalidraw',
    version: 2,
    source: 'wolfkrow',
    elements,
    appState: {
      gridSize: null,
      viewBackgroundColor: '#ffffff',
      ...appState,
    },
    files: {},
  }, null, 2);
}
