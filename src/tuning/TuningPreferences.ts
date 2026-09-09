export type AccidentalPreference = 'sharps' | 'flats'

export interface TuningPreferenceStore {
  loadAccidentalPreference(): AccidentalPreference | undefined
  saveAccidentalPreference(preference: AccidentalPreference): void
}

const ACCIDENTAL_PREFERENCE_KEY = 'tune-every-string:accidental-preference:v1'

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
    saveAccidentalPreference(preference) {
      try {
        storage.setItem(ACCIDENTAL_PREFERENCE_KEY, preference)
      } catch {
        // The Tuner remains usable when private browsing or policy blocks storage.
      }
    },
  }
}
