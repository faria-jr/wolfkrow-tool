'use client';

import { Bot, Clock, Cpu, DollarSign, Loader2, Send, Terminal, User } from 'lucide-react';
import type React from 'react';

import type { FeatureState } from './execution-run-hook';
import { formatMs } from './execution-run-hook';
import type { ChatMsg } from './execution-view-shell';
import { RoundsList } from './rounds-list';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export interface HarnessConsoleProps {
  chatInput: string;
  coderScrollRef: React.RefObject<HTMLPreElement | null>;
  elapsed: number;
  evalScrollRef: React.RefObject<HTMLPreElement | null>;
  featureChats: ChatMsg[];
  isTyping: boolean;
  onChatInputChange: (value: string) => void;
  onSendChat: () => void;
  selectedFeature: FeatureState | undefined;
  sprintId: string;
}

export function HarnessConsole(props: HarnessConsoleProps) {
  return (
    <Card className="flex min-h-0 flex-col border-zinc-800 bg-zinc-950 lg:col-span-8">
      {props.selectedFeature ? <FeatureTabs {...props} /> : <EmptyConsole />}
    </Card>
  );
}

function FeatureTabs(props: HarnessConsoleProps) {
  return (
    <Tabs defaultValue="logs" className="flex min-h-0 flex-1 flex-col">
      <ConsoleHeader feature={props.selectedFeature} />
      <LogsTab {...props} />
      <TabsContent value="history" className="m-0 min-h-0 flex-1 overflow-y-auto p-4">
        <RoundsList sprintId={props.sprintId} />
      </TabsContent>
      <ChatTab {...props} />
    </Tabs>
  );
}

function ConsoleHeader({ feature }: { feature: FeatureState | undefined }) {
  return (
    <div className="flex shrink-0 items-center justify-between border-b border-zinc-800 bg-zinc-900/40 px-4 py-2">
      <span className="truncate text-xs font-semibold text-zinc-300">Console: {feature?.name}</span>
      <TabsList className="h-8 scale-90 border border-zinc-800 bg-zinc-950">
        <TabsTrigger value="logs" className="text-xs">
          Live logs
        </TabsTrigger>
        <TabsTrigger value="history" className="text-xs">
          Round history
        </TabsTrigger>
        <TabsTrigger value="chat" className="text-xs">
          HITL Chat
        </TabsTrigger>
      </TabsList>
    </div>
  );
}

function LogsTab(props: HarnessConsoleProps) {
  if (!props.selectedFeature) return null;
  return (
    <TabsContent value="logs" className="m-0 flex min-h-0 flex-1 flex-col space-y-3 p-3">
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 md:grid-cols-2">
        <StreamPanel
          active={props.selectedFeature.stage === 'coder'}
          color="text-blue-400"
          emptyText="Waiting for coder output..."
          label="Coder stream"
          refEl={props.coderScrollRef}
          text={props.selectedFeature.coderText}
        />
        <StreamPanel
          active={props.selectedFeature.stage === 'evaluator'}
          color="text-amber-400"
          emptyText="Waiting for evaluator feedback..."
          label="Evaluator stream"
          refEl={props.evalScrollRef}
          text={props.selectedFeature.evaluatorText}
        />
      </div>
      <MetricsFooter elapsed={props.elapsed} feature={props.selectedFeature} />
    </TabsContent>
  );
}

function StreamPanel({
  active,
  color,
  emptyText,
  label,
  refEl,
  text,
}: {
  active: boolean;
  color: string;
  emptyText: string;
  label: string;
  refEl: React.RefObject<HTMLPreElement | null>;
  text: string;
}) {
  return (
    <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950">
      <div className="flex shrink-0 items-center gap-2 border-b border-zinc-800 bg-zinc-900/60 px-3 py-2">
        <Terminal className={`h-3.5 w-3.5 ${color}`} />
        <span className="text-xs font-semibold text-zinc-300">{label}</span>
        {active && (
          <span className={`ml-auto animate-pulse font-mono text-xs ${color}`}>active</span>
        )}
      </div>
      <pre
        ref={refEl}
        className="flex-1 select-text overflow-y-auto whitespace-pre-wrap break-words bg-zinc-950/80 p-3 font-mono text-xs leading-relaxed text-zinc-300"
      >
        {text || <span className="italic text-zinc-600">{emptyText}</span>}
      </pre>
    </div>
  );
}

