import { useEffect } from 'react'
import { I18nextProvider } from 'react-i18next'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { brand } from '../config/brand'
import { getI18n, type Locale } from '../i18n/i18n'
import { TunerScreen } from './TunerScreen'

function LocalizedTunerScreen({ locale }: { locale: Locale }) {
  const i18n = getI18n(locale)

  useEffect(() => {
    document.documentElement.lang = locale
    document.title = `${brand.name} | ${i18n.t('meta.title')}`

    let description = document.querySelector<HTMLMetaElement>(
      'meta[name="description"]',
    )

    if (!description) {
      description = document.createElement('meta')
      description.name = 'description'
      document.head.append(description)
    }

    description.content = i18n.t('meta.description')
  }, [i18n, locale])

  return (
    <I18nextProvider i18n={i18n}>
      <TunerScreen locale={locale} />
    </I18nextProvider>
  )
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LocalizedTunerScreen locale="en" />} />
        <Route path="/pl" element={<LocalizedTunerScreen locale="pl" />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
