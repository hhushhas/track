import { defineConfig, loadEnv } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'

const config = defineConfig(({ mode }) => {
  const env = loadEnv(mode, '../..', '')
  for (const [key, value] of Object.entries(env)) {
    process.env[key] ??= value
  }

  return {
    envDir: '../..',
    resolve: {
      dedupe: ['react', 'react-dom'],
      tsconfigPaths: true,
    },
    plugins: [
      devtools(),
      nitro({
        preset: 'cloudflare-module',
        rollupConfig: { external: [/^@sentry\//] },
      }),
      tailwindcss(),
      tanstackStart(),
      viteReact(),
    ],
  }
})

export default config
