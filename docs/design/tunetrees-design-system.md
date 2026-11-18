# TuneTrees UI design system

Normative contract for the whole app: appearance, language, interaction, accessibility, and responsive behavior. Applies to new work, feature audits, and future whole-app audits. [#942](https://github.com/sboagy/tunetrees/issues/942) tracks these instruction improvements, not completion of a whole-app audit. This specifies the target experience; it does not certify existing screens as compliant.

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
| Hover / selection | Neutral `accent` background for hover; `muted` for selection plus checkbox/state indicator |

The **`accent` color token is a neutral interaction surface**, not the green creation-button variant. Do not use purple as an arbitrary premium/special marker. Chart series may use a shared categorical palette with labels; colors must remain stable for the same series.

**V3 — Measurements.** Reuse shared styles; these are defaults for missing styles, not permission for per-screen overrides.

| Element | Default |
| --- | --- |
| Typeface / body | Existing app sans-serif; `text-sm leading-5` for dense UI, `text-base leading-6` for prose |
| Page / dialog / section title | `text-xl` / `text-lg` / `text-base`, `font-semibold`; left aligned |
| Supporting text | `text-sm text-muted-foreground`; `text-xs` only metadata, never essential instructions |
| Spacing | 4px scale: 4 icon/text, 8 related controls, 16 fields/groups, 24 sections; no arbitrary spacer elements |
| Surface padding | 16px mobile, 24px desktop; table cells 8px horizontal, 6px vertical |
| Controls | Shared Button default 36px; compact desktop 32px; all touch targets at least 44×44px without overlap |
| Icons | `lucide-solid` (project version ≥1.14.0), stroke 2, 16px in controls, 20px standalone |
| Shape / depth | `rounded-md` controls, `rounded-lg` panels/dialogs; borders for groups, `shadow-lg` for overlays; no decorative nested cards |
| Form width | `max-w-3xl`; tables fill available width |

**V4 — States.** Every interactive control needs distinguishable default, hover, focus-visible, pressed/selected, disabled, and pending states as applicable. Hover must not shift layout. Keep selection distinguishable during hover. Disabled actions need a visible nearby explanation when the reason is not obvious; a tooltip alone is insufficient.

## 2. Action dictionary

**A1 — Vocabulary and hierarchy.** Use these labels/variants consistently. An active modal is its own task surface; its inert parent may retain a primary action. No competing filled primaries within one surface. Menu items inherit menu styling but retain the same wording, icon, and destructive meaning.

| Intent | Label | Button variant | Icon / placement |
| --- | --- | --- | --- |
| Persist editor | Save; Save changes in Settings | `default` | `Save`; end of action group |
| Finalize staged workflow | Submit [object], e.g. Submit practice | `default` | Text only; end of action group |
| Open creation flow | Add [entity] | `accent` | `Plus`; list toolbar right or empty state |
| Edit record or field | Edit | `outline` | `SquarePen`; title actions or overflow; no alternate Pencil vocabulary |
| Abandon staged edits | Cancel | `outline` | Text only; before commit |
| Dismiss view | Close (accessible name) | `ghost` | `X`; overlay top-right |
| Navigate to parent | Back | `ghost` | `ChevronLeft`; page top-left |
| Delete stored entity | Delete [entity] | `destructive-ghost` | `Trash2`; overflow or separated danger section |
| Remove association | Remove from [collection] | `ghost` | `Minus`; row overflow; entity survives |
| Restore defaults | Reset to defaults | `outline` | Text only; beside affected settings group |
| Clear filter/selection | Clear filters / Clear selection | `ghost` | Text only; beside scope indicator |
| Inspect / configure / overflow | Details / Settings / More actions | `ghost` | `Info` / `Settings` / `MoreVertical` |
| Filter / retry | Filter / Retry | `outline` | `Filter` / text only |

**A2 — Icons.** Use icon + text where the table specifies an icon; icon before text with 4px gap. Directional next arrows/carets follow text. Cancel, Submit, authentication, and confirmation actions are text-only. Icon-only controls are limited to Search, Close, Filter, Settings, More actions, and standard media transport (Play/Pause, Stop, Previous/Next); other row actions go in a labeled menu. Media controls use ghost styling and names describing the next action; sliders expose their value and units. Disclosure chevrons accompany visible section labels. Each icon-only control requires an accessible name and a tooltip on hover **and focus**; essential meaning must remain available on touch. Decorative icons are hidden from assistive technology.

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

**L2 — Overlay anatomy.** Title and optional description, content, actions. `X` at top-right, with reserved space so it never overlaps the title. Confirmations `max-w-md`; standard editors `max-w-lg`; table pickers `max-w-4xl`. Fit viewport with 16px outer gutter and maximum height `calc(100dvh - 2rem)`. Normally only the body scrolls. If the title and actions cannot fit in the available height (including landscape or an open keyboard), let the entire dialog scroll and release sticky title/footer positioning. Every field and action must remain reachable; never clip controls to preserve the fixed layout. Below 640px, editors and large pickers fill the available viewport; short confirmations remain inset. Account for safe areas and the on-screen keyboard.

**L3 — Action placement.** Dialog editors place Cancel then Save in a persistent footer, aligned right on desktop. Full-page editors place them in a sticky header: title left, actions right, Cancel before Save. Use one commit action group, never duplicate it in header and footer. On narrow screens keep the same location; wrap full-page actions onto a second header row, and stack dialog footer actions if needed, Cancel above full-width Save. Visual order and keyboard order must agree. Keep actions reachable above the on-screen keyboard without covering content; L2’s whole-dialog scrolling fallback overrides persistent placement when necessary; separate destructive actions from the commit group. Inline editors keep Save/Cancel beside the edited field.

**L4 — Navigation.** Desktop top-level tabs preserve established names/order (Practice, Repertoire, Catalog, Analysis); mobile navigation exposes the same destinations in the sidebar. Active destination is indicated by text/state plus underline or background. References/Notes side panels are collapsible, about 16rem desktop, initially collapsed mobile. Preserve list filters, sort, selection scope, and scroll when returning from details. Links navigate; buttons act. Never make unrelated navigation save a draft implicitly.

**L5 — Overlay layers.** Use a shared layer scale: content/sticky bars below overlay backdrop, then its dialog, then that dialog’s menus/popovers/tooltips. A nested picker/confirmation gets its own backdrop and content above the entire parent layer; inactive parent popups close. Never fix overlap with arbitrary feature z-index values. Modal background content is inert; only the top dismissible layer handles Escape/outside interaction. Notifications must not cover dialog actions or become unreachable behind a modal; show modal-owned feedback inside that modal. Read-only overlays may dismiss on backdrop; editors and confirmations follow E2/A3.

## 4. Editing, dismissal, and saving

**E1 — Edit mode.** Configuration forms use explicit Save/Cancel. Immediate application is reserved for clearly separated preferences such as theme and view controls, labeled “Changes apply immediately”; show pending/success/failure and restore the previous value if persistence fails. Do not mix immediate and staged controls in an undifferentiated form or imply Cancel reverses immediate changes. Each staged form must have one clearly named save scope and one shared action group (L3), covering its subsections; subsection expansion never commits changes. Settings category scope is defined in E6.

**E2 — Exit behavior.** Cancel, X, Escape, Back, and in-app navigation that would abandon an editor share one exit guard. Editor backdrop clicks do nothing, whether clean or dirty. Closing a nested popup must not also dismiss its editor.

| Editor state | Exit result |
| --- | --- |
| Clean | Exit immediately; return to the invoking view/control |
| Dirty | Ask “Discard changes?”; explain that unsaved changes will be lost. “Keep editing” (outline, initial focus) preserves the draft; “Discard changes” (outline) discards it and completes the originally requested exit |
| Local save pending | Prevent editor dismissal and duplicate commit until the operation settles; show saving status. A failed save restores editing and the dirty guard |
| Local save complete, sync pending | Treat the editor as saved; background sync does not block exit |

Escape/X in the discard confirmation mean Keep editing; its backdrop does nothing. Canceling navigation keeps the current location, draft, and editing focus. Guard tab/section changes when they would destroy a draft, including browser Back/Forward within the app. For browser reload, tab close, or external departure, register the browser's native departure warning while the draft is dirty OR a local write is pending, including creation from unchanged defaults. Remove it once both conditions clear; remote sync alone is not a reason to warn. Browsers may suppress the warning, particularly without prior interaction or on mobile; custom wording and guaranteed interception/completion are not available. A warning does not replace durable writes or recovery. Do not imply that Cancel undoes already persisted changes, or promise draft recovery unless implemented.

**E3 — Save lifecycle.** Existing-record Save is disabled while unchanged; creation may save valid defaults. Dirty means meaningful draft values differ from the last successfully saved baseline, including nested edits. Disable commit while pending, unavailable, or unauthorized; do not disable merely to hide validation errors. Validate on submit and focus the first invalid field. Pending state uses “Saving…”/“Submitting…” with spinner, preserves button width, prevents duplicate submission, and retains the draft.

On local success: update the baseline and affected UI; a dialog editor closes, a full-page editor returns to its invoking view (direct entry falls back to its parent list), settings stay open. On failure: retain input, show actionable inline error, restore controls, allow retry. Never close or reset on failure. Submission with partial results must identify successes/failures and retry only unfinished work; ambiguous outcomes must be reconciled before repeating a potentially duplicate operation.

**E4 — Offline truth.** “Saved” means successfully persisted locally for local-first records; “Synced” requires remote acknowledgement. Remote-only operations report success only after remote completion. Show offline/pending sync in a persistent unobtrusive status area; never block local editing solely for network loss. Explain and disable genuinely network-required actions offline. Sync failure must not imply local work was lost or encourage resubmitting it. Incoming updates must not silently overwrite a dirty draft: retain it, explain the conflict, and offer review/reload before overwriting.

**E5 — Staged workflows.** Distinguish preview, staged change, committed result, and pending sync in words. Previewing or selecting an evaluation must not look like final submission. Show consequences before Submit; changed/stale inputs require refreshed preview and user review, never silently commit altered results. Repeated practice creates an explicitly identified new event; cancellation must not erase completed history. These rules apply to imports, bulk edits, and other staged flows as well as practice.

**E6 — Settings save scope.** Each navigation category (e.g. Goals) owns one draft and one shared Save changes/Cancel group in the persistent Settings footer. Show the scope beside the controls, e.g. “Changes to Goals”; Save changes includes all edited records and subsections in that category, including collapsed ones. No per-card or per-subsection Save buttons. Saving keeps Settings open in the same category and clears its dirty indicators. Cancel closes Settings through E2; it does not undo earlier saves or immediate preferences.

Switching categories with unsaved changes invokes E2: Keep editing stays in the current category; Discard changes clears its draft and opens the requested category. To save first, keep editing and use Save changes. Do not silently save or carry hidden drafts across categories. While saving, disable category switching. Purely immediate-preference categories have no Save/Cancel group; use the standard Close control. Immediate actions such as account connection or deletion remain separately labeled operations, outside the staged draft.

All draft records/subsections, expanded or collapsed, participate in category validation; reveal errors before focusing them. Prefer one local transaction for a category save; if a workflow cannot be atomic, report partial results per E3 and retain unsaved work rather than claiming complete success. Settings subviews retain the category draft and footer; Back within that draft changes only the view. The Settings shell is the explicit exception to L1's full-page rule for multi-section editors; use `max-w-6xl` on desktop and L2's mobile viewport behavior.

**E7 — Independent operations.** Provider connection/disconnection, password changes, uploads, and deletion have named operation boundaries and their own pending/result feedback; Settings Save/Cancel must not imply control over completed operations. Before an operation redirects, reloads, or invalidates edited data, resolve the category draft through E2. Show upload type/size limits before selection, progress, and retry; distinguish uploading a file from saving its association. Abandoned staged uploads must not leave unintended attachments. Disable repeat activation; offer cancellation only when supported. Never claim rollback of remote effects after closing a view.

## 5. Forms and choices

**F1 — Field anatomy.** Label above control, help text, then field error; use associated labels, never placeholder-only labels. Mark optional fields “(optional)” and state “All other fields are required” once when mixed. Group related fields with a heading/legend. Show units, ranges, and meanings of special values (e.g. 0 versus Unlimited) before input. Never silently coerce invalid input or erase it on failure.

**F2 — Validation.** First show field validation after blur or submission, not on untouched fields. After an error, revalidate while correcting it. Validate cross-field rules on submission; show a summary for multiple/offscreen errors and focus the first invalid field. Associate help/errors with controls and announce submission failures. Use specific correction guidance, not raw exceptions or “Invalid input.”

**F3 — Control meaning.** Switches apply immediate state changes; checkboxes represent selection or staged boolean form values. Radios are mutually exclusive visible choices; selects suit longer fixed lists; searchable comboboxes suit large entity lists. Display current value, clear behavior, and unavailable options with reasons. Avoid custom controls when a shared/native control suffices. Advanced options expand in place and preserve draft values when collapsed.

**F4 — Disclosure is not editing state.** Use a labeled disclosure button with chevron and `aria-expanded`/`aria-controls` to show/hide a section; do not use an on/off switch or an unchanged “Edit” button as a collapse control. Keep the section name and a concise current-value summary visible when collapsed. Expansion/collapse never saves, discards, resets, or changes dirty state; retain draft values and mark collapsed sections with unsaved changes or errors. Submission expands invalid sections before focusing errors. For record disclosures, start collapsed with summaries; an explicitly requested record opens. Within an editor, basic fields start expanded, optional advanced sections collapsed. Allow multiple sections open; preserve expansion during the current editing session, not across sessions by default. Keep essential instructions visible; allow at most record disclosure plus one subsection level. Large optional subsections may collapse; a multi-step sub-editor uses an in-place subview per L1 rather than another modal over Settings. An actual Edit action enters a distinct editing task and follows the save/exit contract.

## 6. Tables, selection, and bulk work

**T1 — Structure.** Core lists remain tables at every size, with sticky themed headers and horizontal scrolling inside the table region. Do not hide columns simply because the viewport narrows. Preserve user column visibility/order/width preferences. Text aligns left, numeric quantities right with tabular figures, actions last; selection checkbox first. Truncate long cell text only with a keyboard/touch-accessible way to view it fully.

**T2 — Row behavior.** Title links open details; checkboxes select for bulk actions. In tune grids, row clicks set the current tune for contextual panels, independently of checkbox selection; show current-row and bulk-selection states distinctly. Row clicks never commit, navigate away, or toggle bulk selection. Double-click editing may remain a shortcut, but must have a visible keyboard/touch-accessible Edit equivalent. Each tune row provides a labeled “Show [tune] in panels” button in its title cell, separate from the details link and bulk checkbox. Tab/Shift+Tab follows normal control order; Enter/Space on this button sets the current tune and keeps focus on it. Focusing a control alone does not change the current tune; activating the already-current tune is a no-op. Mark the current button with `aria-current="true"` and a visible “Current” indicator; announce “[tune] is current” politely after a change, without moving focus into the panels. Bulk membership is conveyed only by the labeled checkbox’s checked state, not by current-row styling or `aria-selected`. Reuse this pattern across tune grids; do not add a second row-level tab stop or custom arrow navigation to native tables. Virtualization must preserve the focused control while mounted and restore focus by stable row identity after updates. Embedded controls must not trigger another row action. Sortable headers expose direction and keyboard operation. Default order must be deterministic and reflect the list's task; preserve user sorting. Filtering returns to the first page and displays active filters/count with Clear filters. Distinguish no records from no matching results.

**T3 — Selection scope.** Header checkbox selects the current page (all filtered rows for an unpaginated virtualized list, not just rendered DOM rows); use indeterminate state for partial selection. Keep selection across pagination/sort within the same query. Clear it when a changed filter/search is applied, or the collection/account changes; announce a reset only if selection existed. Clearing selection never clears staged practice evaluations or other unsaved edits; guard any operation that would abandon those separately under E2. Selecting all matching records across pages requires a separate explicit “Select all N results” action. Show selected count/scope and Clear selection in a persistent bulk toolbar. Never silently act on hidden records outside that scope.

**T4 — Bulk results.** Label actions with count; confirm destructive scope. Disable actions with an explanation when selected records cannot support them. Preserve failed selections and report partial success explicitly. Sorting, refetch, and background sync must not jump focus or scroll unexpectedly. After deletion, focus the next available row/control or empty-state action.

**T5 — Search/filter.** Local list search applies after 300ms without typing; Enter applies immediately, without submitting an enclosing editor. Fixed-choice filters apply immediately. Clear search clears only the query; Clear filters clears the query and filters, not sort/column preferences. Preserve query/filter state when returning from details within the session; account changes reset it. Show active scope and result count, keep input focus, and ignore stale async results. Remote search uses an explicit Search action, shows pending/error state, and retains input on failure. A multi-field filter dialog stages choices until “Filter results”; dismissal follows E2 and leaves the active query unchanged. Its action is primary/text-only and is not a data Save.

**T6 — Reordering.** Use a dedicated drag handle, never the entire row. Provide labeled Move up/Move down actions for keyboard/touch; announce the new position and retain focus. Disable reordering while sorted/filtered unless the resulting full-list position is explicit. In an editor, order belongs to its draft and shared Save/Cancel; outside an editor, persist immediately with status and restore the prior order on failure. View-only column rearrangement is an immediate preference. Dragging must not navigate or change bulk selection.

## 7. Feedback and recovery

**B1 — Channel.** Field problem → field error; operation failure → persistent inline error with Retry; app-wide offline/auth/sync issue → persistent banner/status; routine completed action → one toast or inline confirmation, not both; irreversible decision → confirmation. No success dialogs or browser alerts. Toasts never contain the only copy of an actionable failure.

**B2 — Timing.** Acknowledge actions immediately. Load known structures with skeletons, otherwise a labeled spinner; preserve existing content during refresh. Routine success toasts last 5 seconds, pause on hover/focus, and can be dismissed. Errors requiring action persist in their owning surface. Prevent repeated identical toasts from background retries. Long operations show progress when measurable; never invent a percentage or offer Cancel unless the operation supports cancellation.

**B3 — State coverage.** Every data surface handles loading, content, empty, filtered-empty, failure, unavailable/permission denied, offline, and partial/stale content where applicable. Empty state: muted icon, concise explanation, relevant action using §2 (Add entity is accent; Clear filters is ghost). Errors retain usable content and offer recovery. Read-only views explain permission limits and omit editing controls; temporarily unavailable actions remain discoverable with reasons.

## 8. Responsive behavior and accessibility

**R1 — Breakpoints.** Use mobile-first layout: below 640px compact/mobile, 640–1023px intermediate, ≥1024px wide. Navigation switches at 640px; side panels become persistent only at ≥1024px. Fit intermediate layouts without a second vocabulary. Mobile top toolbar allows destination selector, one main action, and overflow; move secondary utilities into overflow in their desktop order. Never hide Cancel/Save or rely on hover. Keep core tables horizontally scrollable while surrounding content reflows at 320 CSS px and 200% zoom.

**R2 — Semantics/focus.** Native elements/shared accessible primitives first. All functions keyboard-operable; visible focus never obscured by sticky bars. Logical heading/tab order, no positive tabindex. Modal traps focus and makes background inert; initial focus is first editable field, or title for long informational content, or safe action for confirmations. Closing restores focus to the trigger or a sensible surviving control. Nonmodal panels do not trap focus. Nested Escape closes only the top popup; editor dismissal then follows E2.

**R3 — Keyboard.** Enter submits a single-line form through the same validated handler as Save; multiline fields insert a newline, comboboxes accept an option, and composition input must not submit. Confirmation requires explicit activation of its focused button; no global Enter handler. Space activates buttons/checkboxes; arrows follow the primitive's menu/tab/list behavior. Any added shortcuts must be discoverable and avoid overriding text editing or browser shortcuts.

**R4 — Perception.** Normal text contrast ≥4.5:1; large text (24px regular or about 18.7px bold) ≥3:1; meaningful control boundaries/state indicators ≥3:1. Never convey status solely with color, sound, position, or tooltip. Respect reduced motion; use brief 150–200ms transitions without layout jumps. No autoplay audio; playback has labeled play/pause/stop and visible state. Charts expose text summaries/data alternatives; meaningful images have alt text. Announce status changes politely without moving focus; urgent failures may use alerts.

**R5 — Theme.** Light, dark, and system are explicit persisted preferences; follow OS changes only in system mode. Check all states in both themes, including overlays, disabled text, charts, and focus rings. Native controls and portals must inherit the selected theme.

## 9. Language and domain consistency

**C1 — Copy.** Sentence case; verb + object when scope is ambiguous. Use established entity names consistently: tune, repertoire, catalog, practice queue, goal, group, tune set. Do not interchange repertoire/playlist/tune set or introduce a new noun for an existing entity. Preserve user-defined names and evaluation labels; explain their meaning rather than renaming them. “Save” persists edits, “Submit” finalizes staged work, “Close” dismisses a view, “Back” navigates; avoid “Done” and “Apply” as substitutes.

**C2 — Values.** Use the user's locale for display and existing domain date/time utilities. Distinguish calendar dates from instants; expose timezone when scheduling interpretation depends on it. Use unambiguous dates rather than numeric day/month strings; pair relative times with accessible exact values. Include units and distinguish unknown (“Not available”), unset (“Not set”), zero, and unlimited. Do not expose UUIDs/raw technical errors as primary content; optional diagnostic details may support troubleshooting.

**C3 — Practice controls.** Evaluation arrays are the explicit exception to one-primary styling: preserve ordered, labeled choices and their shared domain colors. Explain scheduling effects and preview status; do not reuse evaluation colors for navigation. Custom goals/evaluations retain their labels and accessible descriptions; no assumption that every goal uses the four FSRS labels.

## 10. Shared implementation entry points

Use [Button](../../src/components/ui/button.tsx), [confirmation](../../src/components/ui/ConfirmDialog.tsx), [dialog primitives](../../src/components/ui/alert-dialog.tsx), and the [UI directory](../../src/components/ui) for tables, select/combobox, checkbox, switch, popover, tooltip, and charts. Use the existing `solid-sonner` feedback infrastructure. Check APIs and behavior before reuse: these are entry points, **not certified exemplars**. Missing dirty guards, focus behavior, touch sizing, or action variants must be repaired centrally when within task scope, otherwise recorded as gaps. Do not copy a custom overlay or document-level Escape handler into another feature.

Component documentation describes props, composition, and examples and links to rule IDs here. It must not define a competing interaction policy. Add reusable behavior to shared primitives instead of overriding styles/handlers in each caller. Preserve SolidJS, local-first, performance, and selector requirements in [src/AGENTS.md](../../src/AGENTS.md).

## 11. Exceptions and maintenance

Approved exceptions: T5 filter-dialog commit vocabulary; E6 Settings shell for category navigation and shared footer; C3 evaluation arrays; V2 categorical chart palettes; A3 filled destructive for account-wide irreversible deletion. No blanket grandfathering for existing screens. New exceptions need scope, rationale, and review condition here; a comment saying “matches existing UI” is insufficient. When changing policy, update affected references and acceptance expectations together. Keep rules here, examples in component documentation, and audit findings in the audit issue/report so this file stays compact.

## 12. Audit and acceptance protocol

**Q1 — Inventory first.** For a whole-app audit, enumerate routes **and** dialogs, menus, editors, panels, shared primitives, and entry paths; include auth, onboarding/import, settings, practice, tables, and error/recovery surfaces. Record tested commit, environment, and data setup. A feature audit uses the same protocol on its declared scope; it is not evidence of whole-app compliance.

**Q2 — Test matrix.** For each applicable surface, check:

| Check | Rules / required evidence |
| --- | --- |
| Grammar | V/A/L/C: screenshot of hierarchy, labels, placement, density, theme |
| Editing | E/F: clean → dirty → invalid → saving → success/failure; reset; unchanged Save; category save scope and switching; collapsed drafts/errors |
| Exit paths | E/R: Cancel, X, Escape, backdrop, navigation, nested popup; stacking, dirty/pending-write departure guards (including unchanged-default creation), and focus return |
| Data safety | E/T: offline save, failed sync, retry/double-submit, stale preview, incoming edits, bulk partial failure; independent operation boundaries |
| Data states | T/B: loading, empty, filtered-empty, populated, denied, failed, stale; search clearing/timing, selection scope, reordering |
| Access | R: keyboard-only flow, screen-reader names/announcements, current-tune activation versus bulk selection, focus, contrast, reduced motion |
| Layout | V/L/R: 320/390, 768, 1280px widths; 200% zoom; light/dark; long labels, landscape/short heights, and open keyboard with all dialog actions reachable |

Mark each applicable case **pass / fail / not tested**, or **N/A with reason**. Static inspection identifies risks; runtime interaction demonstrates behavior. Screenshots alone cannot prove focus, persistence, or cancellation. Use focused automated checks for repeatable state transitions and manual checks for visual/assistive behavior; follow repository permissions for servers and test infrastructure.

**Q3 — Findings.** Record `surface + entry path | rule ID | expected vs observed | reproduction/evidence | severity | shared root cause | fix/issue | retest status`. Prioritize P0 data loss/unintended commit, P1 blocked task/accessibility, P2 misleading/inconsistent interaction, P3 cosmetic drift. Fix shared causes first, then retest representative consumers and each affected workflow. Track untested surfaces; do not declare an audit complete while required coverage is missing. Implementation handoff summarizes applicable rules, checks run, failures, and remaining audit work.

Optional audit inspiration: [ui-audit framework](https://github.com/tommygeoco/ui-audit/blob/main/references/00-core-framework.md), [error handling](https://github.com/tommygeoco/ui-audit/blob/main/references/26-patterns-error-handling.md), [accessibility](https://github.com/tommygeoco/ui-audit/blob/main/references/27-patterns-accessibility.md). These are review prompts, not additional required reading or authority over TuneTrees rules.
