import { RuleTester } from 'eslint';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import rule from './no-arbitrary-tailwind.mjs';

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
});

describe('no-arbitrary-tailwind', () => {
  it('passes valid token-based classes', () => {
    ruleTester.run('no-arbitrary-tailwind', rule, {
      valid: [
        '<div className="p-4 text-muted-foreground" />',
        '<div className="bg-success/15 text-success max-w-content" />',
        '<div className="w-[--sidebar-width]" />',
        "cn('flex gap-2 p-4')",
        'const greeting = "hello world";',
      ],
      invalid: [],
    });
  });

  it('reports arbitrary text/bg/size values', () => {
    ruleTester.run('no-arbitrary-tailwind', rule, {
      valid: [],
      invalid: [
        { code: '<div className="text-[10px]" />', errors: [{ messageId: 'noArbitrary' }] },
        { code: '<div className="bg-[#ffffff]" />', errors: [{ messageId: 'noArbitrary' }] },
        { code: '<div className="max-w-[80%]" />', errors: [{ messageId: 'noArbitrary' }] },
        { code: "cn('min-h-[200px]')", errors: [{ messageId: 'noArbitrary' }] },
        { code: 'const cls = `w-[180px]`;', errors: [{ messageId: 'noArbitrary' }] },
      ],
    });
  });

  it('allows CSS-variable arbitrary values', () => {
    ruleTester.run('no-arbitrary-tailwind', rule, {
      valid: [
        '<div className="w-[--sidebar-width] h-[--app-height]" />',
        "cn('bg-[--brand-color]')",
      ],
      invalid: [],
    });
  });
});
