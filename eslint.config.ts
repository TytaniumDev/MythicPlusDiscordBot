import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
// @ts-expect-error no types
import reactHooks from 'eslint-plugin-react-hooks';

/**
 * Custom rule: require at least one executable statement in every catch body.
 *
 * Built-in `no-empty` doesn't help here because it ignores blocks containing
 * comments — meaning `catch { // silently fail }` passes. The Apr 2026 Wheelson
 * outage lasted 6 days precisely because a `catch {}` swallowed a FirebaseError
 * and nothing surfaced it. From now on, every catch must either log, rethrow,
 * or explicitly call `void 0` with an `// intentional: reason` comment.
 */
const noSilentCatch = {
  meta: {
    type: 'problem' as const,
    docs: { description: 'Require at least one statement in every catch body' },
    schema: [],
    messages: {
      empty:
        'Catch block body is empty. Log the error (console.error / logger.error / Sentry.captureException) or rethrow. For intentional swallows, add an explicit statement like `void 0` with an `// intentional: <reason>` comment.',
    },
  },
  create(context: { report: (d: { node: unknown; messageId: string }) => void }) {
    return {
      CatchClause(node: { body: { body: unknown[] } }) {
        if (node.body.body.length === 0) {
          context.report({ node: node.body, messageId: 'empty' });
        }
      },
    };
  },
};

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.strict,
  {
    ignores: [
      '**/dist/',
      '**/node_modules/',
      'activity/.storybook/',
      'activity/**/*.stories.tsx',
      'activity/tests/',
      'activity/**/*.config.ts',
      'activity/**/*.config.js',
      'activity/tests-integration/',
    ],
  },
  {
    plugins: {
      wheelson: { rules: { 'no-silent-catch': noSilentCatch } },
    },
    rules: {
      'wheelson/no-silent-catch': 'error',
    },
  },
  {
    files: ['packages/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-non-null-assertion': 'error',
    },
  },
  {
    files: ['packages/**/tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
  {
    files: ['activity/src/public/sw.js'],
    languageOptions: {
      globals: {
        self: 'readonly',
        caches: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
      },
    },
  },
  {
    files: ['activity/src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // Existing activity code relies on some non-null assertions; fixing them
      // is out of scope for the silent-failure prevention pass.
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
);
