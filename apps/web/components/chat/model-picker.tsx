'use client';

import { useCallback, useEffect, useState } from 'react';

import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';

export interface ProviderOption {
  id: string;
  displayName: string;
  models: readonly string[];
}

interface UseProvidersResult {
  providers: ProviderOption[];
  loading: boolean;
}

/**
 * EPIC 3.1 — Fetches the user's configured providers (each with its model list)
 * so the in-chat model picker can offer every cadastrado model, grouped by
 * provider. Empty/failed fetch leaves the picker usable with the current model.
 */
export function useProviders(): UseProvidersResult {
  const [providers, setProviders] = useState<ProviderOption[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/providers');
      if (!res.ok) return;
      const data = (await res.json()) as ProviderOption[];
      setProviders(Array.isArray(data) ? data.filter((p) => Array.isArray(p.models) && p.models.length > 0) : []);
    } catch {
      // leave providers empty — picker falls back to the current model
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  return { providers, loading };
}

export interface ModelPickerProps {
  value: string;
  onChange: (model: string) => void;
}

export function ModelPicker({ value, onChange }: ModelPickerProps) {
  const { providers } = useProviders();
  if (providers.length === 0) {
    // No providers configured (or still loading) — show the active model read-only.
    return <span className="text-xs text-muted-foreground tabular-nums">{value}</span>;
  }
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-7 w-48 text-xs" aria-label="Select model">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {providers.map((p) => (
          <SelectGroup key={p.id}>
            <SelectLabel className="text-xs">{p.displayName}</SelectLabel>
            {p.models.map((m) => (
              <SelectItem key={`${p.id}:${m}`} value={m} className="text-xs">{m}</SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}
