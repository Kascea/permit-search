import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vite'
import viteReact from '@vitejs/plugin-react'

const root = fileURLToPath(new URL('.', import.meta.url))

// Two builds into extension/dist, as Chrome loads them: the side panel and the
// service worker as ES modules, then (with --mode content) the reader and
// filler as one classic script, since it's injected into portal pages and
// can't import chunks.
export default defineConfig(({ mode }) => ({
  root,
  resolve: { tsconfigPaths: true },
  plugins: [viteReact()],
  build:
    mode === 'content'
      ? {
          outDir: 'dist',
          emptyOutDir: false,
          copyPublicDir: false,
          lib: {
            entry: 'src/content.ts',
            formats: ['iife'],
            name: 'permitSearchContent',
            fileName: () => 'content.js',
          },
        }
      : {
          outDir: 'dist',
          emptyOutDir: true,
          rolldownOptions: {
            input: {
              panel: `${root}/panel.html`,
              background: `${root}/src/background.ts`,
            },
            output: { entryFileNames: '[name].js' },
          },
        },
}))
