'use client';

/**
 * P2-3 (SPEC-018) — Pricing calculator card.
 *
 * Live multi-source cost estimation using the canonical registry (P1-5).
 * Selects a model from {@link MODEL_CATALOG} and computes cost via the shared
 * {@link defaultPricingCalculator} — no inline pricing tables. Unknown models
 * show an explicit "pricing unknown" state (never a silent $0).
 */

import {
  MODEL_CATALOG,
  defaultPricingCalculator,
  formatCost,
  hasKnownPricing,
} from '@wolfkrow/domain/services';
import { useMemo, useState } from 'react';

interface ProviderGroup {
  providerId: string;
  models: readonly string[];
}

const UNKNOWN_MODEL_OPTION = 'totally-fake-model-xyz';

/** Catalog models grouped by provider, preserving catalog order. */
function groupCatalogByProvider(): ProviderGroup[] {
  const order: string[] = [];
  const map = new Map<string, string[]>();
  for (const entry of MODEL_CATALOG) {
    if (!map.has(entry.providerId)) {
      map.set(entry.providerId, []);
      order.push(entry.providerId);
    }
    map.get(entry.providerId)!.push(entry.model);
  }
  return order.map((providerId) => ({ providerId, models: map.get(providerId)! }));
}

const GROUPED_MODELS = groupCatalogByProvider();

function parseTokens(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

interface TokenInputProps {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
}

function TokenInput({ id, label, value, onChange }: TokenInputProps) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium">
        {label}
      </label>
      <input
        id={id}
        aria-label={label}
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0"
        className="border-input bg-background rounded border px-2 py-1 text-sm"
      />
    </div>
  );
}

interface ModelSelectorProps {
  value: string;
  onChange: (v: string) => void;
}

function ModelSelector({ value, onChange }: ModelSelectorProps) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor="pc-model" className="text-xs font-medium">
        Model
      </label>
      <select
        id="pc-model"
        aria-label="Model"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border-input bg-background rounded border px-2 py-1 text-sm"
      >
        {GROUPED_MODELS.map((g) => (
          <optgroup key={g.providerId} label={g.providerId}>
            {g.models.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </optgroup>
        ))}
        <optgroup label="unknown">
          <option value={UNKNOWN_MODEL_OPTION}>{UNKNOWN_MODEL_OPTION}</option>
        </optgroup>
      </select>
    </div>
  );
}

interface CostResultProps {
  known: boolean;
  costUsd: number | null;
}

function CostResult({ known, costUsd }: CostResultProps) {
  return (
    <div className="bg-muted/50 mt-1 rounded p-3">
      <p className="text-muted-foreground text-xs">Estimated cost</p>
      {known ? (
        <p data-testid="estimated-cost" className="text-xl font-bold">
          {formatCost(costUsd ?? 0)}
        </p>
      ) : (
        <p data-testid="pricing-unknown" className="text-muted-foreground text-sm font-medium">
          Pricing unknown for this model
        </p>
      )}
    </div>
  );
}

interface TokenFields {
  input: string;
  output: string;
  cacheRead: string;
  cacheWrite: string;
}

export function PricingCalculatorCard() {
  const [model, setModel] = useState('claude-sonnet-4-6');
  const [tokens, setTokens] = useState<TokenFields>({
    input: '',
    output: '',
    cacheRead: '',
    cacheWrite: '',
  });

  const known = useMemo(() => hasKnownPricing(model), [model]);

  const costUsd = useMemo(() => {
    if (!known) return null;
    return defaultPricingCalculator
      .cost(model, {
        inputTokens: parseTokens(tokens.input),
        outputTokens: parseTokens(tokens.output),
        cacheReadTokens: parseTokens(tokens.cacheRead),
        cacheWriteTokens: parseTokens(tokens.cacheWrite),
      })
      .toUSD();
  }, [known, model, tokens]);

  const set = (key: keyof TokenFields) => (v: string) => setTokens((t) => ({ ...t, [key]: v }));

  return (
    <div className="border-border bg-card rounded border p-4">
      <h2 className="mb-1 text-sm font-semibold">Pricing Calculator</h2>
      <p className="text-muted-foreground mb-3 text-xs">
        Estimate the per-turn cost for any model in the registry. Numbers are computed live from the
        canonical pricing data.
      </p>

      <div className="flex flex-col gap-3">
        <ModelSelector value={model} onChange={setModel} />

        <div className="grid grid-cols-2 gap-3">
          <TokenInput
            id="pc-input"
            label="Input tokens"
            value={tokens.input}
            onChange={set('input')}
          />
          <TokenInput
            id="pc-output"
            label="Output tokens"
            value={tokens.output}
            onChange={set('output')}
          />
          <TokenInput
            id="pc-cache-read"
            label="Cache read tokens"
            value={tokens.cacheRead}
            onChange={set('cacheRead')}
          />
          <TokenInput
            id="pc-cache-write"
            label="Cache write tokens"
            value={tokens.cacheWrite}
            onChange={set('cacheWrite')}
          />
        </div>

        <CostResult known={known} costUsd={costUsd} />
      </div>
    </div>
  );
}
