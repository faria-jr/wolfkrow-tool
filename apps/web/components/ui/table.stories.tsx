import type { Meta, StoryObj } from '@storybook/react';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './table';

const meta = {
  title: 'UI/Table',
  component: Table,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
} satisfies Meta<typeof Table>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <div className="w-[500px] rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead className="text-right">Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>ken99@yahoo.com</TableCell>
            <TableCell>Admin</TableCell>
            <TableCell className="text-right">$316.00</TableCell>
          </TableRow>
          <TableRow>
            <TableCell>abe45@gmail.com</TableCell>
            <TableCell>Member</TableCell>
            <TableCell className="text-right">$242.00</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  ),
};
