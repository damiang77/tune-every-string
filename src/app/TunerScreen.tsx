import { useState, useSyncExternalStore, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { brand } from '../config/brand'
import type { Locale } from '../i18n/i18n'
import type {
  ChromaticOctave,
  ChromaticPitchClass,
} from '../tuning/ChromaticPitch'
import type { TuningMethod, TuningSession } from '../tuning/TuningSession'
import styles from './TunerScreen.module.css'

const meterTicks = Array.from({ length: 21 }, (_, index) => index)

function SettingsIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M4.9 4.9 7 7M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1" />
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
  const [settingsOpen, setSettingsOpen] = useState(false)
  const snapshot = useSyncExternalStore(session.subscribe, session.getSnapshot)
  const isPlaying = snapshot.referenceToneStatus === 'playing'
  const isListen = snapshot.tuningMethod === 'listen'
  const isListening = snapshot.lifecycleStatus === 'listening'
  const detectedCents = snapshot.detectedPitch?.centsDeviation ?? 0
  const boundedCents = Math.max(-50, Math.min(50, detectedCents))
  const meterStyle = {
    '--pitch-position': `${boundedCents + 50}%`,
  } as CSSProperties

  const methodLabel = (method: TuningMethod) =>
    method === 'listen'
      ? t('tuner.selection.method.listen')
      : t('tuner.selection.method.referenceTone')

  const pitchFeedbackLabel = () => {
    if (snapshot.pitchFeedback === 'no-signal')
      return t('tuner.status.noSignal')
    if (snapshot.pitchFeedback === 'acquiring')
      return t('tuner.status.acquiring')
    if (snapshot.pitchFeedback === 'too-low') return t('tuner.status.tooLow')
    if (snapshot.pitchFeedback === 'too-high') return t('tuner.status.tooHigh')
    return t('tuner.status.inTune')
  }

  const statusMessage = snapshot.microphoneError
    ? t(`tuner.status.microphone.${snapshot.microphoneError}`)
    : isListen && snapshot.lifecycleStatus === 'starting'
      ? t('tuner.status.starting')
      : isListening
        ? snapshot.detectedPitch
          ? t('tuner.status.detectedPitch', {
              cents: Math.abs(snapshot.detectedPitch.centsDeviation).toFixed(1),
              frequency: snapshot.detectedPitch.frequencyHz.toFixed(2),
              result: pitchFeedbackLabel(),
            })
          : t('tuner.status.listening')
        : snapshot.referenceToneError
          ? t('tuner.status.error')
          : isPlaying
            ? t('tuner.status.playing', {
                noteName: snapshot.targetPitch.noteName,
              })
            : isListen
              ? t('tuner.status.listenReady')
              : snapshot.tuningMode === 'guided'
                ? t('tuner.status.ready')
                : t('tuner.status.readyChromatic')

  const displayedFrequency = snapshot.detectedPitch?.frequencyHz
    ? `${snapshot.detectedPitch.frequencyHz.toFixed(2)} Hz`
    : `${snapshot.targetPitch.frequencyHz.toFixed(2)} Hz`

  function selectString(stringId: string) {
    void session.dispatch({ type: 'select-string', stringId })
  }

  function selectTuningMethod(tuningMethod: TuningMethod) {
    void session.dispatch({ type: 'select-tuning-method', tuningMethod })
  }

  function togglePrimaryAction() {
    if (isListen) {
      void session.dispatch({
        type: isListening ? 'stop' : 'start-listening',
      })
      return
    }

    void session.dispatch({
      type: isPlaying ? 'stop' : 'play-reference-tone',
    })
  }

  function setConcertPitch(concertPitchHz: number) {
    if (
      Number.isFinite(concertPitchHz) &&
      concertPitchHz >= 430 &&
      concertPitchHz <= 450
    ) {
      void session.dispatch({ type: 'set-concert-pitch', concertPitchHz })
    }
  }

  const primaryActionLabel = isListen
    ? isListening
      ? t('tuner.action.stopListening')
      : t('tuner.action.start')
    : isPlaying
      ? t('tuner.action.stop', { noteName: snapshot.targetPitch.noteName })
      : t('tuner.action.play', { noteName: snapshot.targetPitch.noteName })

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <Link className={styles.brand} to={locale === 'pl' ? '/pl' : '/'}>
          <span aria-hidden="true" className={styles.brandMark}>
            <i />
            <i />
            <i />
          </span>
          <h1>{brand.name}</h1>
        </Link>

        <div className={styles.headerActions}>
          <nav aria-label={t('navigation.language')}>
            <Link aria-current={locale === 'en' ? 'page' : undefined} to="/">
              EN
            </Link>
            <Link aria-current={locale === 'pl' ? 'page' : undefined} to="/pl">
              PL
            </Link>
          </nav>
          <button
            aria-expanded={settingsOpen}
            className={styles.settingsButton}
            onClick={() => setSettingsOpen((open) => !open)}
            type="button"
          >
            <SettingsIcon />
            <span>{t('tuner.settings.open')}</span>
          </button>
        </div>
      </header>

      <main className={styles.main}>
        <div aria-hidden="true" className={styles.stageDecor}>
          <span className={styles.cable} />
          <span className={styles.case} />
          <span className={styles.patchPanel}>
            <i />
            <i />
            <i />
            <i />
          </span>
          <span className={styles.notePaper} />
          <span className={styles.backstagePass} />
          <span className={styles.pedal}>
            <i />
            <i />
            <i />
          </span>
          <span className={styles.pick} />
        </div>

        <section className={styles.setlist} aria-labelledby="tuner-heading">
          <span aria-hidden="true" className={styles.tapeLeft} />
          <span aria-hidden="true" className={styles.tapeRight} />
          <span aria-hidden="true" className={styles.clip} />

          <h2 className={styles.srOnly} id="tuner-heading">
            {t('tuner.heading')}
          </h2>
          <p className={styles.preset}>{t('tuner.standardGuitar')}</p>

          {snapshot.tuningMode === 'guided' ? (
            <div
              aria-label={t('tuner.selection.string.label')}
              className={styles.stringRow}
              role="group"
            >
              {snapshot.strings.map((string, index) => (
                <button
                  aria-label={string.noteName}
                  aria-pressed={string.id === snapshot.selectedString.id}
                  key={string.id}
                  onClick={() => selectString(string.id)}
                  style={
                    {
                      '--string-gauge': `${Math.max(1, 3 - index * 0.4)}px`,
                    } as CSSProperties
                  }
                  type="button"
                >
                  <span>{string.noteName.replace(/\d/g, '')}</span>
                  <i />
                </button>
              ))}
            </div>
          ) : (
            <p className={styles.chromaticLabel}>
              {t('tuner.chromatic.footer')}
            </p>
          )}

          <div className={styles.readout}>
            <div className={styles.noteBlock}>
              <strong data-target-note>{snapshot.targetPitch.noteName}</strong>
              <span>{displayedFrequency}</span>
            </div>
            <span
              aria-hidden="true"
              className={`${styles.cueLamp} ${
                snapshot.pitchFeedback === 'in-tune'
                  ? styles.cueLampInTune
                  : isPlaying
                    ? styles.cueLampPlaying
                    : ''
              }`}
            />
          </div>

          <div
            className={`${styles.meter} ${snapshot.pitchFeedback === 'in-tune' ? styles.meterInTune : ''}`}
            style={meterStyle}
          >
            <div aria-hidden="true" className={styles.tickRow}>
              {meterTicks.map((tick) => (
                <span
                  className={tick === 10 ? styles.centerTick : ''}
                  key={tick}
                />
              ))}
              <i className={styles.pitchMarker} />
            </div>
            <div className={styles.meterLabels}>
              <span>{t('tuner.status.tooLow')}</span>
              <strong>{pitchFeedbackLabel()}</strong>
              <span>{t('tuner.status.tooHigh')}</span>
            </div>
          </div>

          <div
            aria-atomic="true"
            className={styles.status}
            role={
              snapshot.referenceToneError || snapshot.microphoneError
                ? 'alert'
                : 'status'
            }
          >
            <p>{statusMessage}</p>
          </div>

          <button
            className={styles.primaryAction}
            disabled={snapshot.lifecycleStatus === 'starting'}
            onClick={togglePrimaryAction}
            type="button"
          >
            <span>{primaryActionLabel}</span>
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path d="M5 12h14M14 7l5 5-5 5" />
            </svg>
          </button>

          <button
            className={styles.methodShortcut}
            onClick={() =>
              selectTuningMethod(isListen ? 'reference-tone' : 'listen')
            }
            type="button"
          >
            {isListen
              ? t('tuner.action.useReferenceTone')
              : t('tuner.selection.method.listen')}
          </button>

          <p className={styles.privacy}>{t('tuner.privacy')}</p>
        </section>

        {settingsOpen ? (
          <aside
            className={styles.settings}
            aria-label={t('tuner.settings.open')}
          >
            <div className={styles.settingsHeader}>
              <h2>{t('tuner.settings.open')}</h2>
              <button
                aria-label={t('tuner.settings.close')}
                onClick={() => setSettingsOpen(false)}
                type="button"
              >
                <svg aria-hidden="true" viewBox="0 0 24 24">
                  <path d="m6 6 12 12M18 6 6 18" />
                </svg>
              </button>
            </div>

            <div className={styles.settingGroup}>
              <span>{t('tuner.selection.mode.label')}</span>
              <div className={styles.segmented}>
                {(['guided', 'chromatic'] as const).map((tuningMode) => (
                  <button
                    aria-pressed={snapshot.tuningMode === tuningMode}
                    key={tuningMode}
                    onClick={() =>
                      void session.dispatch({
                        type: 'select-tuning-mode',
                        tuningMode,
                      })
                    }
                    type="button"
                  >
                    {t(`tuner.selection.mode.${tuningMode}`)}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.settingGroup}>
              <span>{t('tuner.selection.method.label')}</span>
              <div className={styles.segmented}>
                {(['listen', 'reference-tone'] as const).map((method) => (
                  <button
                    aria-pressed={snapshot.tuningMethod === method}
                    key={method}
                    onClick={() => selectTuningMethod(method)}
                    type="button"
                  >
                    {methodLabel(method)}
                  </button>
                ))}
              </div>
            </div>

            <label className={styles.numberSetting}>
              <span>{t('tuner.concertPitch')}</span>
              <span>
                <input
                  aria-label={t('tuner.concertPitch')}
                  defaultValue={snapshot.concertPitchHz}
                  key={snapshot.concertPitchHz}
                  max="450"
                  min="430"
                  onBlur={(event) => {
                    const concertPitchHz = event.currentTarget.valueAsNumber
                    if (
                      !Number.isFinite(concertPitchHz) ||
                      concertPitchHz < 430 ||
                      concertPitchHz > 450
                    ) {
                      event.currentTarget.value = String(
                        snapshot.concertPitchHz,
                      )
                    }
                  }}
                  onChange={(event) =>
                    setConcertPitch(event.currentTarget.valueAsNumber)
                  }
                  type="number"
                />
                Hz
              </span>
            </label>

            {snapshot.tuningMode === 'chromatic' ? (
              <div className={styles.chromaticSettings}>
                <label>
                  <span>{t('tuner.chromatic.note')}</span>
                  <select
                    aria-label={t('tuner.chromatic.note')}
                    onChange={(event) =>
                      void session.dispatch({
                        type: 'select-chromatic-note',
                        pitchClass: Number(
                          event.currentTarget.value,
                        ) as ChromaticPitchClass,
                      })
                    }
                    value={snapshot.chromaticSelection.pitchClass}
                  >
                    {snapshot.chromaticNoteOptions.map((option) => (
                      <option key={option.pitchClass} value={option.pitchClass}>
                        {option.noteName}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>{t('tuner.chromatic.octave')}</span>
                  <select
                    aria-label={t('tuner.chromatic.octave')}
                    onChange={(event) =>
                      void session.dispatch({
                        type: 'select-chromatic-octave',
                        octave: Number(
                          event.currentTarget.value,
                        ) as ChromaticOctave,
                      })
                    }
                    value={snapshot.chromaticSelection.octave}
                  >
                    {snapshot.chromaticOctaveOptions.map((octave) => (
                      <option key={octave} value={octave}>
                        {octave}
                      </option>
                    ))}
                  </select>
                </label>
                <div
                  aria-label={t('tuner.chromatic.accidentalPreference')}
                  className={styles.segmented}
                  role="group"
                >
                  {(['sharps', 'flats'] as const).map((preference) => (
                    <button
                      aria-pressed={
                        snapshot.accidentalPreference === preference
                      }
                      key={preference}
                      onClick={() =>
                        void session.dispatch({
                          type: 'set-accidental-preference',
                          accidentalPreference: preference,
                        })
                      }
                      type="button"
                    >
                      {t(`tuner.chromatic.${preference}`)}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </aside>
        ) : null}
      </main>
    </div>
  )
}
