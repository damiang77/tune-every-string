import { useEffect, useState } from 'react'
import { I18nextProvider } from 'react-i18next'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { brand } from '../config/brand'
import { getI18n, type Locale } from '../i18n/i18n'
import {
  createTuningSession,
  type TuningSession,
} from '../tuning/TuningSession'
import { createWebAudioReferenceTone } from '../tuning/WebAudioReferenceTone'
import { createBrowserTuningPreferenceStore } from '../tuning/TuningPreferences'
import { TunerScreen } from './TunerScreen'

function LocalizedTunerScreen({
  locale,
  session,
}: {
  locale: Locale
  session: TuningSession
}) {
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
      <TunerScreen locale={locale} session={session} />
    </I18nextProvider>
  )
}

export function App({ session: providedSession }: { session?: TuningSession }) {
  const [session] = useState(
    () =>
      providedSession ??
      createTuningSession({
        preferenceStore: createBrowserTuningPreferenceStore(),
        referenceToneOutput: createWebAudioReferenceTone(),
      }),
  )

  useEffect(
    () => () => {
      void session.dispatch({ type: 'stop' })
    },
    [session],
  )

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={<LocalizedTunerScreen locale="en" session={session} />}
        />
        <Route
          path="/pl"
          element={<LocalizedTunerScreen locale="pl" session={session} />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
