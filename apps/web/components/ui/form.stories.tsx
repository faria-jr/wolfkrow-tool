import type { Meta, StoryObj } from '@storybook/react';

/**
 * NOTE: FormLabel / FormControl / FormDescription / FormMessage each call
 * `useFormField()` which requires a react-hook-form FormProvider at runtime.
 * To keep this story light (no resolver wiring), we render the visual layout
 * using FormItem + raw Label/Input, which does NOT depend on the form context.
 * See `react-hook-form` docs to wire a full FormField/FormControl tree.
 */
import { FormItem } from './form';
import { Input } from './input';
import { Label } from './label';

const meta = {
  title: 'UI/Form',
  component: FormItem,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
} satisfies Meta<typeof FormItem>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Layout: Story = {
  render: () => (
    <div className="w-[400px]">
      <FormItem>
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" placeholder="you@example.com" />
        <p className="text-sm text-muted-foreground">
          Enter the email address associated with your account.
        </p>
      </FormItem>
    </div>
  ),
};
