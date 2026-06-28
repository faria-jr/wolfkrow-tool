import { arrow, ellipse, line, rectangle, text } from './elements.js';

interface FlowNode {
  id?: unknown;
  label?: unknown;
}
interface FlowEdge {
  from?: unknown;
  to?: unknown;
  label?: unknown;
}

const COL_SPACING = 220;
const ROW_SPACING = 110;

interface FlowLayoutContext {
  cols: number;
  positions: Map<string, { x: number; y: number }>;
}

function addFlowNode(
  elements: unknown[],
  node: FlowNode,
  idx: number,
  ctx: FlowLayoutContext,
) {
  const id = typeof node.id === 'string' ? node.id : `n${idx}`;
  const col = idx % ctx.cols;
  const row = Math.floor(idx / ctx.cols);
  const x = 100 + col * COL_SPACING;
  const y = 100 + row * ROW_SPACING;
  ctx.positions.set(id, { x, y });
  const label = typeof node.label === 'string' ? node.label : id;
  elements.push(
    rectangle(
      `n-${idx}`,
      { x, y, width: 180, height: 60 },
      { strokeColor: '#1971c2', backgroundColor: '#d0ebff', seed: 1 + idx },
    ),
  );
  elements.push(
    text(
      `n-${idx}-label`,
      { x: x + 10, y: y + 20, width: 160, height: 20 },
      label,
      { strokeColor: '#1971c2', fontSize: 16, seed: 100 + idx },
    ),
  );
}

function addFlowEdge(
  elements: unknown[],
  edge: FlowEdge,
  edgeIdx: number,
  positions: Map<string, { x: number; y: number }>,
) {
  const from = positions.get(String(edge.from ?? ''));
  const to = positions.get(String(edge.to ?? ''));
  if (!from || !to) return;
  elements.push(
    arrow(
      `e-${edgeIdx}`,
      { x: from.x + 180, y: from.y + 30 },
      [
        [0, 0],
        [to.x - from.x - 180, to.y - from.y + 30],
      ],
      { strokeColor: '#495057', seed: 200 + edgeIdx },
    ),
  );
  if (typeof edge.label === 'string' && edge.label.length > 0) {
    elements.push(
      text(
        `e-${edgeIdx}-label`,
        {
          x: (from.x + to.x) / 2,
          y: (from.y + to.y) / 2 - 10,
          width: 120,
          height: 16,
        },
        edge.label,
        { strokeColor: '#495057', fontSize: 12, seed: 300 + edgeIdx },
      ),
    );
  }
}

export function buildFlowScene(args: Record<string, unknown>): unknown {
  const title = typeof args['title'] === 'string' ? args['title'] : 'Flow';
  const nodes = Array.isArray(args['nodes']) ? (args['nodes'] as FlowNode[]) : [];
  const edges = Array.isArray(args['edges']) ? (args['edges'] as FlowEdge[]) : [];
  const positions = new Map<string, { x: number; y: number }>();
  const cols = Math.max(1, Math.ceil(Math.sqrt(nodes.length)));
  const ctx: FlowLayoutContext = { cols, positions };
  const elements: unknown[] = [];

  nodes.forEach((node, idx) => addFlowNode(elements, node, idx, ctx));
  edges.forEach((edge, idx) => addFlowEdge(elements, edge, idx, positions));

  return wrapScene(title, elements);
}

const SEQUENCE_SPACING = 180;

function addActor(elements: unknown[], actor: unknown, idx: number) {
  const label = typeof actor === 'string' ? actor : `Actor ${idx + 1}`;
  const x = 120 + idx * SEQUENCE_SPACING;
  elements.push(
    rectangle(
      `actor-${idx}`,
      { x, y: 60, width: 120, height: 40 },
      { strokeColor: '#2f9e44', backgroundColor: '#b2f2bb', seed: 100 + idx },
    ),
  );
  elements.push(
    text(
      `actor-${idx}-label`,
      { x, y: 70, width: 120, height: 20 },
      label,
      { strokeColor: '#2f9e44', fontSize: 16, seed: 200 + idx },
    ),
  );
}

