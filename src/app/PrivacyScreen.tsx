import { useEffect } from 'react'
import { I18nextProvider } from 'react-i18next'
import { Link } from 'react-router-dom'
import { brand } from '../config/brand'
import { getI18n, type Locale } from '../i18n/i18n'
import type { TuningSession } from '../tuning/TuningSession'
import { RouteMetadata } from './RouteMetadata'
import styles from './PrivacyScreen.module.css'

export function PrivacyScreen({
  locale,
  session,
}: {
  locale: Locale
  session: TuningSession
}) {
  const i18n = getI18n(locale)
  useEffect(() => {
    void session.dispatch({ type: 'stop' })
  }, [session])
  return (
    <I18nextProvider i18n={i18n}>
      <RouteMetadata locale={locale} privacy />
      <div className={styles.page}>
        <header>
          <Link to={locale === 'pl' ? '/pl' : '/'}>{brand.name}</Link>
          <nav aria-label={i18n.t('navigation.language')}>
            <Link
              lang="en"
              aria-current={locale === 'en' ? 'page' : undefined}
              to="/privacy"
            >
              EN
            </Link>
            <Link
              lang="pl"
              aria-current={locale === 'pl' ? 'page' : undefined}
              to="/pl/prywatnosc"
            >
              PL
            </Link>
          </nav>
        </header>
        <main>
          <h1>{i18n.t('privacy.title')}</h1>
          <h2>{i18n.t('privacy.audioHeading')}</h2>
          <p>{i18n.t('privacy.audio')}</p>
          <h2>{i18n.t('privacy.dataHeading')}</h2>
          <p>{i18n.t('privacy.data')}</p>
          <h2>{i18n.t('privacy.hostingHeading')}</h2>
          <p>{i18n.t('privacy.hosting')}</p>
          <Link to={locale === 'pl' ? '/pl' : '/'}>
            {i18n.t('privacy.back')}
          </Link>
        </main>
      </div>
    </I18nextProvider>
  )
}
