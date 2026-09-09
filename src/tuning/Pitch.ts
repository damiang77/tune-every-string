export interface TargetPitch {
  readonly frequencyHz: number
  readonly midiNoteNumber: number
  readonly noteName: string
}

export function frequencyFromMidiNote(
  midiNoteNumber: number,
  concertPitchHz: number,
) {
  return concertPitchHz * 2 ** ((midiNoteNumber - 69) / 12)
}

export function createTargetPitch(
  midiNoteNumber: number,
  noteName: string,
  concertPitchHz: number,
): TargetPitch {
  return Object.freeze({
    frequencyHz: frequencyFromMidiNote(midiNoteNumber, concertPitchHz),
    midiNoteNumber,
    noteName,
  })
}
