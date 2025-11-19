### Field-Level Override Indicator & Reveal**

**Context:** In the current design for the "Edit Tune" form, each input field (`Title`, `Genre`, `Type`, etc.) displays the user's private override value if one exists, or the public value otherwise.  Right there is a "Show Public" toggle that allows the user to switch to the pure public values, but it puts everything in read only mode.

**Goal:** Implement a visual indicator for fields that have a user-defined override, and provide an interactive way to reveal the underlying public (read-only) value on a per-field basis, without leaving the edit mode.  And remove the overall "Show Public" toggle for the "Edit Tune" form.

---

**Detailed Requirements:**

1.  **Override Indicator Icon:**
    * For any input field (`<input>` or `<select>`) where a user's **private override value** is currently displayed (i.e., it differs from the public `tune` table value), display a small, unobtrusive icon within or next to the input field.
    * **Icon:** Use a solid "layers" icon (e.g., `lucide-layers-2-solid`).
    * **Placement:** Position the icon towards the **right edge of the input field**, preferably *inside* the input if possible, or immediately to its right. It should be visually distinct but not obstruct the input content.
    * **Styling:** Make the icon a slightly muted color (e.g., a lighter grey than the input text) to indicate its secondary, informational purpose.
    * **Tooltip (Optional but Recommended):** On hover, display a tooltip that says "This field has a private override."

2.  **Interactive Reveal of Public Value:**
    * When the **override indicator icon** is clicked, the input field should expand or dynamically display a small, read-only section *directly below* the current editable input field.
    * **Revealed Content:** This new section will show the **public value** for that specific field.
        * **Label:** "Public Value:" or "Original Value:"
        * **Value Display:** The public value itself, rendered as plain, read-only text (e.g., `<span>` or `<p>`).
        * **Styling:** This revealed section should have a slightly different background color (e.g., a very light grey or a subtle border) to differentiate it from the editable field.
    * **"Revert" Action:**
        * Within this revealed public value section, include a small **"Revert" button or icon** (e.g., `lucide-undo-solid`).
        * **Functionality:** Clicking "Revert" will:
            * Delete the user's override record for *this specific field* from the `tune_override` table.
            * Immediately update the main input field to display the public value.
            * Remove the override indicator icon from that field.
            * Hide the revealed public value section.
    * **Dismissal:**
        * Clicking the override indicator icon again, clicking outside the revealed section, or interacting with another part of the form should hide the revealed public value section.

**Example Interaction Flow (for "Title" field):**

1.  User views "Edit Tune" form.
2.  "Title" field displays "Banish Misfortune" (private override).
3.  A small `layers-2-solid` icon is visible inside the "Title" input field, on the right.
4.  User clicks the `layers-2-solid` icon.
5.  A small, grey box appears directly below the "Title" input, saying "Public Value: Banish Misfortune (Original)" with a small "Revert" button next to it.
6.  User can now compare the private and public values.
7.  User clicks "Revert."
8.  The override record is removed, "Title" field now displays the public value, the layers icon disappears, and the grey box hides.

**Testing:**

Existing e2e tests will need to be updated for this new design.  If figuring out the changes get to be too complicated, please leave TODO comments where you think I need to apply some attention.
