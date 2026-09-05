import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    env: {
      TZ: 'America/New_York',
      // The Supabase client is created at import time; these placeholders keep tests
      // independent of .env.local (CI has none). Every network call is mocked.
      VITE_SUPABASE_URL: 'https://placeholder.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'sb_publishable_placeholder',
    },
  },
})
