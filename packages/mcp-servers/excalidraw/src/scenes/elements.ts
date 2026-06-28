/**
 * Shared element factories for Excalidraw scene builders.
 * Keeps the inline element templates out of the scene builders so each
 * function stays under the max-lines-per-function budget.
 */

let counter = 0;
export function resetIdCounter(): void {
  counter = 0;
}
export function nextElementId(): string {
  counter += 1;
  return `el-${counter}`;
}

export interface BaseProps {
  x: number;
  y: number;
  width: number;
  height: number;
}

function baseElement(id: string, type: string, props: BaseProps): Record<string, unknown> {
  return {
    id,
    type,
    x: props.x,
    y: props.y,
    width: props.width,
    height: props.height,
    angle: 0,
    strokeColor: '#000000',
    backgroundColor: 'transparent',
    fillStyle: 'solid',
    strokeWidth: 1,
    strokeStyle: 'solid',
    roughness: 1,
    opacity: 100,
    groupIds: [],
    frameId: null,
    roundness: null,
    seed: 1,
    version: 1,
    versionNonce: 1,
    isDeleted: false,
    boundElements: null,
    updated: 1,
    link: null,
    locked: false,
  };
}

export function rectangle(
  id: string,
  props: BaseProps,
  options: { strokeColor?: string; backgroundColor?: string; seed?: number } = {}
): Record<string, unknown> {
  return {
    ...baseElement(id, 'rectangle', props),
    strokeColor: options.strokeColor ?? '#000000',
    backgroundColor: options.backgroundColor ?? 'transparent',
    roundness: { type: 3 },
    seed: options.seed ?? 1,
  };
}

export function ellipse(
  id: string,
  props: BaseProps,
  options: { strokeColor?: string; backgroundColor?: string; seed?: number } = {}
): Record<string, unknown> {
  return {
    ...baseElement(id, 'ellipse', props),
    strokeColor: options.strokeColor ?? '#000000',
    backgroundColor: options.backgroundColor ?? 'transparent',
    seed: options.seed ?? 1,
  };
}

export function text(
  id: string,
  props: BaseProps,
  textValue: string,
  options: { strokeColor?: string; fontSize?: number; seed?: number } = {}
): Record<string, unknown> {
  const fontSize = options.fontSize ?? 16;
  return {
    ...baseElement(id, 'text', props),
    strokeColor: options.strokeColor ?? '#000000',
    roundness: null,
    seed: options.seed ?? 2,
    fontSize,
    fontFamily: 1,
    text: textValue,
    textAlign: 'center',
    verticalAlign: 'middle',
    baseline: fontSize,
    containerId: null,
    originalText: textValue,
    lineHeight: 1.25,
  };
}

export function arrow(
  id: string,
  origin: { x: number; y: number },
  points: Array<[number, number]>,
  options: { strokeColor?: string; strokeStyle?: 'solid' | 'dashed'; seed?: number } = {}
): Record<string, unknown> {
  return {
    ...baseElement(id, 'arrow', { x: origin.x, y: origin.y, width: 0, height: 0 }),
    strokeColor: options.strokeColor ?? '#000000',
    strokeStyle: options.strokeStyle ?? 'solid',
    roundness: { type: 2 },
    seed: options.seed ?? 3,
    startBinding: null,
    endBinding: null,
    lastCommittedPoint: null,
    startArrowhead: null,
    endArrowhead: 'arrow',
    points,
  };
}

export interface LineOptions {
  strokeColor?: string;
  seed?: number;
}

export function line(
  id: string,
  origin: { x: number; y: number },
  points: Array<[number, number]>,
  options: LineOptions = {}
): Record<string, unknown> {
  return {
    ...baseElement(id, 'line', { x: origin.x, y: origin.y, width: 0, height: 0 }),
    strokeColor: options.strokeColor ?? '#000000',
    seed: options.seed ?? 4,
    startBinding: null,
    endBinding: null,
    lastCommittedPoint: null,
    startArrowhead: null,
    endArrowhead: null,
    points,
  };
}
