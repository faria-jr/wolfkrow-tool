'use client';

/**
 * BudgetSettings ().
 *
 * Lets the user configure their monthly budget in USD.
 * Persists the value to localStorage under 'wolfkrow:budget_usd' and fires
 * a 'wolfkrow:budget-changed' CustomEvent so BudgetBanner can re-fetch.
 */

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'wolfkrow:budget_usd';
const DEFAULT_BUDGET = 50;

function readStoredBudget(): number {
 try {
 const raw = localStorage.getItem(STORAGE_KEY);
 const parsed = Number(raw ?? DEFAULT_BUDGET);
 return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_BUDGET;
 } catch {
 return DEFAULT_BUDGET;
 }
}

interface BudgetFormProps {
 inputValue: string;
 isValid: boolean;
 saved: boolean;
 onInput: (v: string) => void;
 onSave: () => void;
}

function BudgetForm({ inputValue, isValid, saved, onInput, onSave }: BudgetFormProps) {
 return (
 <div className="flex items-center gap-2">
 <label htmlFor="budget-input" className="text-sm">Monthly budget (USD)</label>
 <input id="budget-input" type="number" min={1} step={1} value={inputValue}
 onChange={(e) => onInput(e.target.value)}
 className="w-24 rounded border border-input bg-background px-2 py-1 text-sm" />
 <button type="button" onClick={onSave} disabled={!isValid}
 className="rounded bg-primary px-3 py-1 text-sm text-primary-foreground disabled:opacity-50">
 Save
 </button>
 {saved && <span className="text-xs text-green-600 dark:text-green-400">Saved!</span>}
 </div>
 );
}

export function BudgetSettings() {
 const [inputValue, setInputValue] = useState<string>(String(DEFAULT_BUDGET));
 const [currentBudget, setCurrentBudget] = useState<number>(DEFAULT_BUDGET);
 const [saved, setSaved] = useState(false);

 useEffect(() => {
 const stored = readStoredBudget();
 setCurrentBudget(stored);
 setInputValue(String(stored));
 }, []);

 const parsedValue = Number(inputValue);
 const isValid = Number.isFinite(parsedValue) && parsedValue > 0;

 function handleSave() {
 if (!isValid) return;
 localStorage.setItem(STORAGE_KEY, String(parsedValue));
 setCurrentBudget(parsedValue);
 window.dispatchEvent(new CustomEvent('wolfkrow:budget-changed'));
 setSaved(true);
 setTimeout(() => setSaved(false), 2000);
 }

 return (
 <div className="rounded border border-border bg-card p-4">
 <h2 className="mb-1 text-sm font-semibold">Budget Settings</h2>
 <p className="mb-3 text-xs text-muted-foreground">
 Current budget: <span className="font-medium">${currentBudget}</span> / month
 </p>
 <BudgetForm inputValue={inputValue} isValid={isValid} saved={saved}
 onInput={(v) => { setSaved(false); setInputValue(v); }} onSave={handleSave} />
 </div>
 );
}
