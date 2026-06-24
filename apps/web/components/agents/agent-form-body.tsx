'use client';

import { useQuery } from '@tanstack/react-query';
import type { Control } from 'react-hook-form';

import { ModelSection } from './model-section';
import type { ProviderDTO } from './model-section';
import type { AgentFormValues } from './schema';
import { SkillsSection } from './skills-section';
import { ThinkingSection } from './thinking-section';
import { ToolsSection } from './tools-section';

import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';

interface Props { control: Control<AgentFormValues>; }

export function AgentFormBody({ control }: Props) {
  const { data: providers } = useQuery<ProviderDTO[]>({
    queryKey: ['providers'],
    queryFn: () => fetch('/api/providers').then((r) => r.json() as Promise<ProviderDTO[]>),
    staleTime: 60_000,
  });

  return (
    <>
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
      <FormField
        control={control}
        name="systemPrompt"
        render={({ field }) => (
          <FormItem>
            <FormLabel>System prompt</FormLabel>
            <FormControl><Textarea rows={3} placeholder="You are a helpful assistant." {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <ScrollArea className="h-72 pr-4">
        <Tabs defaultValue="model">
          <TabsList className="mb-4">
            <TabsTrigger value="model">Model</TabsTrigger>
            <TabsTrigger value="tools">Tools</TabsTrigger>
            <TabsTrigger value="thinking">Thinking</TabsTrigger>
            <TabsTrigger value="skills">Skills</TabsTrigger>
          </TabsList>
          <TabsContent value="model"><ModelSection control={control} {...(providers !== undefined ? { providers } : {})} /></TabsContent>
          <TabsContent value="tools"><ToolsSection control={control} /></TabsContent>
          <TabsContent value="thinking"><ThinkingSection control={control} /></TabsContent>
          <TabsContent value="skills"><SkillsSection control={control} /></TabsContent>
        </Tabs>
      </ScrollArea>
    </>
  );
}
