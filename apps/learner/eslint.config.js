// Lint for the capture app (D46). Expo's config carries the React, hooks and import
// rules and knows how Expo resolves modules; eslint-config-prettier comes last and
// switches off every stylistic rule, so formatting is Prettier's alone.
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier/flat');

module.exports = defineConfig([
  expoConfig,
  prettierConfig,
  {
    // Build output and Expo's generated native projects, all gitignored.
    ignores: ['dist/*', 'ios/*', 'android/*', '.expo/*'],
  },
  {
    rules: {
      // The rule exists for HTML, where a stray ' or > in JSX text is usually a
      // markup typo. In React Native it is UI copy, and "can&apos;t" would make the
      // copy — which carries the voice constraint — harder to read and edit. Keep
      // the two characters that do signal a mistake.
      'react/no-unescaped-entities': ['error', { forbid: ['>', '}'] }],
    },
  },
]);
