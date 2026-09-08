# Tune Every String

Tune Every String helps players bring string instruments to their intended pitches, either by measuring a played string or by providing a reference tone to match by ear.

## Language

**Tuner Screen**:
The single workspace in which a player selects how to tune and receives tuning guidance.
_Avoid_: Dashboard, control panel

**Tuning Session**:
The period from starting a Tuning Method until the player stops it or it ends because of inactivity or failure.
_Avoid_: Audio session, tuner instance

**Instrument**:
A supported string-instrument configuration, initially a six-string guitar or four-string bass.
_Avoid_: Instrument type, instrument profile

**String**:
One of the ordered playable strings belonging to an Instrument.
_Avoid_: Course

**Tuning Preset**:
A named assignment of one Target Pitch to every String of a particular Instrument.
_Avoid_: Tuning configuration, instrument tuning

**Target Pitch**:
The pitch a String should reach under the selected Tuning Preset, or the pitch selected for a Reference Tone.
_Avoid_: Correct pitch, expected frequency

**Note Name**:
The letter, accidental, and octave used to identify a pitch. Tuning Presets retain their conventional spelling, while Chromatic Mode follows the player's sharps-or-flats preference.
_Avoid_: Pitch name, note label

**Detected Pitch**:
The pitch measured from the single String currently being played.
_Avoid_: Input note, captured note

**Tuning Method**:
The way a player tunes a Target Pitch: **Listen** measures a played String, while **Reference Tone** provides a pitch to match by ear.
_Avoid_: Input mode, audio mode

**Tuning Mode**:
The scope used to interpret a Detected Pitch: Guided Mode uses a selected Instrument and Tuning Preset, while Chromatic Mode does not.
_Avoid_: Detection type, tuner type

**Concert Pitch**:
The adjustable A4 reference from which Target Pitches are derived in twelve-tone equal temperament, ranging from 430 to 450 Hz and defaulting to 440 Hz.
_Avoid_: Master tuning, global frequency

**Pitch Feedback**:
The current interpretation of the playable signal: No Signal, Acquiring, Too Low, In Tune, or Too High.
_Avoid_: Detection status, tuner result

**Guided Mode**:
A Tuning Mode that interprets a Detected Pitch using the Strings and Tuning Preset of the selected Instrument.
_Avoid_: Instrument mode, preset mode

**String Lock**:
An optional Guided Mode state that interprets the Detected Pitch only against a player-selected String.
_Avoid_: Manual mode, forced string

**Chromatic Mode**:
A Tuning Mode that interprets a Detected Pitch independently of any Instrument or Tuning Preset.
_Avoid_: Free mode

**Reference Tone**:
An audible Target Pitch that a player can match by ear.
_Avoid_: Sample note, test tone

**In Tune**:
The state in which a stable Detected Pitch is no more than five cents above or below its Target Pitch.
_Avoid_: Correct, perfect
