'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

interface Props {
  open: boolean;
  question: string;
  onAnswer: (answer: string) => void;
  onCancel: () => void;
}

export function AskQuestionDialog({ open, question, onAnswer, onCancel }: Props) {
  const [answer, setAnswer] = useState('');

  const handleSubmit = () => {
    const trimmed = answer.trim();
    if (!trimmed) return;
    onAnswer(trimmed);
    setAnswer('');
  };

  const handleOpenChange = (o: boolean) => {
    if (!o) { setAnswer(''); onCancel(); }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>AI has a question</DialogTitle>
          <DialogDescription>{question}</DialogDescription>
        </DialogHeader>
        <Textarea
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="Your answer…"
          rows={3}
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => { setAnswer(''); onCancel(); }}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!answer.trim()}>Send answer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
