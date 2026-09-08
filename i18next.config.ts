import { defineConfig } from 'i18next-cli'

export default defineConfig({
  locales: ['en', 'pl'],
  extract: {
    input: ['src/**/*.{ts,tsx}'],
    output: 'src/i18n/locales/{{language}}/{{namespace}}.json',
  },
})
