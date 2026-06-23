#!/usr/bin/env node
/**
 * MCP server: excalidraw
 *
 * Generates Excalidraw scene JSON for the chat to render inline. Pure
 * local — no external API. Supports three tools: flow, sequence, and
 * mind-map diagrams.
 */

import {
  type McpHandlers,
  type McpTool,
  type McpToolResult,
  runJsonRpcServer,
} from '@wolfkrow/mcp-shared';

import { buildFlowScene, buildMindmapScene, buildSequenceScene } from './scenes/builders.js';

const tools: McpTool[] = [
  {
    name: 'create_flow',
    description: 'Create a flow/architecture diagram with labeled edges.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Diagram title' },
        nodes: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              label: { type: 'string' },
            },
            required: ['id', 'label'],
          },
        },
        edges: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              from: { type: 'string' },
              to: { type: 'string' },
              label: { type: 'string' },
            },
            required: ['from', 'to'],
          },
        },
      },
      required: ['nodes', 'edges'],
    },
  },
  {
    name: 'create_sequence',
    description: 'Create a sequence diagram (actors + ordered messages).',
    inputSchema: {
      type: 'object',
      properties: {
        actors: { type: 'array', items: { type: 'string' } },
        messages: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              from: { type: 'string' },
              to: { type: 'string' },
              label: { type: 'string' },
            },
            required: ['from', 'to', 'label'],
          },
        },
      },
      required: ['actors', 'messages'],
    },
  },
  {
    name: 'create_mindmap',
    description: 'Create a mind-map with a central root and branches.',
    inputSchema: {
      type: 'object',
      properties: {
        root: { type: 'string', description: 'Central node label' },
        branches: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              label: { type: 'string' },
              children: { type: 'array', items: { type: 'string' } },
            },
            required: ['label'],
          },
        },
      },
      required: ['root', 'branches'],
    },
  },
];

function text(data: unknown): McpToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

function failure(message: string): McpToolResult {
  return { content: [{ type: 'text', text: message }], isError: true };
}

export const handlers: McpHandlers = {
  listTools: () => tools,
  callTool: async (name, args) => {
    try {
      if (name === 'create_flow') return text(buildFlowScene(args));
      if (name === 'create_sequence') return text(buildSequenceScene(args));
      if (name === 'create_mindmap') return text(buildMindmapScene(args));
      return failure(`Unknown tool: ${name}`);
    } catch (err) {
      return failure((err as Error).message);
    }
  },
};

runJsonRpcServer(process.stdin, process.stdout, handlers);
