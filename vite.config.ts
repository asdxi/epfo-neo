import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  css: {
    transformer: 'postcss',
  },
  plugins: [
    {
      name: 'epfo-remove-embedded-ux4g-fonts',
      enforce: 'pre',
      transform(code, id) {
        if (!id.includes('ux4g-web-components') || !id.endsWith('.css')) return null
        return code.replace(/@font-face\{[^}]*\}/g, '')
      },
    },
    react(),
  ],
  test: { environment: 'jsdom' },
  server: { port: 3000, host: true },
})
