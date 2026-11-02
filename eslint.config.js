//  @ts-check

import { tanstackConfig } from '@tanstack/eslint-config'
import oxlint from 'eslint-plugin-oxlint'

export default [
  ...tanstackConfig,
  {
    rules: {
      'import/no-cycle': 'off',
      'import/order': 'off',
      'sort-imports': 'off',
      '@typescript-eslint/array-type': 'off',
      '@typescript-eslint/require-await': 'off',
      'pnpm/json-enforce-catalog': 'off',
    },
  },
  // Disable ESLint rules that oxlint already covers (keep this last among rule configs)
  ...oxlint.buildFromOxlintConfigFile('./.oxlintrc.json'),
  {
    ignores: ['.cloudflare/**', 'eslint.config.js', 'prettier.config.js'],
  },
]