function addMessage(
  elements: unknown[],
  msg: { from?: unknown; to?: unknown; label?: unknown },
  idx: number,
  actors: unknown[],
) {
  const fromLabel = typeof msg.from === 'string' ? msg.from : '';
  const toLabel = typeof msg.to === 'string' ? msg.to : '';
  const fromIdx = actors.indexOf(fromLabel);
  const toIdx = actors.indexOf(toLabel);
  if (fromIdx < 0 || toIdx < 0) return;
  const y = 160 + idx * 60;
  elements.push(
    arrow(
      `msg-${idx}`,
      { x: 120 + fromIdx * SEQUENCE_SPACING + 60, y },
      [
        [0, 0],
        [(toIdx - fromIdx) * SEQUENCE_SPACING, 0],
      ],
      { strokeColor: '#495057', strokeStyle: 'dashed', seed: 300 + idx },
    ),
  );
  if (typeof msg.label === 'string' && msg.label.length > 0) {
    elements.push(
      text(
        `msg-${idx}-label`,
        {
          x: 120 + fromIdx * SEQUENCE_SPACING + 60,
          y: y - 18,
          width: 200,
          height: 16,
        },
        msg.label,
        { strokeColor: '#495057', fontSize: 12, seed: 400 + idx },
      ),
    );
  }
}

export function buildSequenceScene(args: Record<string, unknown>): unknown {
  const actors = Array.isArray(args['actors']) ? (args['actors'] as unknown[]) : [];
  const messages = Array.isArray(args['messages'])
    ? (args['messages'] as Array<{ from?: unknown; to?: unknown; label?: unknown }>)
    : [];
  const elements: unknown[] = [];

  actors.forEach((actor, idx) => addActor(elements, actor, idx));
  messages.forEach((msg, idx) => addMessage(elements, msg, idx, actors));

  return wrapScene('Sequence', elements);
}

function addBranch(elements: unknown[], branch: { label?: unknown }, idx: number, total: number) {
  const radius = 280;
  const angle = (idx / Math.max(1, total)) * 2 * Math.PI;
  const x = 480 + radius * Math.cos(angle) - 80;
  const y = 340 + radius * Math.sin(angle) - 25;
  const branchLabel = typeof branch.label === 'string' ? branch.label : `Branch ${idx + 1}`;
  elements.push(
    line(
      `b-${idx}-line`,
      { x: 480, y: 340 },
      [
        [0, 0],
        [x + 80 - 480, y + 25 - 340],
      ],
      { strokeColor: '#868e96', seed: 100 + idx },
    ),
  );
  elements.push(
    rectangle(
      `b-${idx}`,
      { x, y, width: 160, height: 50 },
      { strokeColor: '#5c940d', backgroundColor: '#d3f9d8', seed: 200 + idx },
    ),
  );
  elements.push(
    text(
      `b-${idx}-label`,
      { x: x + 10, y: y + 15, width: 140, height: 20 },
      branchLabel,
      { strokeColor: '#5c940d', fontSize: 14, seed: 300 + idx },
    ),
  );
}

export function buildMindmapScene(args: Record<string, unknown>): unknown {
  const root = typeof args['root'] === 'string' ? args['root'] : 'Root';
  const branches = Array.isArray(args['branches'])
    ? (args['branches'] as Array<{ label?: unknown }>)
    : [];
  const elements: unknown[] = [];
  elements.push(
    ellipse(
      'root',
      { x: 400, y: 300, width: 160, height: 80 },
      { strokeColor: '#e8590c', backgroundColor: '#ffe8cc', seed: 1 },
    ),
  );
  elements.push(
    text(
      'root-label',
      { x: 410, y: 330, width: 140, height: 20 },
      root,
      { strokeColor: '#e8590c', fontSize: 18, seed: 2 },
    ),
  );

  branches.forEach((branch, idx) => addBranch(elements, branch, idx, branches.length));

  return wrapScene(`Mindmap: ${root}`, elements);
}

function wrapScene(title: string, elements: unknown[]): unknown {
  return {
    type: 'excalidraw',
    version: 2,
    source: 'wolfkrow-mcp',
    title,
    elements,
    appState: { viewBackgroundColor: '#ffffff' },
    files: {},
  };
}
