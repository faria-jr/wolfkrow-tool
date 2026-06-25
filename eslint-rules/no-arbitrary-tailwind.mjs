/**
 * @fileoverview Disallow arbitrary Tailwind values (e.g. `text-[10px]`,
 *   `bg-[#fff]`, `max-w-[80%]`) — enforce the design-token scale instead.
 *
 * CSS-variable arbitrary values (`w-[--sidebar-width]`) are ALLOWED because
 * they reference a theme variable, not a hardcoded literal.
 *
 * Rationale: ADR-0005 / FE-2 — tokens are the single source of truth for
 * color, spacing and typography. Hardcoded arbitrary values drift from the
 * design system and break dark mode / theme overrides.
 */

/** Tailwind utilities that legitimately take arbitrary values we want to ban. */
const PREFIXES = [
  'text', 'bg', 'border', 'ring', 'fill', 'stroke',
  'min-w', 'max-w', 'min-h', 'max-h', 'w', 'h',
  'px', 'py', 'pt', 'pb', 'pl', 'pr', 'mt', 'mb', 'ml', 'mr', 'mx', 'my', 'm', 'p',
  'gap', 'inset', 'top', 'right', 'bottom', 'left', 'z', 'rounded',
];

const alternation = PREFIXES.join('|');
// Match `<prefix>-[<value>]` where value does NOT start with '-' (CSS-var refs).
const ARBITRARY_RE = new RegExp(`\\b(?:${alternation})-\\[(?!-)[^\\]]*\\]`, 'g');

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow arbitrary Tailwind values — use design tokens (allows [--css-var]).',
    },
    schema: [],
    messages: {
      noArbitrary:
        'Arbitrary Tailwind value "{{ token }}" — use a design token from the scale instead. CSS-var refs like w-[--sidebar-width] are allowed.',
    },
  },
  create(context) {
    /**
     * Report the first banned arbitrary value found in a string.
     * Scans every string literal and template element in the file; in
     * practice the only place these prefixes appear is in className strings.
     */
    function check(raw, node) {
      if (typeof raw !== 'string') return;
      ARBITRARY_RE.lastIndex = 0;
      const match = ARBITRARY_RE.exec(raw);
      if (match) {
        context.report({ node, messageId: 'noArbitrary', data: { token: match[0] } });
      }
    }

    return {
      Literal(node) {
        check(node.value, node);
      },
      TemplateElement(node) {
        check(node.value.raw, node);
      },
    };
  },
};
