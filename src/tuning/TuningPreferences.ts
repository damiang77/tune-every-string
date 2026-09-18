export type AccidentalPreference = 'sharps' | 'flats'

export interface TuningPreferenceStore {
  loadAccidentalPreference(): AccidentalPreference | undefined
  loadGuitarTuningPresetId?(): string | undefined
  loadTuningMode?(): 'guided' | 'chromatic' | undefined
  saveAccidentalPreference(preference: AccidentalPreference): void
  saveGuitarTuningPresetId?(presetId: string): void
  saveTuningMode?(tuningMode: 'guided' | 'chromatic'): void
}

const ACCIDENTAL_PREFERENCE_KEY = 'tune-every-string:accidental-preference:v1'
const GUITAR_TUNING_PRESET_KEY = 'tune-every-string:guitar-tuning-preset:v1'
const TUNING_MODE_KEY = 'tune-every-string:tuning-mode:v1'

export function createBrowserTuningPreferenceStore(
  storage: Storage = window.localStorage,
): TuningPreferenceStore {
  return {
    loadAccidentalPreference() {
      try {
        const storedPreference = storage.getItem(ACCIDENTAL_PREFERENCE_KEY)
        return storedPreference === 'sharps' || storedPreference === 'flats'
          ? storedPreference
          : undefined
      } catch {
        return undefined
      }
    },
    loadGuitarTuningPresetId() {
      try {
        return storage.getItem(GUITAR_TUNING_PRESET_KEY) ?? undefined
      } catch {
        return undefined
      }
    },
    loadTuningMode() {
      try {
        const tuningMode = storage.getItem(TUNING_MODE_KEY)
        return tuningMode === 'guided' || tuningMode === 'chromatic'
          ? tuningMode
          : undefined
      } catch {
        return undefined
      }
    },
    saveAccidentalPreference(preference) {
      try {
        storage.setItem(ACCIDENTAL_PREFERENCE_KEY, preference)
      } catch {
        // The Tuner Screen remains usable when private browsing or policy blocks storage.
      }
    },
    saveGuitarTuningPresetId(presetId) {
      try {
        storage.setItem(GUITAR_TUNING_PRESET_KEY, presetId)
      } catch {
        // The Tuner Screen remains usable when private browsing or policy blocks storage.
      }
    },
    saveTuningMode(tuningMode) {
      try {
        storage.setItem(TUNING_MODE_KEY, tuningMode)
      } catch {
        // The Tuner Screen remains usable when private browsing or policy blocks storage.
      }
    },
  }
}
