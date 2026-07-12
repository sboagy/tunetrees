# Player Transport Controls

## Purpose

This specification defines the shared transport controls for the Audio Player
and Rhythm Player, including programmable keyboard-emulating foot pedals.

## Initial control scheme

| Action | Keyboard / pedal mapping | Result |
| --- | --- | --- |
| Play / Pause | `,` | Starts playback, pauses active playback, or resumes paused playback. |
| Play with restart | `.` | Stops any active or paused playback, then starts again from the selected start position. |
| Stop and rewind | `/` | Stops playback and rewinds; the next start uses the selected start position. |

These controls are local to each mounted player. If both players are open, the
same pedal command reaches both; synchronized countdown timing is deliberately
outside this initial transport scope.

## Keyboard safety

- Do not handle a shortcut while focus is in a text-entry control (`input`
  types that accept text, `textarea`, or `contenteditable`). Checkboxes,
  selects, sliders, and buttons continue to receive player shortcuts.
- Ignore auto-repeat presses so a held pedal cannot repeatedly toggle
  transport.
- `Escape` keeps its dialog-dismissal behavior. Closing a player also stops
  its playback.

## Countdown scope

The Rhythm Player currently performs a one-bar audible count-in before a
fresh start; the Audio Player currently has no countdown. The transport
contract deliberately preserves those feature-specific behaviors. A future
countdown design must define duration, visual treatment, audio cues, and how
two simultaneously-open players synchronize before changing either player.
