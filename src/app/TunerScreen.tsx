import { useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { brand } from '../config/brand'
import type { Locale } from '../i18n/i18n'
import type { TuningSession } from '../tuning/TuningSession'
import styles from './TunerScreen.module.css'

const meterTicks = Array.from({ length: 21 }, (_, index) => index)

function BrandMark() {
  return (
    <svg aria-hidden="true" className={styles.brandMark} viewBox="0 0 44 44">
      <path d="M8 11.5h28M8 18.5h28M8 25.5h28M8 32.5h28" />
      <circle cx="15" cy="11.5" r="3.5" />
      <circle cx="29" cy="25.5" r="3.5" />
    </svg>
  )
}

export function TunerScreen({
  locale,
  session,
}: {
  locale: Locale
  session: TuningSession
}) {
  const { t } = useTranslation()
  const snapshot = useSyncExternalStore(session.subscribe, session.getSnapshot)
  const isPlaying = snapshot.referenceToneStatus === 'playing'

  function selectString(stringId: string) {
    void session.dispatch({ type: 'select-string', stringId })
  }

  function toggleReferenceTone() {
    void session.dispatch({
      type: isPlaying ? 'stop' : 'play-reference-tone',
    })
  }

  return (
    <div className={styles.shell}>
      <div aria-hidden="true" className={styles.glow} />

      <header className={styles.header}>
        <Link className={styles.brand} to={locale === 'pl' ? '/pl' : '/'}>
          <BrandMark />
          <span className={styles.brandCopy}>
            <span className={styles.brandName}>{brand.name}</span>
            <span className={styles.brandTagline}>{t('brand.tagline')}</span>
          </span>
        </Link>

        <nav
          aria-label={t('navigation.language')}
          className={styles.languageSwitch}
        >
          <Link
            aria-current={locale === 'en' ? 'page' : undefined}
            className={styles.languageLink}
            to="/"
          >
            EN
          </Link>
          <Link
            aria-current={locale === 'pl' ? 'page' : undefined}
            className={styles.languageLink}
            to="/pl"
          >
            PL
          </Link>
        </nav>
      </header>

      <main className={styles.main}>
        <section className={styles.intro}>
          <p className={styles.eyebrow}>{t('tuner.eyebrow')}</p>
          <h1>{brand.name}</h1>
          <p className={styles.lede}>{t('tuner.intro')}</p>
        </section>

        <section className={styles.tunerCard} aria-labelledby="tuner-heading">
          <div className={styles.cardHeader}>
            <div>
              <p className={styles.modeLabel}>
                {t('tuner.selection.method.referenceTone')}
              </p>
              <h2 id="tuner-heading">{t('tuner.heading')}</h2>
            </div>
            <div className={styles.referencePitch}>
              <span>{t('tuner.reference')}</span>
              <strong>{t('tuner.frequency')}</strong>
            </div>
          </div>

          <dl className={styles.selectionGrid}>
            <div>
              <dt>{t('tuner.selection.instrument.label')}</dt>
              <dd>{t('tuner.selection.instrument.guitar')}</dd>
            </div>
            <div>
              <dt>{t('tuner.selection.preset.label')}</dt>
              <dd>{t('tuner.selection.preset.standard')}</dd>
            </div>
            <div>
              <dt>{t('tuner.selection.method.label')}</dt>
              <dd>{t('tuner.selection.method.referenceTone')}</dd>
            </div>
            <div>
              <dt>{t('tuner.selection.mode.label')}</dt>
              <dd>{t('tuner.selection.mode.guided')}</dd>
            </div>
          </dl>

          <div className={styles.meter} aria-hidden="true">
            <div className={styles.meterArc} />
            <div className={styles.tickRow}>
              {meterTicks.map((tick) => (
                <span
                  className={tick === 10 ? styles.centerTick : styles.tick}
                  key={tick}
                />
              ))}
            </div>
            <div
              className={`${styles.needle} ${isPlaying ? styles.needlePlaying : ''}`}
            />
            <div
              className={`${styles.pitchPlaceholder} ${isPlaying ? styles.pitchPlaying : ''}`}
            >
              {snapshot.selectedString.noteName}
            </div>
          </div>

          <div
            aria-atomic="true"
            className={styles.status}
            role={snapshot.referenceToneError ? 'alert' : 'status'}
          >
            <p
              className={`${styles.waiting} ${snapshot.referenceToneError ? styles.error : ''}`}
            >
              {snapshot.referenceToneError
                ? t('tuner.status.error')
                : isPlaying
                  ? t('tuner.status.playing', {
                      noteName: snapshot.selectedString.noteName,
                    })
                  : t('tuner.status.ready')}
            </p>
            <p className={styles.instruction}>
              {snapshot.selectedString.frequencyHz.toFixed(2)} Hz
            </p>
          </div>

          <div
            className={styles.stringRow}
            aria-label={t('tuner.selection.string.label')}
            role="group"
          >
            {snapshot.strings.map((string) => (
              <button
                aria-label={string.noteName}
                aria-pressed={string.id === snapshot.selectedString.id}
                className={styles.stringChip}
                key={string.id}
                onClick={() => selectString(string.id)}
                type="button"
              >
                {string.noteName}
              </button>
            ))}
          </div>

          <button
            className={styles.toneButton}
            onClick={toggleReferenceTone}
            type="button"
          >
            <span className={styles.toneButtonIcon} aria-hidden="true">
              {isPlaying ? '■' : '▶'}
            </span>
            {isPlaying
              ? t('tuner.action.stop', {
                  noteName: snapshot.selectedString.noteName,
                })
              : t('tuner.action.play', {
                  noteName: snapshot.selectedString.noteName,
                })}
          </button>

          <div className={styles.cardFooter}>
            <span className={styles.statusDot} />
            {t('tuner.standardGuitar')}
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M12 3 5 6v5c0 4.7 2.8 8.2 7 10 4.2-1.8 7-5.3 7-10V6l-7-3Z" />
          <path d="m9.4 12 1.7 1.7 3.7-4" />
        </svg>
        <p>{t('tuner.privacy')}</p>
      </footer>
    </div>
  )
}
