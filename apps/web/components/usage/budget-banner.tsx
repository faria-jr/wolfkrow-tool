'use client';

/**
 * BudgetBanner (FIX-032).
 *
 * The `/usage/budget` endpoint + its Next.js proxy existed but nothing in the UI
 * consumed them, so budget overruns were invisible. This banner surfaces them on
 * the Usage page: red when exceeded, amber when usage crosses 80%.
 */

import { useEffect, useState } from 'react';

interface BudgetStatus {
  spentUSD: number;
  budgetUSD: number;
  percentUsed: number;
  exceeded: boolean;
}

const DEFAULT_BUDGET_USD = 50;
const APPROACH_THRESHOLD_PERCENT = 80;
const STORAGE_KEY = 'wolfkrow:budget_usd';

const usd = (n: number): string => `$${n.toFixed(2)}`;

function readBudget(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = Number(raw ?? DEFAULT_BUDGET_USD);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_BUDGET_USD;
  } catch {
    return DEFAULT_BUDGET_USD;
  }
}

export function BudgetBanner() {
  const [status, setStatus] = useState<BudgetStatus | null>(null);

  function fetchBudget() {
    const budgetUSD = readBudget();
    fetch(`/api/usage/budget?budgetUSD=${budgetUSD}`)
      .then((r) => r.json() as Promise<BudgetStatus>)
      .then(setStatus)
      .catch(() => {
        // Banner is non-critical — never crash the Usage page on a fetch error.
      });
  }

  useEffect(() => {
    fetchBudget();
    window.addEventListener('wolfkrow:budget-changed', fetchBudget);
    return () => {
      window.removeEventListener('wolfkrow:budget-changed', fetchBudget);
    };
  }, []);

  if (!status || (!status.exceeded && status.percentUsed < APPROACH_THRESHOLD_PERCENT)) {
    return null;
  }

  if (status.exceeded) {
    return (
      <div
        role="alert"
        className="rounded border border-red-500 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-400"
      >
        <strong>Budget exceeded</strong> — {usd(status.spentUSD)} spent of{' '}
        {usd(status.budgetUSD)} budget ({status.percentUsed.toFixed(0)}%).
      </div>
    );
  }

  return (
    <div
      role="alert"
      className="rounded border border-amber-500 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400"
    >
      <strong>Approaching budget limit</strong> — {usd(status.spentUSD)} spent of{' '}
      {usd(status.budgetUSD)} ({status.percentUsed.toFixed(0)}%).
    </div>
  );
}
