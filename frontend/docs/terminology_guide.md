# TuneTrees Terminology Guide

This guide provides definitions for domain-specific terms used throughout the TuneTrees application. For spaced repetition terminology, see `sr_readme.md`.

## Core Music Terms

### Tune
A musical piece or composition, typically in the Irish traditional music repertoire. Each tune has metadata including title, type, structure, mode, and incipit.

### Incipit
The opening musical phrase of a tune, typically written in ABC notation, used for identification and quick reference.

### Mode
The musical key or scale of a tune (e.g., "D Major", "A Dorian", "G Mixolydian").

### Structure
The formal structure of a tune using letters to represent sections (e.g., "AABB", "AABBCC", "ABC").

### Type
The category or rhythm of a tune. Common types include:
- **Reel** - Fast 4/4 time dance tune
- **JigD** - Double jig in 6/8 time
- **Hpipe** - Hornpipe, typically in 4/4 with dotted rhythms
- **Slide** - Cork-style tune in 12/8 time
- **Waltz** - Triple meter dance tune
- **SgReel** - Single reel

### Genre
A classification system for grouping tunes by regional or stylistic characteristics (e.g., "Irish Traditional", "Scottish").

## Practice & Learning Terms

### Playlist
A collection of tunes associated with a specific instrument and user. Playlists organize tunes for practice sessions.

### Practice Session
A period of focused practice, often called a "sitdown" in the application.

### Sitdown
A practice session where a user works through tunes in their playlist.

### Sitdown Date
The date and time when a practice session begins, used for scheduling and tracking.

### Feedback
User's self-assessment of their performance on a tune during practice, used for spaced repetition scheduling.

### Recall Eval
Short for "recall evaluation" - the user's assessment of how well they remembered and performed a tune.

### Quality
A numeric assessment of practice performance, typically on a scale from 1-5.

### Easiness
A calculated factor representing how easy or difficult a tune is for a specific user to remember.

### Current
A flag indicating whether a tune is actively being practiced (marked as "T" for true).

### Learned
The date when a user first learned a tune.

### Practiced
The date when a user most recently practiced a tune.

## User Interface Terms

### Tune Editor
The form interface used for creating and editing tune metadata.

### Tune Override
User-specific customizations to a tune's metadata that don't affect the shared tune data.

### Review Mode
Different ways of practicing tunes:
- **Grid Mode** - Visual grid layout showing multiple tunes
- **Flashcard Mode** - Individual tune practice interface

### Scheduled Tunes
Tunes that are due for practice based on the spaced repetition algorithm.

### Repertoire
The complete collection of tunes a user has learned, regardless of practice schedule.

## Technical Terms

### Note Private
Personal notes about a tune visible only to the user who created them.

### Note Public
Notes about a tune that can be shared with other users.

### Tags
User-defined labels for organizing and categorizing tunes (e.g., "wnceili", "hp", "group4").

### Tune Reference (tune_ref)
The unique identifier linking a tune to playlist and practice records.

### User Reference (user_ref)
The unique identifier for a user in the system.

### Playlist Reference (playlist_ref)
The unique identifier for a playlist in the system.

### Table Transient Data
Temporary data stored during practice sessions before being committed to permanent records.

### External Reference
Links to external resources like YouTube videos, sheet music, or other tune databases.

## Data States

### Deleted
A soft-delete flag indicating that a tune, playlist, or other record has been removed but is retained in the database.

### Private
Content that is only visible to the user who created it.

### Public
Content that can be shared with other users.

### Backup Practiced
A fallback date used when the main practice date is unavailable.

### Has Override
A flag indicating whether a user has created custom metadata for a shared tune.

## Musical Metadata

### Instrument
The musical instrument associated with a playlist (e.g., "fiddle", "flute", "whistle").

### Rhythm
The underlying rhythmic pattern of a tune type.

### Region
The geographical or cultural origin of a tune or genre.

### ABC Notation
A text-based musical notation system used for storing tune incipits.

### Backup Practiced
A secondary practice date used for data integrity.

---

*This terminology guide is maintained alongside the codebase and should be updated when new domain terms are introduced.*