function MetricsFooter({ elapsed, feature }: { elapsed: number; feature: FeatureState }) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-6 rounded-lg border border-zinc-800 bg-zinc-900/20 px-3 py-2 font-mono text-xs text-zinc-500">
      <span className="flex items-center gap-1.5">
        <Cpu className="h-3.5 w-3.5 text-zinc-400" /> Tokens: ~
        {(feature.coderText.length / 4).toLocaleString()}
      </span>
      <span className="flex items-center gap-1.5">
        <DollarSign className="h-3.5 w-3.5 text-zinc-400" /> Est. Cost: ~$
        {(feature.coderText.length * 0.000002).toFixed(4)}
      </span>
      <span className="flex items-center gap-1.5">
        <Clock className="h-3.5 w-3.5 text-zinc-400" /> Elapsed: {formatMs(elapsed)}
      </span>
    </div>
  );
}

function ChatTab(props: HarnessConsoleProps) {
  return (
    <TabsContent value="chat" className="m-0 flex min-h-0 flex-1 flex-col">
      <ChatMessages featureChats={props.featureChats} isTyping={props.isTyping} />
      <ChatInput
        chatInput={props.chatInput}
        onChatInputChange={props.onChatInputChange}
        onSendChat={props.onSendChat}
      />
    </TabsContent>
  );
}

function ChatMessages({ featureChats, isTyping }: { featureChats: ChatMsg[]; isTyping: boolean }) {
  return (
    <ScrollArea className="flex-1 p-4">
      <div className="space-y-3">
        <AgentIntroMessage />
        {featureChats.map((message, index) => (
          <ChatBubble key={`${message.sender}-${index}`} message={message} />
        ))}
        {isTyping && <TypingIndicator />}
      </div>
    </ScrollArea>
  );
}

function AgentIntroMessage() {
  return (
    <div className="flex max-w-3xl gap-2.5 rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 text-xs text-zinc-400">
      <Bot className="h-4 w-4 shrink-0 text-amber-500" />
      <div>
        <p className="mb-0.5 font-semibold text-zinc-300">Evaluator Agent</p>
        <p>
          Use this channel to supply guidance or correct the implementation constraints for the
          active feature.
        </p>
      </div>
    </div>
  );
}

function ChatBubble({ message }: { message: ChatMsg }) {
  return (
    <div
      className={`flex max-w-3xl gap-2.5 rounded-lg border p-3 text-xs ${chatBubbleClass(message.sender)}`}
    >
      {message.sender === 'user' ? (
        <User className="h-4 w-4 shrink-0 text-blue-400" />
      ) : (
        <Bot className="h-4 w-4 shrink-0 text-amber-400" />
      )}
      <div>
        <p className="mb-0.5 font-semibold text-zinc-300">
          {message.sender === 'user' ? 'You' : 'Agent'}
        </p>
        <p className="whitespace-pre-wrap">{message.text}</p>
      </div>
    </div>
  );
}

function chatBubbleClass(sender: ChatMsg['sender']) {
  if (sender === 'user') return 'ml-auto border-primary/20 bg-primary/10 text-zinc-200';
  return 'border-zinc-800 bg-zinc-900/60 text-zinc-300';
}

function TypingIndicator() {
  return (
    <div className="text-muted-foreground flex items-center gap-2 px-3 font-mono text-xs italic">
      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Agent is typing...
    </div>
  );
}

function ChatInput({
  chatInput,
  onChatInputChange,
  onSendChat,
}: {
  chatInput: string;
  onChatInputChange: (value: string) => void;
  onSendChat: () => void;
}) {
  return (
    <div className="flex shrink-0 gap-2 border-t border-zinc-800 bg-zinc-900/20 p-3">
      <Input
        className="border-zinc-800 bg-zinc-950 text-xs text-zinc-200"
        onChange={(event) => onChatInputChange(event.target.value)}
        onKeyDown={(event) => event.key === 'Enter' && onSendChat()}
        placeholder="Provide instructions to guide the agent..."
        value={chatInput}
      />
      <Button className="shrink-0 gap-1.5" onClick={onSendChat} size="sm">
        <Send className="h-3 w-3" /> Send
      </Button>
    </div>
  );
}

function EmptyConsole() {
  return (
    <div className="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-2 text-xs">
      <Terminal className="h-8 w-8 text-zinc-700" />
      <span>Select a feature from the left list to view logs.</span>
    </div>
  );
}
