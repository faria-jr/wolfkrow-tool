'use client';

import { useState } from 'react';
import type { UseFormReturn } from 'react-hook-form';

import type { ProviderFormValues } from './schema';

import { Button } from '@/components/ui/button';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

type FormControlType = UseFormReturn<ProviderFormValues>['control'];
type FieldName = keyof ProviderFormValues;

interface TextFieldProps {
  control: FormControlType;
  name: Extract<FieldName, 'id' | 'displayName' | 'baseUrl' | 'apiKeyAccount' | 'apiKey'>;
  label: string;
  type?: string;
  placeholder?: string;
  disabled?: boolean;
}

function TextField({ control, name, label, type = 'text', placeholder, disabled }: TextFieldProps) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl><Input type={type} placeholder={placeholder} disabled={disabled} {...field} /></FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function ProtocolField({ control }: { control: FormControlType }) {
  return (
    <FormField
      control={control}
      name="protocol"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Protocol</FormLabel>
          <Select onValueChange={field.onChange} defaultValue={field.value}>
            <FormControl>
              <SelectTrigger><SelectValue /></SelectTrigger>
            </FormControl>
            <SelectContent>
              <SelectItem value="anthropic-compat">Anthropic-compatible</SelectItem>
              <SelectItem value="openai-compatible">OpenAI-compatible</SelectItem>
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function SupportsToolsField({ control }: { control: FormControlType }) {
  return (
    <FormField
      control={control}
      name="supportsTools"
      render={({ field }) => (
        <FormItem className="flex items-center gap-2">
          <FormControl>
            <Switch checked={field.value} onCheckedChange={field.onChange} />
          </FormControl>
          <FormLabel className="!mt-0">Supports tools</FormLabel>
        </FormItem>
      )}
    />
  );
}

function ModelTags({ models, onRemove }: { models: readonly string[]; onRemove: (i: number) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {models.map((m, i) => (
        <span key={i} className="flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-sm">
          {m}
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground"
            onClick={() => onRemove(i)}
          >
            ×
          </button>
        </span>
      ))}
    </div>
  );
}

function ModelInput({ models, onChange, error }: { models: readonly string[]; onChange: (next: string[]) => void; error?: string | undefined }) {
  const [modelInput, setModelInput] = useState('');

  const add = () => {
    const trimmed = modelInput.trim();
    if (!trimmed) return;
    onChange([...models, trimmed]);
    setModelInput('');
  };

  const remove = (idx: number) => onChange(models.filter((_, i) => i !== idx));

  return (
    <div className="space-y-2">
      <FormLabel>Models</FormLabel>
      <div className="flex gap-2">
        <Input
          aria-label="Models"
          value={modelInput}
          onChange={(e) => setModelInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          placeholder="model-name"
        />
        <Button type="button" variant="outline" onClick={add}>Add model</Button>
      </div>
      {error && <p className="text-destructive text-sm">{error}</p>}
      <ModelTags models={models} onRemove={remove} />
    </div>
  );
}

interface ProviderFormFieldsProps {
  form: UseFormReturn<ProviderFormValues>;
  isEditing?: boolean;
  hasApiKey?: boolean;
}

export function ProviderFormFields({ form, isEditing = false, hasApiKey = false }: ProviderFormFieldsProps) {
  const models = form.watch('models');

  return (
    <>
      {isEditing && <TextField control={form.control} name="id" label="Provider ID" disabled />}
      <TextField control={form.control} name="displayName" label="Display name" />
      <ProtocolField control={form.control} />
      <TextField control={form.control} name="baseUrl" label="Base URL" placeholder="https://..." />
      <TextField control={form.control} name="apiKeyAccount" label="API key account" />
      <ModelInput
        models={models}
        onChange={(next) => form.setValue('models', next)}
        error={form.formState.errors.models?.message}
      />
      <SupportsToolsField control={form.control} />
      <TextField
        control={form.control}
        name="apiKey"
        label={hasApiKey ? 'API key (leave blank to keep existing)' : 'API key (optional — stored in vault)'}
        type="password"
        placeholder="sk-..."
      />
      {isEditing && hasApiKey && (
        <p className="text-muted-foreground text-xs">An API key is already stored. Leave the field blank to keep it.</p>
      )}
    </>
  );
}
