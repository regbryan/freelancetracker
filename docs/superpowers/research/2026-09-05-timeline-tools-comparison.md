# Timeline / Gantt tools compared, against what the branch has

**Date:** 2026-09-05
**Why:** Reggie asked twice for research before more building. He sent a
ProjectManager.com Gantt (Govalle Construction sample) as the target look, and named
Milestones PM+ (Salesforce) as a reference. This compares those with Asana Timeline,
TeamGantt, and monday.com, then lists the concrete gaps in `feature/timeline-collab`.

Sources: the ProjectManager screenshot Reggie sent; [ProjectManager Gantt page](https://www.projectmanager.com/gantt-chart);
[Milestones PM+ Gantt](https://passagetechnology.com/salesforce-project-gantt?hsLang=en-us) and
[features](https://www.passagetechnology.com/milestones-pmplus-features);
[TeamGantt Gantt view](https://support.teamgantt.com/article/143-gantt-view/) and
[sharing](https://support.teamgantt.com/article/89-sharing-your-project/);
[Asana Gantt basics](https://asana.com/resources/gantt-chart-basics) and
[zoom](https://www.guideflow.com/tutorial/how-to-zoom-timeline-in-gantt-view-in-asana);
[monday.com Gantt view](https://support.monday.com/hc/en-us/articles/360015643840-The-Gantt-Chart-View-and-Widget).

## What every one of them does the same way

1. **One project per chart.** The chart is opened from a project. A portfolio or
   "all projects" view is a separate, summary-level screen. None of them stack every
   project's tasks into one Gantt.
2. **A task list on the left with real columns.** Row number, task name, then at
   least one of assignee, start, finish, duration, percent complete. The left side is a
   spreadsheet, not a label strip.
3. **Phases as summary rows.** Collapsible groups (ProjectManager "phases",
   Milestones PM+ "milestones", TeamGantt "task groups", Asana "sections",
   monday "groups"). The group row draws a thin bracket-style summary bar spanning its
   children and shows the group's percent complete.
4. **Milestones as diamonds.** A zero-duration point on the axis (Bid Date, Award Date,
   Construction Start Date in the sample), labelled with its date.
5. **Percent complete on the bar.** A darker fill inside the bar; the number and the
   assignee's name are printed to the right of the bar, never squeezed inside it.
6. **Day-level axis.** Week header (e.g. "JUL. 31 '22") over weekday letters
   (W T F S S M T), weekends shaded. Zoom steps: day, week, month, sometimes quarter.
7. **Drag to move and resize; drag from bar end to bar start to create a dependency.**
   Dependency arrows (finish-to-start by default). Moving a predecessor pushes its
   successors.
8. **Colour by phase or by assignee**, not by status. Status is shown by percent
   complete and by a late/overdue treatment.
9. **Print / PDF export and a client share link** (TeamGantt: print-ready PDF and
   embed; monday: share link or PDF; Milestones PM+: email, PDF, print; ProjectManager:
   share and print in the toolbar).

## Where they differ

| | ProjectManager | Milestones PM+ | TeamGantt | Asana Timeline | monday.com |
|---|---|---|---|---|---|
| Grouping | Phases (WBS levels) | Project → Milestone → Task → sub-task | Task groups, nested | Sections | Groups |
| Milestone marker | Diamond, dated | Milestone is a container with its own bar | Diamond | Diamond | Diamond (Pro plan) |
| Percent complete | Per task and rolled up to phase | Rolled up to milestone and project | Per task | No (done / not done) | Per item via a column |
| Dependencies | 4 types, arrows, critical path | Predecessor / successor | Yes, arrows | Yes | Yes (Pro) |
| Baseline | Yes | No | Yes | No | Yes (Pro) |
| Assignee on bar | Name to the right of the bar | Owner colouring | Avatar on bar | Avatar | Person column |
| Print / PDF | Toolbar | Email, PDF, print | Print-ready PDF, filtered | Export via print | PDF, Excel |
| Client access | Guest licences | Restricted visibility | Free guest viewers, embed | Guests | Shareable link |

## What the branch has today (commit 24e1447+)

- One project at a time with a select switcher, plus a separate Overview. Matches item 1.
- Milestones table, collapsible milestone rows with a progress fill, tasks nested under
  them. Partly matches item 3 (progress is done-count based, not percent).
- Task bars with drag to move and resize; Escape cancel; optimistic save. Matches 7 without
  dependencies.
- Week / Month / Quarter zoom with day numbers in Week. Partly matches 6 (no weekday
  letters, no week header, no Day zoom).
- Print / PDF via the browser, and the client portal timeline. Matches 9 in spirit.
- Left column is a single label with a two-line wrap. Does not match 2.
- Status colours on bars (todo / in progress / done). Opposite of 8.
- No diamonds for dated points, no percent complete field, no assignee on bars, no
  dependencies, no baseline.

## Gaps to close, in the order that changes the picture most

1. **Task list with columns** on the left: #, name, assignee, start, end, done.
   Resizable split between list and chart. This alone makes it read as a Gantt.
2. **Phase summary bars**: the milestone row draws a thin bracket bar spanning its
   tasks with the rolled-up percent, like "Design 80%".
3. **Labels to the right of bars**: task name and percent outside the bar; the bar
   itself stays a clean block.
4. **Day-level axis**: week header over weekday letters, weekends shaded, Day zoom
   added; Week becomes the default for planning.
5. **Diamonds for zero-duration items**: a task whose start equals its due date, or a
   milestone with one date, draws a diamond with the date beside it.
6. **Colour by phase**, with done shown as a filled bar and open as an outline, instead
   of three status colours.
7. **Percent complete on tasks** (a `progress` 0–100 column) rolled up to milestones.
   Small schema change.
8. **Dependencies** (finish-to-start only), drawn as elbow arrows, created by dragging
   from a bar's end. Larger; can wait.
9. **Baseline** snapshot. Can wait.

Items 1–6 are presentation and need no schema change. Item 7 needs one column. Items 8
and 9 are separate features.
