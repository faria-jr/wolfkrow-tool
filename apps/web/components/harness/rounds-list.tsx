'use client';

import { useEffect, useState } from 'react';

import { DiffViewer } from './diff-viewer';

interface RoundData {
  id: string;
  sprintId: string;
  featureIndex: number;
  roundNumber: number;
  coderOutput: string | null;
  evaluatorFeedback: string | null;
  passed: boolean;
  tokens: number;
  startedAt: string | null;
  completedAt: string | null;
}

interface RoundsListProps {
  sprintId: string;
}

type FetchState = {
  rounds: RoundData[] | null;
  error: string | null;
};

const INITIAL: FetchState = { rounds: null, error: null };

/**
 * M5.3 — Renders the round-by-round Coder→Evaluator history for a sprint
 * with a unified diff between consecutive rounds. Fetches `/api/harness/
 * sprints/:sprintId/rounds` on mount, shows the latest coder output
 * per round, and a `<DiffViewer>` comparing each round to the previous.
 */
export function RoundsList({ sprintId }: RoundsListProps) {
  const [state, setState] = useState<FetchState>(INITIAL);

  useEffect(() => {
    let cancelled = false;
    void loadRounds(sprintId).then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, [sprintId]);

  if (state.rounds === null) {
    return <p className="text-xs text-gray-500">Loading rounds…</p>;
  }
  if (state.error) {
    return <p className="text-xs text-red-600">{state.error}</p>;
  }
  if (state.rounds.length === 0) {
    return <p className="text-xs text-gray-500">No rounds yet. Run the harness to start the Coder→Evaluator loop.</p>;
  }
  return <RoundsBody rounds={state.rounds} />;
}

async function loadRounds(sprintId: string): Promise<FetchState> {
  try {
    const res = await fetch(
      `/api/harness/sprints/${encodeURIComponent(sprintId)}/rounds`,
      { credentials: 'include' },
    );
    if (!res.ok) {
      return { rounds: [], error: `Failed to load rounds: ${res.status}` };
    }
    return { rounds: (await res.json()) as RoundData[], error: null };
  } catch (err) {
    return { rounds: [], error: err instanceof Error ? err.message : 'Error' };
  }
}

function RoundsBody({ rounds }: { rounds: RoundData[] }) {
  return (
    <div className="mt-4 space-y-3 border-t pt-3">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Rounds</h4>
      {rounds.map((round, idx) => (
        <RoundCard
          key={round.id}
          round={round}
          prev={idx > 0 ? rounds[idx - 1] : undefined}
        />
      ))}
    </div>
  );
}

function RoundCard({ round, prev }: { round: RoundData; prev: RoundData | undefined }) {
  const showDiff = canShowDiff(prev, round);
  return (
    <div className="rounded border bg-white p-3">
      <div className="flex items-center justify-between text-xs">
        <RoundHeader round={round} />
        {round.completedAt && (
          <span className="text-gray-400">
            {new Date(round.completedAt).toLocaleString()}
          </span>
        )}
      </div>
      {round.evaluatorFeedback && (
        <p className="mt-2 rounded bg-gray-50 px-2 py-1 text-xs text-gray-700">
          <strong>Evaluator:</strong> {round.evaluatorFeedback}
        </p>
      )}
      {round.coderOutput && <CoderOutputBlock output={round.coderOutput} />}
      {showDiff && prev && (
        <details className="mt-2" data-testid="round-diff">
          <summary className="cursor-pointer text-xs text-blue-600 hover:underline">
            Show diff vs round {prev.roundNumber}
          </summary>
          <div className="mt-2">
            <DiffViewer
              before={prev.coderOutput ?? ''}
              after={round.coderOutput ?? ''}
              title={`Round ${prev.roundNumber} → ${round.roundNumber}`}
              maxLines={200}
            />
          </div>
        </details>
      )}
    </div>
  );
}

function canShowDiff(prev: RoundData | undefined, round: RoundData): boolean {
  return prev !== undefined
    && prev.coderOutput !== null
    && round.coderOutput !== null;
}

function RoundHeader({ round }: { round: RoundData }) {
  return (
    <div className="flex items-center gap-2">
      <span className="font-mono">Round {round.roundNumber}</span>
      <span
        className={`rounded px-1.5 py-0.5 ${
          round.passed
            ? 'bg-green-100 text-green-800'
            : 'bg-yellow-100 text-yellow-800'
        }`}
      >
        {round.passed ? 'passed' : 'failed'}
      </span>
      <span className="text-gray-500">{round.tokens} tokens</span>
    </div>
  );
}

function CoderOutputBlock({ output }: { output: string }) {
  return (
    <pre className="mt-2 max-h-48 overflow-auto rounded bg-gray-900 px-2 py-1 font-mono text-[11px] text-gray-100">
      {output}
    </pre>
  );
}
