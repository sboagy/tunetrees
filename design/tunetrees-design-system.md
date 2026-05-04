# TuneTrees UI Design System & Style Guide

This document serves as the single source of truth for the TuneTrees UI grammar, action vocabulary, and visual hierarchy. It ensures a consistent, predictable, and professional user experience across the entire application.

---

## 🛠️ 1. Core Dependencies

* **Icon Library:** All icons MUST be from `lucide-solid` **version 1.14.0 or greater**.
* **CSS Framework:** Tailwind CSS, utilizing a semantic token-based architecture (e.g., `bg-primary`, `text-muted-foreground`). Do not use hardcoded colors (e.g., `blue-500`) for structural UI elements.

---

## 🎨 2. Color Semantics (The Vocabulary)

*Rule: Colors must mean the same thing everywhere. Never use a semantic color for mere decoration.*

| Semantic Token | Visual Representation | Meaning & Use Case |
| :--- | :--- | :--- |
| **Primary** | Solid Bright Blue (`bg-primary`) | **Forward Progress.** Used ONLY for the primary conversion or completion action on a screen (e.g., "Sign In", "Submit Practice", "Save Tune"). |
| **Secondary / Muted** | Slate Gray (`bg-secondary`, `text-muted-foreground`) | **Neutral / Context.** Used for secondary actions, background panels, inactive tabs, and supporting text (like timestamps or UUIDs). |
| **Accent** | Green / Purple | **Success / Specialty.** Green is strictly for "Good/Easy" or successful states. Purple should be used sparingly, perhaps for premium/special features or profiles. |
| **Warning** | Orange / Yellow | **Attention Required.** Used for "Overdue" status, "Again/Hard" practice evaluations, and actions that require a system change (like "Rebuild Queue"). |
| **Destructive** | Red (`bg-destructive`) | **Permanent Loss.** Used strictly for deleting data (e.g., "Delete Tune", "Remove Override"). |

---

## 🎛️ 3. Button Hierarchy (The Verbs)

*Rule: A screen should almost never have more than ONE Primary button. If everything is loud, nothing is.*

| Button Variant | CSS Implementation | Strict Use Case |
| :--- | :--- | :--- |
| **1. Primary Action** | `variant="default"` (Solid Blue) | The single most important action on the screen. **Rule:** Place on the bottom-right of desktop forms, or full-width at the bottom of mobile forms. |
| **2. Secondary Action** | `variant="outline"` (Border, no fill) | Safe, alternative actions. E.g., "Cancel", "Add More", "Filter". **Rule:** Place to the left of Primary actions. |
| **3. Tertiary Action** | `variant="ghost"` (No border, gray hover) | Navigation, icon-only utility buttons (like the `⋮` menu), or very low-priority actions. |
| **4. The FSRS Array** | *Custom App-Specific Pattern* | The "Again/Hard/Good/Easy" buttons are a special case. They should remain visually distinct from standard app navigation to keep the user in a "flow state" during practice. |

---

## 📐 4. Layout & Forms (The Grammar)

*Rule: Predictability reduces cognitive load. Users shouldn't have to relearn how to use a form on a new page.*

| Component | UI Grammar Rule |
| :--- | :--- |
| **Form Headers** | Desktop: Split pattern. Title in center, `[Cancel]` on far left, `[Save]` on far right. (Or Title left, Actions right). |
| **Mobile Toolbars** | Maximize vertical space. Limit top toolbars to 1 Tab Dropdown, 1 Primary Action, and 1 `⋮` Overflow menu. |
| **Empty States** | Never show a blank screen. Always include a muted Icon, a brief explanation, and an `outline` button directing the user to add data. |
| **Toggles vs. Checkboxes** | Use a **Toggle Switch** (pill shape) for immediate state changes (e.g., "Flashcard Mode On/Off"). Use **Checkboxes** (squares) for batch selections or form data that requires a "Save" button to take effect. |

---

## 📖 5. The Action Dictionary (Standardizing the Verbs)

This index dictates exactly how common actions are handled across TuneTrees.

| Intent / Action | UI Text Label | Button Variant | Standard Icon (`lucide-solid`) | Strict Placement Rule |
| :--- | :--- | :--- | :--- | :--- |
| **Commit Data** | "Save" or "Submit" | `Primary` | `Save` (💾) | Far right of action group. Final step in a flow. |
| **Create New Entity** | "Add [Item]" | `Primary` or `Outline`* | `Plus` (➕) | Top right of lists, or bottom of empty states. *(Primary if main action, Outline if secondary).* |
| **Revert / Escape** | "Cancel" | `Outline` or `Ghost` | None (Usually text-only) | Far left of action group, or top-left of a modal. |
| **Dismiss View** | None (Icon only) | `Ghost` | `X` (✖️) | Top right corner of dialogs, modals, and slide-overs. |
| **Navigate Back** | "Back" | `Ghost` | `ChevronLeft` (<) | Top left of a screen (especially on mobile). |
| **Modify Data** | "Edit" | `Outline` or `Ghost` | `SquarePen` (📝) | Next to the entity title, or inside a `⋮` menu. *(Note: Do NOT use standard `Pencil` as this implies full form/record edits).* |
| **Permanently Erase** | "Delete" | `Destructive` | `Trash2` (🗑️) | Inside an overflow menu, or far left/bottom of an edit form. **Always requires a confirmation dialog.** |
| **Remove Relation** | "Remove" | `Outline` or `Ghost` | `Minus` or `X` | Use when taking a tune out of a playlist (the tune still exists in the DB). |
| **View Details** | "Info" or "Details" | `Ghost` | `Info` (ℹ️) | Next to complex terms or inside list rows. |
| **Options/Overflow**| None (Icon only) | `Ghost` | `MoreVertical` (⋮) | Far right of a row, card, or mobile toolbar. |

---

## 🔣 6. Iconography & Text Rules (The Syntax)

Icons are powerful, but they can create massive cognitive load if used inconsistently.

**Rule 1: Icon + Text (The Standard for Primary Actions)**
* **When to use:** For your most important, screen-anchoring actions (e.g., `[ 💾 Save ]`, `[ ➕ Add Tune ]`).
* **The Order:** The icon **ALWAYS** goes on the left of the text (e.g., `[Icon] Text`).
    * *Exception:* Directional indicators (like a dropdown caret or a "Next Page" arrow) go on the right: `[ Text ▾ ]` or `[ Next ➔ ]`.

**Rule 2: Text Only (The Standard for Secondary Actions)**
* **When to use:** For standard form actions where an icon adds clutter rather than clarity.
* **Examples:** "Cancel", "Submit", "Sign In". If adding an icon doesn't immediately make the button faster to understand, leave it out. Clean typography is often better than a forced icon.

**Rule 3: Icon Only (The High-Risk, High-Reward Pattern)**
* **When to use:** **ONLY** when the icon is a universally understood convention AND space is extremely tight (like a mobile toolbar or a dense data row).
* **Approved "Icon Only" concepts:**
    * Search (`Search`)
    * Close/Dismiss (`X`)
    * Filter (`Filter`)
    * Settings (`Settings`)
    * Overflow Menu (`MoreVertical`)
* **The Accessibility Mandate:** Every single "Icon Only" button MUST have an `aria-label` in the code and a standard `Tooltip` component that appears on desktop hover.

**Rule 4: Icon Consistency (The "Weight" Rule)**
* Ensure the `stroke-width` is exactly the same across the entire app (default for Lucide is usually `2px`). Do not mix thick, filled icons with thin, delicate line icons.
