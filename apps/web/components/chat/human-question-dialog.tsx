'use client';

import { useEffect, useState } from 'react';

import type { PendingHumanQuestion } from './sse';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface Props {
  question: PendingHumanQuestion | null;
  /** Resolves the parked worker promise; the returned text is sent as the next user message. */
  onAnswer: (questionId: string, answer: string) => void | Promise<unknown>;
  onDismiss: () => void;
}

function OptionButtons({
  options,
  busy,
  onPick,
}: {
  options: string[];
  busy: boolean;
  onPick: (opt: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <Button key={opt} variant="outline" disabled={busy} onClick={() => onPick(opt)}>
          {opt}
        </Button>
      ))}
    </div>
  );
}

function FreeTextAnswer({
  text,
  setText,
  busy,
  onSubmit,
  onDismiss,
}: {
  text: string;
  setText: (v: string) => void;
  busy: boolean;
  onSubmit: () => void;
  onDismiss: () => void;
}) {
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }} className="space-y-2">
      <Label htmlFor="human-question-answer" className="sr-only">
        Your answer
      </Label>
      <Textarea
        id="human-question-answer"
        placeholder="Type your answer…"
        rows={3}
        value={text}
        onChange={(e) => setText(e.target.value)}
        autoFocus
      />
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onDismiss} disabled={busy}>
          Dismiss
        </Button>
        <Button type="submit" disabled={busy || !text.trim()}>
          {busy ? 'Sending…' : 'Answer'}
        </Button>
      </DialogFooter>
    </form>
  );
}

/**
 * HITL ask-user dialog. Rendered when the worker emits a `human_question`
 * event (e.g. an agent invoked the `ask_user` tool). The answer resolves the
 * parked worker promise and flows back into the conversation as the next user
 * message — a real round-trip, not a UI mock.
 */
export function HumanQuestionDialog({ question, onAnswer, onDismiss }: Props) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setText('');
    setBusy(false);
  }, [question?.questionId]);

  if (!question) return null;
  const hasOptions = (question.options?.length ?? 0) > 0;

  const submit = async (answer: string) => {
    if (!answer.trim() || busy) return;
    setBusy(true);
    await onAnswer(question.questionId, answer.trim());
  };

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onDismiss()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Agent asks</DialogTitle>
          <DialogDescription>{question.question}</DialogDescription>
        </DialogHeader>
        {hasOptions ? (
          <OptionButtons options={question.options!} busy={busy} onPick={(o) => void submit(o)} />
        ) : (
          <FreeTextAnswer
            text={text}
            setText={setText}
            busy={busy}
            onSubmit={() => void submit(text)}
            onDismiss={onDismiss}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
