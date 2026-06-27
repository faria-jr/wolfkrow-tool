'use client';

import { useQuery } from '@tanstack/react-query';
import type { Control } from 'react-hook-form';

import { ModelSection } from './model-section';
import type { ProviderDTO } from './model-section';
import type { AgentFormValues } from './schema';
import { SkillsSection } from './skills-section';
import { ThinkingSection } from './thinking-section';
import { ToolsSection } from './tools-section';

import { MarkdownEditor } from '@/components/common/markdown-editor';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Props { control: Control<AgentFormValues>; }

function NameField({ control }: Props) {
  return (
    <FormField
      control={control}
      name="name"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Name</FormLabel>
          <FormControl><Input aria-label="name" placeholder="my-agent" {...field} /></FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function SystemPromptField({ control }: Props) {
  return (
    <FormField
      control={control}
      name="systemPrompt"
      render={({ field }) => (
        <FormItem>
          <FormLabel>System prompt</FormLabel>
          <FormControl>
            {/* EPIC 1.1 + 3.3 — shared MarkdownEditor (Edit/Preview tabs) so
                agents get the same rich authoring experience as skills. */}
            <MarkdownEditor
              value={field.value ?? ''}
              onChange={field.onChange}
              label="System prompt"
              placeholder="You are a helpful assistant. Describe the agent's role, capabilities, and constraints."
              rows={6}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function ConfigTabs({ control }: Props) {
  return (
    <ScrollArea className="h-72 pr-4 mt-4">
      <Tabs defaultValue="tools">
        <TabsList className="mb-4">
          <TabsTrigger value="tools">Tools</TabsTrigger>
          <TabsTrigger value="thinking">Thinking</TabsTrigger>
          <TabsTrigger value="skills">Skills</TabsTrigger>
        </TabsList>
        <TabsContent value="tools"><ToolsSection control={control} /></TabsContent>
        <TabsContent value="thinking"><ThinkingSection control={control} /></TabsContent>
        <TabsContent value="skills"><SkillsSection control={control} /></TabsContent>
      </Tabs>
    </ScrollArea>
  );
}

export function AgentFormBody({ control }: Props) {
  const { data: providers } = useQuery<ProviderDTO[]>({
    queryKey: ['providers'],
    queryFn: () => fetch('/api/providers').then((r) => r.json() as Promise<ProviderDTO[]>),
    staleTime: 60_000,
  });
  return (
    <div className="space-y-4">
      <NameField control={control} />
      <SystemPromptField control={control} />
      <ModelSection control={control} providers={providers} />
      <ConfigTabs control={control} />
    </div>
  );
}