# TuneTrees: Core Ontology & Nomenclature

**Purpose:** This document defines the core domain terminology and data architecture for TuneTrees. It serves as the single source of truth for UI labels, database schema design, and codebase variable naming.

## 1. Musical Entities
These are the fundamental building blocks of the music managed within the app.

* **Tune:** The base musical unit (e.g., a single jig, reel, or polka).
* **Tune Set ("Set"):** A curated sequence of **Tunes**, typically played continuously without stopping (usually 2-4 tunes).
* **Catalog:** The global, master database of all available **Tunes**.

## 2. User & Social Entities
How people and organizations are structured.

* **User:** An individual musician.
    * Can belong to multiple **Groups**.
    * Maintains a personal **Repertoire**.
* **Group:** A collective of **Users** (e.g., a band, a session crew, or a class).
    * Can own and collaborate on **Setlists** and **Tune Sets**.
* **Repertoire:** A User's personal collection of music. 
    * Populated by adding items from the **Catalog**.

## 3. Performance & Planning Entities
How music is organized for real-world, live playing.

* **Setlist:** An ordered list of individual **Tunes** and/or **Tune Sets** intended for a performance or session.
    * *Ownership:* A Setlist can be owned by an individual **User** (for solo gigs) OR owned by a **Group** (shared among members).
    * *Data Sourcing:* Populated from the global **Catalog**, augmented by custom **Tune Sets** that are tagged with the owning Group's ID.
* **Event:** A specific, calendar-bound occurrence (e.g., "Saturday Pub Gig", "St. Patrick's Day Session").
    * Contains exact date and time data.
    * *Relationship:* A **Setlist** can be tagged with one or multiple **Events** (allowing the same sequence of music to be reused across different dates).

## 4. Practice & Scheduling Entities
How a User interacts with their Repertoire to achieve mastery over time.

* **Scheduling (The Algorithm):** The mathematical process, driven by the FSRS (Free Spaced Repetition Scheduler) algorithm, that calculates the optimal interval for reviewing a tune. 
    * Calculates metrics like *Stability*, *Difficulty*, and *Due Date* based on the User's historical performance.
* **Practice Queue (or "Practice List"):** A frozen, daily snapshot of tunes generated for a User to practice on a specific day.
    * Organized hierarchically into **Buckets** (e.g., Bucket 1: Due Today, Bucket 2: Lapsed, Bucket 3: New/Unscheduled).
    * Provides a stable UI state so the list does not unpredictably shift while the User is practicing.
* **Evaluation Staging:** The transient UI state where a User previews the algorithmic outcome of a rating ("Again", "Hard", "Good", "Easy") before permanently submitting it.
* **Practice Record:** An immutable, historical database entry logging a User's evaluation of a specific tune at an exact timestamp. 

## 5. Key Architectural Rules (The "Golden Rules")
* **Separation of List and Time:** A **Setlist** exists independently of an **Event**. The music and the calendar occurrence are strictly decoupled.
* **Solo vs. Group Parity:** A User does not need to create a dummy "Group of One" to create a Setlist. 
* **Immutability of Practice:** A **Practice Record** is a historical fact; it is never updated or deleted.
* **Sync Precedence:** In the offline-first architecture, local database changes (uploads) must always sync to the remote server *before* downloading new remote changes to prevent data overwrites or zombie records.
