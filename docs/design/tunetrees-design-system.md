# TuneTrees UI design system

Normative contract for the whole app: appearance, language, interaction, accessibility, and responsive behavior. Applies to new work, feature audits, and future whole-app audits. [#942](https://github.com/sboagy/tunetrees/issues/942) tracks these instruction improvements, not completion of a whole-app audit. The follow-up whole-app audit is tracked separately in [#600](https://github.com/sboagy/tunetrees/issues/600). This specifies the target experience; it does not certify existing screens as compliant.

## 0. Authority and agent workflow

**G1 — Required reading.** Before constructing, changing, or auditing UI, read this document and [src/AGENTS.md](../../src/AGENTS.md). All rules below are required unless explicitly marked optional. “Default” means use the rule unless a documented exception applies, not choose freely.

**G2 — One authority.** User-approved requirements take precedence; record durable UI decisions here. This document owns all user-facing rules. Agent files own implementation constraints; component documentation owns APIs/examples. Existing code, screenshots, tests, library defaults, and external references are evidence, not permission to contradict this contract. Fix conflicting instructions rather than duplicate policy.

**G3 — Apply, then verify.** Identify applicable rule IDs and reuse shared components before editing. Verify behavior as well as appearance using §12. Report failures and untested cases explicitly; do not claim compliance from code inspection alone. Update obsolete tests when intentionally changing behavior; preserve stable selectors where possible.

**G4 — Exceptions and gaps.** Do not invent a local variant. First use the closest specified pattern. If it cannot satisfy the task, ask about consequential behavior (data loss, save scope, navigation, permissions); propose a reusable rule for other gaps. Record approved exceptions here with scope, reason, and replacement/review condition. Fix authorized surfaces; record unrelated violations for audit instead of expanding a feature into an unrequested redesign.

## 1. Visual foundations

**V1 — Product character.** Dense, calm, table-centric productivity UI. Equal desktop/mobile capabilities; adapt ergonomics, not available data. Use progressive disclosure for advanced options, never for essential errors or required actions. Preserve recognizable workflows, but legacy appearance does not override this document.

**V2 — Color meaning.** Use semantic classes from [App.css](../../src/App.css) and shared variants. Do not hardcode palette colors in feature layouts. Missing semantic styles must be added centrally when implementing, not approximated per screen.

| Meaning | Treatment |
| --- | --- |
| Commit / forward progress | Blue `primary`; one filled primary per active task surface |
| Navigation, dismissal, context | Neutral `secondary`, `muted`, `background`, `foreground`, `border` |
| Creation | Green `Button variant="accent"` |
| Success | Green with text/icon; never color alone |
| Warning / attention | Amber/orange with explanation; warning does not automatically make an action destructive |
| Data deletion / error | `destructive` family; distinguish action, invalid field, and error message by label and role |
| Table row states | Default `background`; hover-only `accent`; bulk-selected `muted` plus checked checkbox. Current adds a 2px inset start-edge `primary` marker and “Current” badge; current-plus-selected keeps both marker/badge and `muted`/checkbox. Hover never replaces selected fill or current markers. Reserve marker space to avoid layout shifts; keyboard focus uses an independent `ring` indicator |

The **`accent` color token is a neutral interaction surface**, not the green creation-button variant. Do not use purple as an arbitrary premium/special marker. Chart series may use a shared categorical palette with labels; colors must remain stable for the same series. Goal badges may also use a shared categorical palette: retain built-in hues and assign custom-goal colors deterministically, with accessible light/dark variants. Goal colors identify categories rather than success/failure; always show names and a checkmark for the selected menu choice. This user-approved exception applies to goal identity, not arbitrary navigation colors.

**V3 — Measurements.** Reuse shared styles; these are defaults for missing styles, not permission for per-screen overrides.

| Element | Default |
| --- | --- |
| Typeface / body | Existing app sans-serif; `text-sm leading-5` for dense UI, `text-base leading-6` for prose |
| Page / dialog / section title | `text-xl` / `text-lg` / `text-base`, `font-semibold`; left aligned |
| Supporting text | `text-sm text-muted-foreground`; `text-xs` only metadata, never essential instructions |
| Spacing | 4px scale: 4 icon/text, 8 related controls, 16 fields/groups, 24 sections; no arbitrary spacer elements |
| Surface padding | 16px mobile, 24px desktop; table cells 8px horizontal, 6px vertical |
| Controls | 36px default / 32px compact are fine-pointer desktop control heights. Touch hit areas are at least 44×44px and take precedence over density/cell padding |
| Icons | `lucide-solid` (project version ≥1.14.0), stroke 2, 16px in controls, 20px standalone |
| Shape / depth | `rounded-md` controls, `rounded-lg` panels/dialogs; borders for groups, `shadow-lg` for overlays; no decorative nested cards |
| Form width | `max-w-3xl`; tables fill available width |

For touch-capable layouts (including hybrid devices with a coarse pointer), enlarge the actual interactive element with padding/min-size; icons may remain 16–20px. Hit areas must stay inside their allocated row/toolbar space and never overlap adjacent controls, links, or rows. Grow row heights and toolbar spacing, or move secondary actions into overflow, rather than overlaying invisible targets on neighbors.

**V4 — States.** Every interactive control needs distinguishable default, hover, focus-visible, pressed/selected, disabled, and pending states as applicable. Hover must not shift layout. Keep selection distinguishable during hover. Disabled actions need a visible nearby explanation when the reason is not obvious; a tooltip alone is insufficient.

## 2. Action dictionary

**A1 — Vocabulary and hierarchy.** Use these labels/variants consistently. An active modal is its own task surface; its inert parent may retain a primary action. No competing filled primaries within one surface. Menu items inherit menu styling but retain the same wording, icon, and destructive meaning.

| Intent | Label | Button variant | Icon / placement |
| --- | --- | --- | --- |
| Persist editor | Save; Save Changes in Settings | `default` | `Save`; end of action group |
| Finalize staged workflow | Submit [object], e.g. Submit practice | `default` | Text only; end of action group |
| Open creation flow | Add [entity] | `accent` | `Plus`; list toolbar right or empty state |
| Edit record or field | Edit | `outline` | `SquarePen`; title actions or overflow; no alternate Pencil vocabulary |
| Request exit from editing without saving | Cancel | `outline` | Text only; before commit; guarded by E2 |
| Dismiss auxiliary view or editor | Close [view/editor] (accessible name) | `ghost` | `X`; task header top-right; guarded by E2 when editing |
| Navigate to parent or previous task step | Back | `ghost` | `ChevronLeft`; task header top-left; guarded by E2 when leaving a draft |
| Delete stored entity | Delete [entity] | `destructive-ghost` | `Trash2`; overflow or separated danger section |
| Remove association | Remove from [collection] | `ghost` | `Minus`; row overflow; entity survives |
| Restore defaults | Reset to Defaults | `outline` | Text only; beside affected settings group |
| Clear filter/selection | Clear Filters / Clear Selection | `ghost` | Text only; beside scope indicator |
| Inspect / configure / overflow | Details / Settings / More Actions | `ghost` | `Info` / `Settings` / `MoreVertical` |
| Filter / retry | Filter / Retry | `outline` | `Filter` / text only |

Choose exit controls by the user’s task, not by whether the implementation uses a route, dialog, or panel. An auxiliary view opened to inspect information (such as Practice History) uses Close/X to return to its invoking context. Back moves through a hierarchy or steps within a task. Do not add both Back and Close for the same exit.

For dialog editors, follow the [IBM Carbon transactional modal pattern](https://www.carbondesignsystem.com/building-blocks/core/components/modal/guidelines#transactional): provide both a top-right Close/X for users who look to the window corner and an explicit Cancel beside the primary action for users who look to the footer. Both request the same exit without saving. In TuneTrees, both pass through the E2 guard; neither silently discards a dirty draft.

**A2 — Icons.** Use icon + text where A1 specifies an icon; icon before text with 4px gap, directional next arrows/carets after text. Cancel, Submit, authentication, and confirmation actions are text-only. Approved icon-only controls use ghost styling (drag handles may be unstyled); other actions use text or a labeled menu. New icon-only concepts require a documented G4 exception before implementation.

| Icon-only control | Accessible name and state |
| --- | --- |
| Search, Close, Filter, Settings, More Actions | Name the action; popup triggers expose `aria-expanded`/`aria-controls` and appropriate popup semantics |
| Play/Pause, Stop, Previous/Next | Name the next action; media sliders expose value/units |
| Drag handle (`GripVertical`) | “Reorder [item]”; provide T6 move actions; announce move results, no invented pressed/expanded state |
| Mobile navigation (`Menu`), panel toggle (`PanelLeft`/`PanelRight`) | “Navigation” or “[panel name] panel”; `aria-expanded` and `aria-controls` |
| Current tune (`PanelRightOpen`) | “Show [tune] in panels”; `aria-current="true"` only for the current tune, per T2 |
| Formatting (e.g. Bold, Italic) | Stable command name; `aria-pressed` for toggle formatting; dialog-opening commands expose popup semantics instead |
| Password visibility (`Eye`/`EyeOff`) | Stable “Show password” name with `aria-pressed` reflecting visibility; retain input focus/selection |
| Clear input (`X`) | “Clear [field label]”; no toggle state; retain input focus |

Each icon-only control requires an accessible name and tooltip on hover **and focus**; essential meaning must remain available on touch. Disclosure chevrons accompany visible section labels. Decorative icons are hidden from assistive technology. Use state attributes only for their specified interaction; do not interchange current, pressed, checked, and expanded.

**A3 — Destruction.** Every stored-entity deletion requires confirmation naming the entity/count, scope, and consequences. Use Cancel (outline, initial focus) then Delete [entity] (`destructive-ghost`); filled `destructive` is reserved for account deletion or similarly broad irreversible loss, documented as an exception. Escape/X cancel confirmation; backdrop never confirms or dismisses it. No generic “Yes,” “OK,” or “Confirm.” Removing a reversible association needs no confirmation; explain that the entity remains. If removal loses other data, confirm that loss. Offer Undo only when implemented reliably; never promise recovery that does not exist.

**A4 — Scope.** Reset affects only its named group; in a staged form it changes the draft and requires Save. Immediately persisted reset requires confirmation describing its scope. Archive means recoverable hiding, Delete means deletion, Clear means empty the explicitly named input/filter/selection. Do not substitute these verbs. Actions involving assignment replacement must explain affected records and require a valid replacement before committing.

## 3. Containers and layout

**L1 — Choose by task.**

| Task | Container |
| --- | --- |
| One independent field | Inline editor with visible Save/Cancel; no implicit save on blur |
| Short contextual choice/help | Popover; never a multi-section form |
| Bounded create/edit without route identity | Dialog |
| Long, multi-section or directly addressable editor | Full page |
| Inspect reference information while keeping context | Side panel; modal slide-over on mobile |
| Irreversible decision / unsaved edits | Confirmation dialog |

Do not switch container types merely for visual variety. Mobile retains the same task and save scope. Avoid nested editors: use an in-place subview with Back that preserves the parent draft. A picker or confirmation may overlay an editor; only the top layer handles keyboard input.

**L2 — Overlay anatomy.** Title and optional description, content, actions. In a dialog editor, place Close/X at the top-right of the header, reserving space so it never overlaps the title. Keep Cancel beside Save in the footer (L3); neither control replaces the other (A1; [Carbon modal anatomy](https://www.carbondesignsystem.com/building-blocks/core/components/modal/guidelines#anatomy)). Confirmations `max-w-md`; standard editors `max-w-lg`; table pickers `max-w-4xl`. Fit viewport with 16px outer gutter and maximum height `calc(100dvh - 2rem)`. Normally only the body scrolls. If the title and actions cannot fit in the available height (including landscape or an open keyboard), let the entire dialog scroll and release sticky title/footer positioning. Every field and action must remain reachable; never clip controls to preserve the fixed layout. Below 640px, editors and large pickers fill the available viewport; short confirmations remain inset. Account for safe areas and the on-screen keyboard.

**L3 — Action placement.** Dialog editors place Cancel then Save in a persistent footer, aligned right on desktop. Full-page editors place them in a sticky header: title left, actions right, Cancel before Save. Use one commit action group, never duplicate it in header and footer. On narrow screens keep the same location; wrap full-page actions onto a second header row, and stack dialog footer actions if needed, Cancel above full-width Save. Visual order and keyboard order must agree. Keep actions reachable above the on-screen keyboard without covering content; L2’s whole-dialog scrolling fallback overrides persistent placement when necessary; separate destructive actions from the commit group. Inline editors keep Save/Cancel beside the edited field.

**L4 — Navigation.** Closing an auxiliary view or canceling an editor returns to its invoking context; direct entry uses a defined parent view as fallback. Restore focus to the invoking control when it survives, otherwise a sensible control in the destination. Switching between related inspection/editing views must preserve a coherent return path, never create self-return or circular Close/Cancel destinations. Do not implement Close as an unconditional browser-history step. Having a URL does not require a Back label or modal behavior: focus trapping and background inertness apply only when the presentation is modal (R2).

Desktop top-level tabs preserve established names/order (Practice, Repertoire, Catalog, Analysis); mobile navigation exposes the same destinations in the sidebar. Active destination is indicated by text/state plus underline or background. References/Notes side panels are collapsible, about 16rem desktop, initially collapsed mobile. Preserve list filters, sort, selection scope, and scroll when returning from details. Links navigate; buttons act. Never make unrelated navigation save a draft implicitly. At viewport heights of 480px or less, a bottom-docked tune-details panel collapses automatically so the main task stays reachable. Keep its expand control available; this temporary layout state must not overwrite the saved normal-height preference.

**L5 — Overlay layers.** Use a shared layer scale: content/sticky bars below overlay backdrop, then its dialog, then that dialog’s menus/popovers/tooltips. A nested picker/confirmation gets its own backdrop and content above the entire parent layer; inactive parent popups close. Never fix overlap with arbitrary feature z-index values. Modal background content is inert; only the top dismissible layer handles Escape/outside interaction. Notifications must not cover dialog actions or become unreachable behind a modal; show modal-owned feedback inside that modal. Read-only overlays may dismiss on backdrop; editors and confirmations follow E2/A3.

## 4. Editing, dismissal, and saving

**E1 — Edit mode.** Configuration forms use explicit Save/Cancel. Immediate application is reserved for clearly separated preferences such as theme and view controls, labeled “Changes apply immediately”; show pending/success/failure and restore the previous value if persistence fails. Do not mix immediate and staged controls in an undifferentiated form or imply Cancel reverses immediate changes. Each staged form must have one clearly named save scope and one shared action group (L3), covering its subsections; subsection expansion never commits changes. Settings category scope is defined in E6.

**E2 — Exit behavior.** Cancel, Close/X, supported Escape dismissal, Back, and in-app navigation that would abandon an editor share one exit guard, regardless of container or routing. Cancel always passes through this guard; it does not bypass confirmation merely because its label implies abandoning edits. Read-only views and clean editors need no discard confirmation. Back within a task that preserves its draft does not discard or prompt. Editor backdrop clicks do nothing, whether clean or dirty. Closing a nested popup must not also dismiss its editor.

| Editor state | Exit result |
| --- | --- |
| Clean | Exit immediately; return to the invoking view/control |
| Dirty | Ask “Discard Changes?”; explain that unsaved changes will be lost. “Keep Editing” (outline, initial focus) preserves the draft; “Discard Changes” (outline) discards it and completes the originally requested exit |
| Local save pending | Prevent editor dismissal and duplicate commit until the operation settles; show saving status. A failed save restores editing and the dirty guard |
| Local save complete, sync pending | Treat the editor as saved; background sync does not block exit |

Escape/X in the discard confirmation mean Keep Editing; its backdrop does nothing. Canceling navigation keeps the current location, draft, and editing focus. Guard tab/section changes when they would destroy a draft, including browser Back/Forward within the app. For browser reload, tab close, or external departure, register the browser's native departure warning while the draft is dirty OR a local write is pending, including creation from unchanged defaults. Remove it once both conditions clear; remote sync alone is not a reason to warn. Browsers may suppress the warning, particularly without prior interaction or on mobile; custom wording and guaranteed interception/completion are not available. A warning does not replace durable writes or recovery. Do not imply that Cancel undoes already persisted changes, or promise draft recovery unless implemented.

**E3 — Save lifecycle.** Existing-record Save is disabled while unchanged; creation may save valid defaults. Dirty means meaningful draft values differ from the last successfully saved baseline, including nested edits. Disable commit while pending, unavailable, or unauthorized; do not disable merely to hide validation errors. Validate on submit and focus the first invalid field. Pending state uses “Saving…”/“Submitting…” with spinner, preserves button width, prevents duplicate submission, and retains the draft.

On local success: update the baseline and affected UI; a dialog editor closes, a full-page editor returns to its invoking view (direct entry falls back to its parent list), settings stay open. On failure: retain input, show actionable inline error, restore controls, allow retry. Never close or reset on failure. Submission with partial results must identify successes/failures and retry only unfinished work; ambiguous outcomes must be reconciled before repeating a potentially duplicate operation.

**E4 — Offline truth.** “Saved” means successfully persisted locally for local-first records; “Synced” requires remote acknowledgement. Remote-only operations report success only after remote completion. Show offline/pending sync in a persistent unobtrusive status area; never block local editing solely for network loss. Explain and disable genuinely network-required actions offline. Sync failure must not imply local work was lost or encourage resubmitting it. Incoming updates must not silently overwrite a dirty draft: retain it, explain the conflict, and offer review/reload before overwriting.

**E5 — Staged workflows.** Distinguish preview, staged change, committed result, and pending sync in words. Previewing or selecting an evaluation must not look like final submission. Show consequences before Submit; changed/stale inputs require refreshed preview and user review, never silently commit altered results. Repeated practice creates an explicitly identified new event; cancellation must not erase completed history. These rules apply to imports, bulk edits, and other staged flows as well as practice.

**E6 — Settings save scope.** Each category with inline staged settings owns one draft and one shared Save Changes/Cancel group in the persistent Settings footer. Show the scope beside the controls, e.g. “Changes to Scheduling”; Save Changes includes all edited records and subsections in that category, including collapsed ones. No per-card or per-subsection Save buttons. Saving keeps Settings open in the same category and clears its dirty indicators. Cancel closes Settings through E2; it does not undo earlier saves or immediate preferences.

Switching categories with unsaved changes invokes E2: Keep Editing stays in the current category; Discard Changes clears its draft and opens the requested category. To save first, keep editing and use Save Changes. Do not silently save or carry hidden drafts across categories. While saving, disable category switching. Purely immediate-preference categories have no Save/Cancel group; use the standard Close control. Immediate actions such as account connection or deletion remain separately labeled operations, outside the staged draft.

All draft records/subsections, expanded or collapsed, participate in category validation; reveal errors before focusing them. Prefer one local transaction for a category save; if a workflow cannot be atomic, report partial results per E3 and retain unsaved work rather than claiming complete success. Settings subviews retain the category draft and footer; Back within that draft changes only the view. The Settings shell is the explicit exception to L1's full-page rule for multi-section editors; use `max-w-6xl` on desktop and L2's mobile viewport behavior.

Goals is an approved exception: its category is a summary list with Add in the top toolbar and Edit per goal. Each opens an independent dialog with its own draft, Cancel/Save Changes, and E2 exit guard. Saving closes that dialog and keeps Settings open; there is no category-wide Goals save footer. Reset changes only the open goal’s draft until Save. The shared practice calendar opens an independent editor with Cancel/Save Changes and the same dirty/pending guard. Its fields persist for future scheduling support; until #959 is implemented, clearly state that they do not affect practice scheduling. This bounded record-editing exception also applies to L1/F4’s guidance against nested editors: Settings is a list, not an underlying editor with another draft. Revisit if cross-goal transactional editing is introduced.

Evaluation choices within a goal use a compact table with named, tooltip-equipped edit/delete icons and a separate Add Choice action. This is a scoped A2/L1 exception: the choice dialog has its own Save Changes and E2 guard. Saving a choice persists it immediately; canceling the parent goal does not undo it. Existing goals keep unrelated unsaved fields in the parent draft. A changed scheduler and its compatible choices save together, with that scope stated before saving. For a new goal, saving a choice also creates the goal with its current settings. If required goal details are invalid, save nothing, retain the choice, and offer Complete Goal Details to return to and focus the invalid goal field. Do not invent missing values. Revisit this exception if independent choice editing is removed.

**E7 — Independent operations.** Provider connection/disconnection, password changes, uploads, and deletion have named operation boundaries and their own pending/result feedback; Settings Save/Cancel must not imply control over completed operations. Before an operation redirects, reloads, or invalidates edited data, resolve the category draft through E2. Show upload type/size limits before selection, progress, and retry; distinguish uploading a file from saving its association. Abandoned staged uploads must not leave unintended attachments. Disable repeat activation; offer cancellation only when supported. Never claim rollback of remote effects after closing a view.

## 5. Forms and choices

**F1 — Field anatomy.** Label above control, help text, then field error; use associated labels, never placeholder-only labels. Mark optional fields “(optional)” and state “All other fields are required” once when mixed. Group related fields with a heading/legend. Show units, ranges, and meanings of special values (e.g. 0 versus Unlimited) before input. Never silently coerce invalid input or erase it on failure.

**F2 — Validation.** First show field validation after blur or submission, not on untouched fields. After an error, revalidate while correcting it. Validate cross-field rules on submission; show a summary for multiple/offscreen errors and focus the first invalid field. Associate help/errors with controls and announce submission failures. Use specific correction guidance, not raw exceptions or “Invalid input.”

**F3 — Control meaning.** Switches apply immediate state changes; checkboxes represent selection or staged boolean form values. Radios are mutually exclusive visible choices; selects suit longer fixed lists; searchable comboboxes suit large entity lists. Display current value, clear behavior, and unavailable options with reasons. Avoid custom controls when a shared/native control suffices. Advanced options expand in place and preserve draft values when collapsed.

**F4 — Disclosure is not editing state.** Use a labeled disclosure button with chevron and `aria-expanded`/`aria-controls` to show/hide a section; do not use an on/off switch or an unchanged “Edit” button as a collapse control. Keep the section name and a concise current-value summary visible when collapsed. Expansion/collapse never saves, discards, resets, or changes dirty state; retain draft values and mark collapsed sections with unsaved changes or errors. Submission expands invalid sections before focusing errors. For record disclosures, start collapsed with summaries; an explicitly requested record opens. Within an editor, basic fields start expanded, optional advanced sections collapsed. Allow multiple sections open; preserve expansion during the current editing session, not across sessions by default. Keep essential instructions visible; allow at most record disclosure plus one subsection level. Large optional subsections may collapse; a multi-step sub-editor uses an in-place subview per L1 rather than another modal over Settings. An actual Edit action enters a distinct editing task and follows the save/exit contract.

## 6. Tables, selection, and bulk work

**T1 — Structure.** Core lists remain tables at every size, with sticky themed headers and horizontal scrolling inside the table region. Do not hide columns simply because the viewport narrows. Preserve user column visibility/order/width preferences. Text aligns left, numeric quantities right with tabular figures, actions last; selection checkbox first. Truncate long cell text only with a keyboard/touch-accessible way to view it fully.

**T2 — Row behavior.** Title links open details; checkboxes select for bulk actions. In tune grids, row clicks set the current tune for contextual panels, independently of checkbox selection; show current-row and bulk-selection states distinctly. Row clicks never commit, navigate away, or toggle bulk selection. Double-click editing may remain a shortcut, but must have a visible keyboard/touch-accessible Edit equivalent. Each tune row provides the compact icon-only current-tune button from A2 in its title cell, separate from the details link and bulk checkbox. Tab/Shift+Tab follows normal control order; Enter/Space on this button sets the current tune and keeps focus on it. Focusing a control alone does not change the current tune; activating the already-current tune is a no-op. Mark the current button with `aria-current="true"` and a visible “Current” indicator; announce “[tune] is current” politely after a change, without moving focus into the panels. Bulk membership is conveyed only by the labeled checkbox’s checked state, not by current-row styling or `aria-selected`. Reuse this pattern across tune grids; do not add a second row-level tab stop or custom arrow navigation to native tables. Virtualization must preserve the focused control while mounted and restore focus by stable row identity after updates. Embedded controls must not trigger another row action. Sortable headers expose direction and keyboard operation. Default order must be deterministic and reflect the list's task; preserve user sorting. Filtering returns to the first page and displays active filters/count with Clear Filters. Distinguish no records from no matching results.

**T3 — Selection scope.** Header checkbox selects the current page (all filtered rows for an unpaginated virtualized list, not just rendered DOM rows); use indeterminate state for partial selection. Keep selection across pagination/sort within the same query. Clear it when a changed filter/search is applied, or the collection/account changes; announce a reset only if selection existed. Clearing selection never clears staged practice evaluations or other unsaved edits; guard any operation that would abandon those separately under E2. Selecting all matching records across pages requires a separate explicit “Select all N results” action. Show selected count/scope and Clear Selection in a persistent bulk toolbar. Never silently act on hidden records outside that scope.

**T4 — Bulk results.** Label actions with count; confirm destructive scope. Disable actions with an explanation when selected records cannot support them. Preserve failed selections and report partial success explicitly. Sorting, refetch, and background sync must not jump focus or scroll unexpectedly. After deletion, focus the next available row/control or empty-state action.

Practice History uses one toolbar with its Goal filter, an aligned session count, and Add. All Goals clears its sole filter; omit a redundant Clear Filters action and a second session-count summary. Reintroduce Clear Filters if additional filters make it useful.

**T5 — Search/filter.** Local list search applies after 300ms without typing; Enter applies immediately, without submitting an enclosing editor. Fixed-choice filters apply immediately. Clear search clears only the query; Clear Filters clears the query and filters, not sort/column preferences. Preserve query/filter state when returning from details within the session; account changes reset it. Show active scope and result count, keep input focus, and ignore stale async results. Remote search uses an explicit Search action, shows pending/error state, and retains input on failure. A multi-field filter dialog stages choices until “Filter Results”; dismissal follows E2 and leaves the active query unchanged. Its action is primary/text-only and is not a data Save.

**T6 — Reordering.** Use a dedicated drag handle, never the entire row. Provide labeled Move Up/Move Down actions for keyboard/touch; announce the new position and retain focus. Disable reordering while sorted/filtered unless the resulting full-list position is explicit. In an editor, order belongs to its draft and shared Save/Cancel; outside an editor, persist immediately with status and restore the prior order on failure. View-only column rearrangement is an immediate preference. Dragging must not navigate or change bulk selection.

## 7. Feedback and recovery

**B1 — Channel.** Field problem → field error; operation failure → persistent inline error with Retry; app-wide offline/auth/sync issue → persistent banner/status; routine completed action → one toast or inline confirmation, not both; irreversible decision → confirmation. No success dialogs or browser alerts. Toasts never contain the only copy of an actionable failure.

**B2 — Timing.** Acknowledge actions immediately. Load known structures with skeletons, otherwise a labeled spinner; preserve existing content during refresh. Routine success toasts last 5 seconds, pause on hover/focus, and can be dismissed. Errors requiring action persist in their owning surface. Prevent repeated identical toasts from background retries. Long operations show progress when measurable; never invent a percentage or offer Cancel unless the operation supports cancellation.

**B3 — State coverage.** Every data surface handles loading, content, empty, filtered-empty, failure, unavailable/permission denied, offline, and partial/stale content where applicable. Empty state: muted icon, concise explanation, relevant action using §2 (Add entity is accent; Clear Filters is ghost). Errors retain usable content and offer recovery. Read-only views explain permission limits and omit editing controls; temporarily unavailable actions remain discoverable with reasons.

## 8. Responsive behavior and accessibility

**R1 — Breakpoints.** Use mobile-first layout: below 640px compact/mobile, 640–1023px intermediate, ≥1024px wide. Navigation switches at 640px; side panels become persistent only at ≥1024px. Fit intermediate layouts without a second vocabulary. Mobile top toolbar allows destination selector, one main action, and overflow; move secondary utilities into overflow in their desktop order. Never hide Cancel/Save or rely on hover. Keep core tables horizontally scrollable while surrounding content reflows at 320 CSS px and 200% zoom.

**R2 — Semantics/focus.** Native elements/shared accessible primitives first. All functions keyboard-operable; visible focus never obscured by sticky bars. Logical heading/tab order, no positive tabindex. Modal traps focus and makes background inert; initial focus is first editable field, or title for long informational content, or safe action for confirmations. Closing restores focus to the trigger or a sensible surviving control. Nonmodal panels do not trap focus. Nested Escape closes only the top popup; editor dismissal then follows E2.

**R3 — Keyboard.** Enter submits a single-line form through the same validated handler as Save; multiline fields insert a newline, comboboxes accept an option, and composition input must not submit. Confirmation requires explicit activation of its focused button; no global Enter handler. Space activates buttons/checkboxes; arrows follow the primitive's menu/tab/list behavior. Any added shortcuts must be discoverable and avoid overriding text editing or browser shortcuts.

**R4 — Perception.** Normal text contrast ≥4.5:1; large text (24px regular or about 18.7px bold) ≥3:1; meaningful control boundaries/state indicators ≥3:1. Never convey status solely with color, sound, position, or tooltip. Respect reduced motion; use brief 150–200ms transitions without layout jumps. No autoplay audio; playback has labeled play/pause/stop and visible state. Charts expose text summaries/data alternatives; meaningful images have alt text. Announce status changes politely without moving focus; urgent failures may use alerts.

**R5 — Theme.** Light, dark, and system are explicit persisted preferences; follow OS changes only in system mode. Check all states in both themes, including overlays, disabled text, charts, and focus rings. Native controls and portals must inherit the selected theme.

## 9. Language and domain consistency

**C1 — Copy.** Use Apple’s [title-style capitalization](https://support.apple.com/guide/applestyleguide/c-apsgb744e4a3/web#apdca93e113f1d64) for app-owned menu items, button labels, navigation labels, and concise control labels. This is title capitalization, not mechanically capitalizing every word: for example, “Show Submitted,” “Flashcard Mode,” “Display Options,” “Save Changes,” and “Reset to Defaults.” Use sentence case for explanatory prose, help text, status sentences, and error messages. Preserve proper names and acronyms. Accessible names should retain the capitalization of the corresponding visible label. Apply this rule to action-label examples throughout this document; use verb + object when scope is ambiguous. Use established entity names consistently: tune, repertoire, catalog, practice queue, goal, group, tune set. Do not interchange repertoire/playlist/tune set or introduce a new noun for an existing entity. Preserve user-defined names and evaluation labels; explain their meaning rather than renaming them. “Save” persists edits, “Submit” finalizes staged work, “Close” dismisses an auxiliary view or editor, “Cancel” requests exit from editing without saving, and “Back” navigates to a parent or task step; exit labels follow A1 and all draft-losing exits follow E2; avoid “Done” and “Apply” as substitutes.

**C2 — Values.** Use the user's locale for display and existing domain date/time utilities. Distinguish calendar dates from instants; expose timezone when scheduling interpretation depends on it. Use unambiguous dates rather than numeric day/month strings; pair relative times with accessible exact values. Include units and distinguish unknown (“Not available”), unset (“Not set”), zero, and unlimited. Do not expose UUIDs/raw technical errors as primary content; optional diagnostic details may support troubleshooting.

**C3 — Practice controls.** Evaluation arrays are the explicit exception to one-primary styling: preserve ordered, labeled choices and their shared domain colors. Explain scheduling effects and preview status; do not reuse evaluation colors for navigation. Custom goals/evaluations retain their labels and accessible descriptions; no assumption that every goal uses the four FSRS labels. In-row evaluation menus use a bounded width, a current-selection checkmark, compact scheduling estimates, and a separate Clear Evaluation action. Explain Choices toggles longer descriptions and exact due times without selecting an evaluation or closing the menu; within the menu this uses the primitive’s checked menu-item semantics. The closed control shows only the evaluation label, left-aligned when wrapped. Submitted controls also show a compact checkmark with an accessible Submitted indication inside the existing cell. Submitted and unsubmitted chevrons align at the same right inset without widening the column. The chooser overlays that control, aligning the current choice vertically where viewport space permits; viewport padding takes priority. Opening must not select a choice. Retain the opening anchor when explanations expand, subject to viewport constraints.

## 10. Shared implementation entry points

Use [Button](../../src/components/ui/button.tsx), [confirmation](../../src/components/ui/ConfirmDialog.tsx), [dialog primitives](../../src/components/ui/alert-dialog.tsx), and the [UI directory](../../src/components/ui) for tables, select/combobox, checkbox, switch, popover, tooltip, and charts. Use the existing `solid-sonner` feedback infrastructure. Check APIs and behavior before reuse: these are entry points, **not certified exemplars**. Missing dirty guards, focus behavior, touch sizing, or action variants must be repaired centrally when within task scope, otherwise recorded as gaps. Do not copy a custom overlay or document-level Escape handler into another feature.

Component documentation describes props, composition, and examples and links to rule IDs here. It must not define a competing interaction policy. Add reusable behavior to shared primitives instead of overriding styles/handlers in each caller. Preserve SolidJS, local-first, performance, and selector requirements in [src/AGENTS.md](../../src/AGENTS.md).

## 11. Exceptions and maintenance

Approved exceptions: T5 filter-dialog commit vocabulary; E6 Settings shell and independent Goals record dialogs; C3 evaluation arrays; V2 categorical chart and goal-identity palettes; A3 filled destructive for account-wide irreversible deletion. No blanket grandfathering for existing screens. New exceptions need scope, rationale, and review condition here; a comment saying “matches existing UI” is insufficient. When changing policy, update affected references and acceptance expectations together. Keep rules here, examples in component documentation, and audit findings in the Q1 tracking destination so this file stays compact.

## 12. Audit and acceptance protocol

**Q1 — Inventory first.** Before testing, name a dedicated tracking issue or repository report path in the audit handoff; create it if absent. Record scope and coverage there and link every finding/remediation. The whole-app follow-up uses [#600](https://github.com/sboagy/tunetrees/issues/600), independently of closing instruction issue #942. For a whole-app audit, enumerate routes **and** dialogs, menus, editors, panels, shared primitives, and entry paths; include auth, onboarding/import, settings, practice, tables, and error/recovery surfaces. Record tested commit, environment, and data setup. A feature audit uses the same protocol on its declared scope; it is not evidence of whole-app compliance.

**Q2 — Test matrix.** For each applicable surface, check:

| Check | Rules / required evidence |
| --- | --- |
| Grammar | V/A/L/C: screenshot of hierarchy, labels, placement, density, theme |
| Editing | E/F: clean → dirty → invalid → saving → success/failure; reset; unchanged Save; category save scope and switching; collapsed drafts/errors |
| Exit paths | A/L/E/R: task-appropriate Close/Cancel/Back independent of route/container; Cancel, X, supported Escape, backdrop, navigation, nested popup; consistent dirty/pending-write guards (including unchanged-default creation), direct-entry fallback, no circular return paths, and focus return |
| Data safety | E/T: offline save, failed sync, retry/double-submit, stale preview, incoming edits, bulk partial failure; independent operation boundaries |
| Data states | T/B: loading, empty, filtered-empty, populated, denied, failed, stale; search clearing/timing, selection scope, reordering |
| Access | R: keyboard-only flow, screen-reader names/announcements, current-tune activation versus bulk selection, focus, contrast, reduced motion |
| Layout | V/L/R: 320/390, 768, 1280px widths; 200% zoom; light/dark; long labels, landscape/short heights, and open keyboard with all dialog actions reachable |

Mark each applicable case **pass / fail / not tested**, or **N/A with reason**. Static inspection identifies risks; runtime interaction demonstrates behavior. Screenshots alone cannot prove focus, persistence, or cancellation. Use focused automated checks for repeatable state transitions and manual checks for visual/assistive behavior; follow repository permissions for servers and test infrastructure.

**Q3 — Findings.** In the Q1 tracking destination, record `surface + entry path | rule ID | expected vs observed | reproduction/evidence | severity | shared root cause | fix/issue | retest status`. Prioritize P0 data loss/unintended commit, P1 blocked task/accessibility, P2 misleading/inconsistent interaction, P3 cosmetic drift. Fix shared causes first, then retest representative consumers and each affected workflow. Track untested surfaces; do not declare an audit complete while required coverage is missing. Implementation handoff summarizes applicable rules, checks run, failures, and remaining audit work.

Optional audit inspiration: [ui-audit framework](https://github.com/tommygeoco/ui-audit/blob/main/references/00-core-framework.md), [error handling](https://github.com/tommygeoco/ui-audit/blob/main/references/26-patterns-error-handling.md), [accessibility](https://github.com/tommygeoco/ui-audit/blob/main/references/27-patterns-accessibility.md). These are review prompts, not additional required reading or authority over TuneTrees rules.
