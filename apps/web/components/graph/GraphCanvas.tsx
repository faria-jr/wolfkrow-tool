'use client';

import type * as d3 from 'd3';
import { useEffect, useRef, useState } from 'react';

import type { GraphEdge, GraphNode, NodeType } from './types';

/** Color per node type (kept in sync with domain NodeType). */
const TYPE_COLOR: Record<NodeType, string> = {
  document: '#f59e0b',
  entity: '#3b82f6',
  concept: '#10b981',
  memory: '#a855f7',
};

export interface GraphCanvasProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedId?: string | null;
  onSelect?: (node: GraphNode | null) => void;
  height?: number;
}

interface SimNode extends d3.SimulationNodeDatum {
  id: string;
  label: string;
  type: NodeType;
}
interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  relation: string;
  weight: number;
}

type SvgSel = d3.Selection<SVGSVGElement, unknown, null, undefined>;
type GroupSel = d3.Selection<SVGGElement, SimNode, SVGGElement, undefined>;

interface RenderOpts {
  svgEl: SVGSVGElement;
  nodes: GraphNode[];
  edges: GraphEdge[];
  width: number;
  height: number;
  selectedId: string | null;
  onSelect: ((node: GraphNode | null) => void) | undefined;
}

function toSimNodes(nodes: GraphNode[]): SimNode[] {
  return nodes.map((n) => ({ id: n.id, label: n.label, type: n.type }));
}

function toSimLinks(edges: GraphEdge[], idMap: Map<string, SimNode>): SimLink[] {
  return edges
    .filter((e) => idMap.has(e.sourceNodeId) && idMap.has(e.targetNodeId))
    .map((e) => ({
      source: idMap.get(e.sourceNodeId)!,
      target: idMap.get(e.targetNodeId)!,
      relation: e.relation,
      weight: e.weight,
    }));
}

async function applyZoom(
  svg: SvgSel
): Promise<d3.Selection<SVGGElement, unknown, null, undefined>> {
  const d3mod = await import('d3');
  const root = svg.append('g');
  const zoom = d3mod
    .zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.25, 4])
    .on('zoom', (event) => root.attr('transform', event.transform.toString()));
  svg.call(zoom);
  return root;
}

async function makeDragBehavior(
  simulation: d3.Simulation<SimNode, undefined>
): Promise<d3.DragBehavior<SVGGElement, SimNode, unknown>> {
  const d3mod = await import('d3');
  return d3mod
    .drag<SVGGElement, SimNode>()
    .on('start', (event, d) => {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    })
    .on('drag', (event, d) => {
      d.fx = event.x;
      d.fy = event.y;
    })
    .on('end', (event, d) => {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    });
}

function styleNodes(node: GroupSel, selectedId: string | null): void {
  node
    .append('circle')
    .attr('r', (d) => (d.type === 'document' ? 10 : 7))
    .attr('fill', (d) => TYPE_COLOR[d.type])
    .attr('stroke', (d) => (d.id === selectedId ? '#fff' : 'none'))
    .attr('stroke-width', 3);
  node
    .append('text')
    .text((d) => d.label)
    .attr('x', 12)
    .attr('y', 4)
    .attr('font-size', 11)
    .attr('fill', '#e2e8f0')
    .attr('paint-order', 'stroke')
    .attr('stroke', '#0f172a')
    .attr('stroke-width', 3);
}

function attachTick(
  simulation: d3.Simulation<SimNode, undefined>,
  link: d3.Selection<SVGLineElement, SimLink, SVGGElement, unknown>,
  node: GroupSel
): void {
  simulation.on('tick', () => {
    link
      .attr('x1', (d) => (d.source as SimNode).x ?? 0)
      .attr('y1', (d) => (d.source as SimNode).y ?? 0)
      .attr('x2', (d) => (d.target as SimNode).x ?? 0)
      .attr('y2', (d) => (d.target as SimNode).y ?? 0);
    node.attr('transform', (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
  });
}

/**
 * D3 force-directed graph renderer. D3 is imported dynamically so it stays
 * out of the initial client bundle (SPEC-022 §4).
 * Supports: drag nodes, zoom/pan, click to select (US-1/US-2/US-3).
 */
async function renderGraph(opts: RenderOpts): Promise<void> {
  const { svgEl, nodes, edges, width, height, selectedId, onSelect } = opts;
  const d3mod = await import('d3');
  d3mod.select(svgEl).selectAll('*').remove();

  const svg = d3mod.select(svgEl);
  const root = await applyZoom(svg);

  const simNodes = toSimNodes(nodes);
  const idMap = new Map(simNodes.map((n) => [n.id, n]));
  const simLinks = toSimLinks(edges, idMap);

  const link = root
    .append('g')
    .attr('stroke', '#475569')
    .attr('stroke-opacity', 0.4)
    .selectAll<SVGLineElement, SimLink>('line')
    .data(simLinks)
    .join('line')
    .attr('stroke-width', (d) => Math.max(1, Math.min(4, d.weight)));

  const simulation = d3mod
    .forceSimulation(simNodes)
    .force(
      'link',
      d3mod
        .forceLink<SimNode, SimLink>(simLinks)
        .id((d) => d.id)
        .distance(70)
    )
    .force('charge', d3mod.forceManyBody().strength(-180))
    .force('center', d3mod.forceCenter(width / 2, height / 2))
    .force('collide', d3mod.forceCollide().radius(28));

  const node = root
    .append('g')
    .selectAll<SVGGElement, SimNode>('g')
    .data(simNodes)
    .join('g')
    .style('cursor', 'pointer')
    .call(await makeDragBehavior(simulation));

  styleNodes(node, selectedId);
  node.on('click', (_event, d) => {
    onSelect?.(nodes.find((n) => n.id === d.id) ?? null);
  });
  svg.on('click', (event) => {
    if (event.target === svgEl) onSelect?.(null);
  });
  attachTick(simulation, link, node);
}

export function GraphCanvas({
  nodes,
  edges,
  selectedId,
  onSelect,
  height = 560,
}: GraphCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(800);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) setWidth(entry.contentRect.width);
    });
    ro.observe(el);
    setWidth(el.clientWidth || 800);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;
    let cancelled = false;
    void renderGraph({
      svgEl,
      nodes,
      edges,
      width,
      height,
      selectedId: selectedId ?? null,
      onSelect,
    }).then(() => {
      if (cancelled && svgRef.current) {
        while (svgRef.current.firstChild) svgRef.current.removeChild(svgRef.current.firstChild);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [nodes, edges, width, height, selectedId, onSelect]);

  return (
    <div ref={containerRef} className="border-border w-full rounded-lg border bg-slate-950">
      <svg
        ref={svgRef}
        role="img"
        aria-label="Knowledge graph"
        width={width}
        height={height}
        className="block"
      />
    </div>
  );
}

export default GraphCanvas;
