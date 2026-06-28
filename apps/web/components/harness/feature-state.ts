/**
 * Pure feature-state reducers for the harness execution console.
 *
 * Extracted from execution-run-hook.ts so the hook module stays under the
 * size limit. These functions take the current feature-state array and return
 * an updated copy for a given SSE event — no React, no side effects.
 */

import type { FeatureState, ToolCallChip } from './execution-run-hook';

export function initFeatures(
  features: { name: string }[],
): FeatureState[] {
  return features.map((feature, index) => ({
    coderText: '',
    currentRound: 0,
    evaluatorText: '',
    index,
    name: feature.name,
    rounds: 0,
    stage: 'idle',
    status: 'pending',
    toolCalls: [],
  }));
}

export function updateFeature(
  features: FeatureState[],
  featureIndex: number,
  updater: (feature: FeatureState) => FeatureState
): FeatureState[] {
  return features.map((feature, index) => (index === featureIndex ? updater(feature) : feature));
}

export function applyProgress(
  prev: FeatureState[],
  featureIndex: number,
  round: number,
  stage: FeatureState['stage']
): FeatureState[] {
  return updateFeature(prev, featureIndex, (feature) => ({
    ...feature,
    currentRound: round,
    stage,
    status: 'running',
  }));
}

export function applyCoderChunk(prev: FeatureState[], featureIndex: number, delta: string): FeatureState[] {
  return updateFeature(prev, featureIndex, (feature) => ({
    ...feature,
    coderText: feature.coderText + delta,
  }));
}

export function applyEvaluatorChunk(
  prev: FeatureState[],
  featureIndex: number,
  delta: string
): FeatureState[] {
  return updateFeature(prev, featureIndex, (feature) => ({
    ...feature,
    evaluatorText: feature.evaluatorText + delta,
  }));
}

export function applyToolCall(
  prev: FeatureState[],
  featureIndex: number,
  call: { id: string; name: string }
): FeatureState[] {
  return updateFeature(prev, featureIndex, (feature) => ({
    ...feature,
    toolCalls: [...feature.toolCalls, { id: call.id, name: call.name, status: 'running' }],
  }));
}

export function applyToolResult(
  prev: FeatureState[],
  featureIndex: number,
  callId: string,
  isError: boolean
): FeatureState[] {
  return updateFeature(prev, featureIndex, (feature) => ({
    ...feature,
    toolCalls: feature.toolCalls.map((toolCall: ToolCallChip) =>
      toolCall.id === callId ? { ...toolCall, status: isError ? 'error' : 'done' } : toolCall
    ),
  }));
}

export function applyFeatureDone(
  prev: FeatureState[],
  featureIndex: number,
  rounds: number,
  passed: boolean
): FeatureState[] {
  return updateFeature(prev, featureIndex, (feature) => ({
    ...feature,
    rounds,
    stage: 'idle',
    status: passed ? 'passed' : 'failed',
  }));
}
