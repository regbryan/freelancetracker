# Time Tracking Quick-Log — Design

**Date:** 2026-06-12
**Status:** Approved by Reggie (chat session)
**Scope:** Capture-flow UX only. No schema changes. Client portal is a separate future project.

## Problem

Recording time in Bough takes too many fields and clicks. The manual entry form is
hidden behind a toggle on the Time page and requires project (dropdown), description,
hours, date, and billable on every entry. There is no way to log time from other pages.

User profile this design targets (from discovery):
- Logs time at end of day, plus occasional live timer use.
- Desktop-first; wants a ~5-second capture flow.
- 1–3 active projects in a typical week.

## Design

### 1. Quick-Log Bar (Time page)

Replaces the "add manual entry" toggle + hidden `TimeEntryForm` on `/time`.
Always visible directly below the Timer widget.

- **Project chips** instead of a dropdown. Recent projects (max 5) ordered by most
  recently logged-against, pre-selected to the last project used. An overflow
  affordance (small dropdown) covers projects not in the chip row.
- **Description input** with autocomplete from the user's own past entry descriptions
  for the selected project (deduplicated, most recent first, max ~8 suggestions).
  Selecting a suggestion also pre-fills that entry's hours (editable).
- **Hours input** — same semantics as today: numeric, min 0.25, rounded up to the
  nearest 0.25h on save.
- **Date control** — defaults to today; compact Today/Yesterday pill plus a date
  picker for older dates (end-of-day and next-morning logging).
- **Billable** — defaults on; toggle stays visible but compact.
- **Task picker** — moved behind a "More" expander; not on the happy path.
- **Submit** — Enter submits from any field. On success: description/hours clear,
  project chip selection persists, brief inline confirmation shows. On failure:
  inline error, field values preserved.

Happy path: click chip (or keep default) → type description → type hours → Enter.

### 2. Log from anywhere (global quick-log)

The same form, reused inside a Radix dialog, mounted in `Layout` so it is available
on every authenticated page. Two entry points:

- **Command palette action** — "Log time…" added to the existing `CommandPalette`
  (currently navigation-only). Requires extending the palette's result model from
  navigate-only to support action items.
- **Global keyboard shortcut** — `Ctrl+Shift+L` (chosen to avoid collisions with
  typing and browser shortcuts). Ignored when the dialog is already open.

Dialog closes on Esc or successful save (with confirmation toast).

### 3. Faster repeats

- The existing clone-to-today action on recent entries gets a visible "Log again"
  affordance instead of a 12px icon-only button.
- Description autocomplete (section 1) doubles as the repeat mechanism for
  near-identical entries with different hours.

### 4. Unchanged

- No database/schema changes; uses existing `useTimeEntries().createEntry`.
- Timer widget behavior unchanged.
- 0.25h round-up rule unchanged.
- `TimeEntryForm` remains in use on ProjectDetail until/unless the quick-log
  component replaces it there in a later pass (out of scope).
- No mobile-specific work in this project.

## Architecture

New/changed units:

| Unit | Kind | Responsibility |
|---|---|---|
| `QuickLogForm` | new component | The capture form (chips, description+autocomplete, hours, date, billable, task expander). Pure form: takes `projects`, `recentEntries`, `onSave`; owns no data fetching. |
| `QuickLogDialog` | new component | Radix dialog wrapping `QuickLogForm`; fetches projects/entries via existing hooks; mounted in `Layout`. |
| `TimeTracker` page | changed | Renders `QuickLogForm` inline (replacing the manual-form toggle); passes data + `createEntry`. |
| `CommandPalette` | changed | Result model gains action items; adds "Log time…" which opens `QuickLogDialog`. |
| `Layout` | changed | Hosts `QuickLogDialog` + global `Ctrl+Shift+L` listener. |
| `TimeEntryList` / recent-entries table | changed | Visible "Log again" button. |

Data flow: `QuickLogForm` derives recent-project order and description suggestions
from the entries array already fetched by `useTimeEntries` — no new queries.

## Error handling

- Save failure: inline error in the form, values preserved, retry allowed.
- No projects exist: bar shows an empty state linking to create a project.
- Suggestions are a convenience only — empty/failed suggestion derivation must not
  block manual entry.

## Verification

- `npm run lint` and `npm run build` green; CI green.
- Visual review with screenshots + written critique (per operating conventions):
  1. Quick-log bar on `/time` (default state, autocomplete open, success state).
  2. Global dialog opened via `Ctrl+Shift+L` on the Dashboard.
  3. Command palette showing the "Log time…" action.
- Functional checks: entry created with correct defaults (today, billable, rounded
  hours); chip pre-selection reflects last-used project; Enter-to-save; Esc closes
  dialog; shortcut suppressed while dialog open.
