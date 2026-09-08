import { createInstance } from 'i18next'

import en from './locales/en/translation.json'
import pl from './locales/pl/translation.json'

const resources = {
  en: { translation: en },
  pl: { translation: pl },
} as const

export type Locale = keyof typeof resources

function createI18n(locale: Locale) {
  const instance = createInstance()

  void instance.init({
    defaultNS: 'translation',
    fallbackLng: 'en',
    initAsync: false,
    interpolation: {
      escapeValue: false,
    },
    lng: locale,
    resources,
  })

  return instance
}

const instances: Record<Locale, ReturnType<typeof createI18n>> = {
  en: createI18n('en'),
  pl: createI18n('pl'),
}

export function getI18n(locale: Locale) {
  return instances[locale]
}
