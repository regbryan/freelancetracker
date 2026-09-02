import { Fragment, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react'
import { ChevronDown, ChevronRight, Pencil } from 'lucide-react'
import { useI18n } from '../lib/i18n'
import {
  milestoneRange,
  milestoneProgress,
  groupTasksByMilestone,
  sortMilestones,
  type MilestoneTaskLike,
} from '../lib/milestones'
import {
  PX_PER_DAY,
  type Zoom,
  type DateRange,
  type Tick,
  addDays,
  diffDays,
  pxToDays,
  shiftRange,
  resizeRange,
  computeContentRange,
  initialScrollDay,
  monthTicks,
  dayTicks,
  weekendSpans,
  totalDays,
  todayISO,
  barGeometry,
  entityRange,
  parseDate,
  isValidISODate,
} from '../lib/timelineMath'

export interface GanttProject {
  id: string
  name: string
  status: string
  start_date: string | null
  end_date: string | null
}

export interface GanttTask {
  id: string
  project_id: string
  title: string
  status: string
  start_date: string | null
  due_date: string | null
  milestone_id?: string | null
}

export interface GanttMilestone {
  id: string
  project_id: string
  name: string
  start_date: string | null
  end_date: string | null
  sort_order: number
}

export interface TaskDates {
  start_date: string
  due_date: string
}

export interface ProjectDates {
  start_date: string
  end_date: string
}

export interface TimelineGanttProps {
  projects: GanttProject[]
  /**
   * Every task of every project shown — done ones included. Progress counts are
   * computed from this list; `hideDone` decides which of them get a row.
   */
  tasks: GanttTask[]
  /**
   * 'project' nests milestones as rows above their tasks. 'overview' is the page's
   * task-free bird's-eye mode: no milestone rows, a diamond on the project bar instead.
   * Explicit rather than inferred from an empty task list — a project whose tasks are
   * all filtered away is still a project view.
   */
  mode?: 'project' | 'overview'
  /**
   * Drop `done` task rows. Milestone progress and any milestone span borrowed from its
   * tasks still count them, so a finished milestone keeps its bar at 100% with `n/n`.
   */
  hideDone?: boolean
  /** Milestones for every project shown. A project with none keeps the flat task layout. */
  milestones?: GanttMilestone[]
  /** Controlled expansion. Absent or empty means every milestone is collapsed. */
  expandedMilestoneIds?: ReadonlySet<string>
  /** Absent means the component keeps its own expansion state (standalone use). */
  onToggleMilestone?: (id: string) => void
  zoom: Zoom
  editable: boolean
  /** Owner only. Lets project bars be dragged. */
  canEditProjects?: boolean
  onTaskDates?: (id: string, dates: TaskDates) => Promise<void>
  onProjectDates?: (id: string, dates: ProjectDates) => Promise<void>
  /** Members may edit milestones, so this needs no separate permission flag. */
  onMilestoneDates?: (id: string, dates: ProjectDates) => Promise<void>
  onTaskClick?: (id: string) => void
  onMilestoneClick?: (id: string) => void
  onScheduleTask?: (id: string, dates: TaskDates) => Promise<void>
  /** Fixes "today" for deterministic tests. */
  today?: string
  /** Width of the sticky project/task label column. Defaults to LABEL_W. */
  labelWidth?: number
}

const LABEL_W = 320
const EDGE_PX = 8
/** Smallest width an editable bar is *drawn* at, so a one-day task stays grabbable. */
const MIN_BAR_PX = 16
const CLICK_PX = 3

const STATUS_COLORS: Record<string, string> = {
  active: '#3e6b5a',
  completed: '#16a34a',
  on_hold: '#d97706',
  cancelled: '#6b7280',
}

/**
 * Bars are solid blocks, not tinted outlines: a row should read as a shape on a date
 * at a glance, so each status is one fill plus the label colour that survives it.
 */
const TASK_STATUS_COLORS: Record<string, { bg: string; label: string }> = {
  done: { bg: '#b9d3c7', label: 'text-text-primary' },
  in_progress: { bg: '#3e6b5a', label: 'text-white' },
  todo: { bg: '#d7d0c3', label: 'text-text-primary' },
}

/** Navy: a project bar is the container its tasks sit inside, not another status. */
const PROJECT_BAR_BG = '#15263a'

/** Milestone bars are a light sage trough; the accent fill inside them is the progress. */
const MILESTONE_BAR_BG = '#c9d6cf'
/**
 * The bar label starts at the bar's left edge, which is exactly where the progress fill
 * starts, so past roughly this many pixels of fill the label is sitting on accent green
 * (navy on green is ~2.3:1) rather than on the light trough (white on sage is ~1.5:1).
 * Wider than a truncated 9px label, so the flip happens once the fill really is underneath.
 */
const MILESTONE_LABEL_FLIP_PX = 44

/**
 * Bars read as solid blocks at rest; the grab zones only draw themselves when the
 * pointer is on the bar, so the chart is not a row of handles.
 */
const EDGE_HINT_START = 'group-hover:border-l group-hover:border-white/40'
const EDGE_HINT_END = 'group-hover:border-r group-hover:border-white/40'

type DragKind = 'task' | 'project' | 'milestone'

type DragState = {
  kind: DragKind
  id: string
  mode: 'move' | 'start' | 'end'
  pointerId: number
  originX: number
  orig: DateRange
  current: DateRange
  moved: boolean
}

function keyOf(kind: DragKind, id: string): string {
  return `${kind}:${id}`
}

/**
 * `GanttTask` is deliberately loose (`status: string`, optional `milestone_id`) because it
 * is fed by three different row shapes. The pure helpers in lib/milestones want the strict
 * shape, so adapt at the boundary rather than weakening them.
 */
function asMilestoneTask(tk: GanttTask): MilestoneTaskLike & { task: GanttTask } {
  return {
    milestone_id: tk.milestone_id ?? null,
    status: tk.status === 'done' ? 'done' : tk.status === 'in_progress' ? 'in_progress' : 'todo',
    start_date: tk.start_date,
    due_date: tk.due_date,
    task: tk,
  }
}

/** A milestone with both its own dates is anchored; one without follows its tasks. */
function hasOwnDates(m: GanttMilestone): boolean {
  return Boolean(m.start_date && m.end_date)
}

/** The range an entity has according to props right now, ignoring any optimistic override. */
function baseRangeOf(
  projects: GanttProject[],
  tasks: GanttTask[],
  milestones: GanttMilestone[],
  kind: DragKind,
  id: string,
): DateRange | null {
  if (kind === 'task') {
    const tk = tasks.find((x) => x.id === id)
    return tk ? entityRange(tk.start_date, tk.due_date) : null
  }
  if (kind === 'milestone') {
    const m = milestones.find((x) => x.id === id)
    return m ? milestoneRange(m, tasks.map(asMilestoneTask)) : null
  }
  const pr = projects.find((x) => x.id === id)
  return pr ? entityRange(pr.start_date, pr.end_date) : null
}

/**
 * Weekend shading, month gridlines, and the today line. Rendered ONCE behind every row
 * as a full-height layer, not per row. Top-level so it is a stable component.
 */
function TrackBg({
  weekends,
  months,
  todayLeft,
  px,
  width,
  labelWidth,
}: {
  weekends: { offsetDays: number; days: number }[]
  months: Tick[]
  todayLeft: number
  px: number
  width: number
  labelWidth: number
}) {
  return (
    <div className="absolute z-0 pointer-events-none" style={{ left: labelWidth, top: 0, height: '100%', width }}>
      {weekends.map((w) => (
        <div
          key={w.offsetDays}
          data-testid="weekend"
          className="absolute top-0 bg-text-primary/[0.04]"
          style={{ left: w.offsetDays * px, width: w.days * px, height: '100%' }}
        />
      ))}
      {months.map((tick) => (
        <div key={tick.iso} className="absolute top-0 w-px bg-border/30" style={{ left: tick.offsetDays * px, height: '100%' }} />
      ))}
      <div className="absolute top-0 w-0.5 bg-accent" style={{ left: todayLeft, height: '100%' }} />
    </div>
  )
}

const NO_MILESTONES: GanttMilestone[] = []

export default function TimelineGantt({
  projects,
  tasks,
  mode = 'project',
  hideDone = false,
  milestones = NO_MILESTONES,
  expandedMilestoneIds,
  onToggleMilestone,
  zoom,
  editable,
  canEditProjects = false,
  onTaskDates,
  onProjectDates,
  onMilestoneDates,
  onTaskClick,
  onMilestoneClick,
  onScheduleTask,
  today: todayProp,
  labelWidth = LABEL_W,
}: TimelineGanttProps) {
  const { t, lang } = useI18n()
  const locale = lang === 'es' ? 'es-ES' : 'en-US'
  const today = todayProp ?? todayISO()
  const px = PX_PER_DAY[zoom]

  // Done rows are dropped here rather than by the page, so the page can still hand
  // over every task for the counts. Kept as one list; each project slices its own.
  const shownTasks = useMemo(() => (hideDone ? tasks.filter((tk) => tk.status !== 'done') : tasks), [hideDone, tasks])
  const adaptedAll = useMemo(() => tasks.map(asMilestoneTask), [tasks])

  const dates = useMemo(
    () => [
      ...projects.flatMap((p) => [p.start_date, p.end_date]),
      ...shownTasks.flatMap((tk) => [tk.start_date, tk.due_date]),
      // A milestone's drawn span, not just its own dates: one that borrows the extent
      // of tasks now hidden by `hideDone` must still fit inside the track.
      ...milestones.flatMap((m) => {
        const r = milestoneRange(m, adaptedAll)
        return r ? [r.start, r.end] : [m.start_date, m.end_date]
      }),
    ],
    [projects, shownTasks, milestones, adaptedAll],
  )
  // Content-driven, not today-driven: a project whose work finished in March must
  // not open on a screenful of empty track with every bar off to the left.
  const range = useMemo(() => computeContentRange(dates, today), [dates, today])
  const trackW = totalDays(range) * px
  const months = useMemo(() => monthTicks(range), [range])
  const days = useMemo(() => (zoom === 'week' ? dayTicks(range) : []), [range, zoom])
  const weekends = useMemo(() => (zoom === 'week' ? weekendSpans(range) : []), [range, zoom])
  const todayLeft = diffDays(range.start, today) * px
  const scrollDay = useMemo(() => initialScrollDay(range, dates, today), [range, dates, today])
  // Printing lays the whole track on the page instead of scrolling it; scale it down
  // to fit a landscape sheet. Applied as `zoom` by the @media print block in index.css.
  const printScale = Math.min(1, 1000 / (labelWidth + trackW))

  // Collapsed by default. The page owns this state (it persists it per project); the
  // fallback keeps the component usable on its own, and in the read-only portal.
  const [localExpanded, setLocalExpanded] = useState<ReadonlySet<string>>(() => new Set<string>())
  const expanded = expandedMilestoneIds ?? localExpanded
  function toggleMilestone(id: string) {
    if (onToggleMilestone) {
      onToggleMilestone(id)
      return
    }
    setLocalExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Overview is the page's task-free bird's-eye mode: there are no rows to nest, so
  // milestones become diamonds on the project bar instead of rows of their own.
  const overview = mode === 'overview'

  const [drag, setDrag] = useState<DragState | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const [overrides, setOverrides] = useState<
    Record<string, { range: DateRange; seq: number; baseAtWrite: DateRange }>
  >({})
  const seqRef = useRef(0)
  const scrollRef = useRef<HTMLDivElement>(null)
  const lastZoomRef = useRef<Zoom | null>(null)
  const dragActive = drag !== null

  // Scroll so the first thing worth looking at — today, or the earliest dated work
  // when today is outside the content — sits ~15% from the left of the track, on
  // mount and on zoom change. A refetch can shift range.start (and so the offset)
  // without the user asking for anything; re-running then would yank the viewport
  // back mid-read, so the zoom guard stays.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    if (lastZoomRef.current === zoom) return
    lastZoomRef.current = zoom
    el.scrollLeft = Math.max(0, scrollDay * px - Math.max(0, el.clientWidth - labelWidth) * 0.15)
  }, [zoom, scrollDay, px, labelWidth])

  // Escape cancels an in-progress drag.
  useEffect(() => {
    if (!dragActive) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        dragRef.current = null
        setDrag(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dragActive])

  // Once the saved dates arrive back through props, drop the optimistic override
  // so the bar hands off to real data without snapping.
  useEffect(() => {
    setOverrides((o) => {
      const next = { ...o }
      let changed = false
      for (const [key, val] of Object.entries(o)) {
        const sep = key.indexOf(':')
        const kind = key.slice(0, sep) as DragKind
        const base = baseRangeOf(projects, tasks, milestones, kind, key.slice(sep + 1))
        // The entity is gone, or props have moved at all since we wrote the override
        // (server clamp, a colleague's edit, a refetch). Real data wins either way;
        // we deliberately do not require props to match the optimistic range.
        if (!base || base.start !== val.baseAtWrite.start || base.end !== val.baseAtWrite.end) {
          delete next[key]
          changed = true
        }
      }
      return changed ? next : o
    })
  }, [projects, tasks, milestones])

  function fmt(iso: string): string {
    return parseDate(iso).toLocaleDateString(locale, { month: 'short', day: 'numeric' })
  }

  function monthLabel(iso: string): string {
    return parseDate(iso).toLocaleDateString(locale, { month: 'short', year: 'numeric' })
  }

  function displayRange(kind: DragKind, id: string, base: DateRange): DateRange {
    if (drag && drag.kind === kind && drag.id === id) return drag.current
    return overrides[keyOf(kind, id)]?.range ?? base
  }

  // ---- drag handlers (tested in TimelineGantt.test.tsx) ----
  function beginDrag(e: ReactPointerEvent<HTMLElement>, kind: DragKind, id: string, orig: DateRange) {
    if (!editable) return
    if (kind === 'project' && !canEditProjects) return
    if (e.button !== 0) return
    // One drag at a time: a second pointer must not hijack the one in flight.
    if (dragRef.current) return
    const edge = (e.target as HTMLElement).dataset.edge as 'start' | 'end' | undefined
    const st: DragState = {
      kind,
      id,
      mode: edge ?? 'move',
      pointerId: e.pointerId,
      originX: e.clientX,
      orig,
      current: orig,
      moved: false,
    }
    dragRef.current = st
    setDrag(st)
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* jsdom has no pointer capture */
    }
    e.currentTarget.focus?.()
    e.preventDefault()
  }

  /** Abandon the drag without saving (pointer cancelled, or capture lost to the OS). */
  function cancelDrag() {
    if (!dragRef.current) return
    dragRef.current = null
    setDrag(null)
  }

  function moveDrag(e: ReactPointerEvent<HTMLElement>) {
    const st = dragRef.current
    if (!st) return
    if (e.pointerId !== st.pointerId) return
    // The button was released without us seeing pointerup (e.g. released off-window).
    // Cancel rather than merely ignore: leaving dragRef set would block every later drag.
    if (e.buttons === 0) {
      cancelDrag()
      return
    }
    const dx = e.clientX - st.originX
    const moved = st.moved || Math.abs(dx) >= CLICK_PX
    const d = pxToDays(dx, px)
    const current = st.mode === 'move' ? shiftRange(st.orig, d) : resizeRange(st.orig, st.mode, d)
    const next: DragState = { ...st, current, moved }
    dragRef.current = next
    setDrag(next)
  }

  function endDrag(e: ReactPointerEvent<HTMLElement>) {
    const st = dragRef.current
    if (!st) return
    if (e.pointerId !== st.pointerId) return
    dragRef.current = null
    setDrag(null)
    if (!st.moved) {
      if (st.kind === 'task') onTaskClick?.(st.id)
      else if (st.kind === 'milestone') onMilestoneClick?.(st.id)
      return
    }
    if (st.current.start === st.orig.start && st.current.end === st.orig.end) return
    const key = keyOf(st.kind, st.id)
    // The optimistic position sticks until props catch up; only a rejection rolls it back,
    // and only if a newer drag has not already replaced it.
    const seq = ++seqRef.current
    // st.orig is the *displayed* range, which may itself be an override; the handoff
    // check needs the range props actually had when we wrote this entry.
    const baseAtWrite = baseRangeOf(projects, tasks, milestones, st.kind, st.id) ?? st.orig
    setOverrides((o) => ({ ...o, [key]: { range: st.current, seq, baseAtWrite } }))
    const p =
      st.kind === 'task'
        ? onTaskDates?.(st.id, { start_date: st.current.start, due_date: st.current.end })
        : st.kind === 'milestone'
          ? onMilestoneDates?.(st.id, { start_date: st.current.start, end_date: st.current.end })
          : onProjectDates?.(st.id, { start_date: st.current.start, end_date: st.current.end })
    Promise.resolve(p).catch(() =>
      setOverrides((o) => {
        if (o[key]?.seq !== seq) return o
        const rest = { ...o }
        delete rest[key]
        return rest
      }),
    )
  }

  /** Keyboard activation only — pointer clicks are resolved in endDrag. */
  function onBarClick(e: ReactMouseEvent<HTMLElement>, kind: DragKind, id: string) {
    if (e.detail !== 0) return
    if (kind === 'task') onTaskClick?.(id)
    else if (kind === 'milestone') onMilestoneClick?.(id)
  }

  const isDragging = (kind: DragKind, id: string) => Boolean(drag && drag.kind === kind && drag.id === id)

  /** Dated tasks first (by start), then the ones with no dates at all. */
  function splitTasks(list: GanttTask[]) {
    const dated = list
      .map((tk) => ({ task: tk, range: entityRange(tk.start_date, tk.due_date) }))
      .filter((x): x is { task: GanttTask; range: DateRange } => x.range !== null)
      .sort((a, b) => a.range.start.localeCompare(b.range.start))
    const undated = list.filter((tk) => !tk.start_date && !tk.due_date)
    return { dated, undated }
  }

  /** One task row. `indent` is the label cell's left padding: one level under a
   *  project, two under a milestone. */
  function renderTaskRow(task: GanttTask, baseRange: DateRange, indent: string): ReactNode {
    const r = displayRange('task', task.id, baseRange)
    const geom = barGeometry(r, range.start, px)
    const showLabel = geom.width >= 24
    const colors = TASK_STATUS_COLORS[task.status] ?? TASK_STATUS_COLORS.todo
    const dragging = isDragging('task', task.id)
    // Read-only with no click handler: nothing to activate, so it must not be a button.
    const interactive = editable || Boolean(onTaskClick)
    const barLabel = `${task.title}: ${fmt(r.start)} – ${fmt(r.end)}`
    const barClassName = `gantt-bar group absolute top-1/2 -translate-y-1/2 h-4 rounded-[3px] flex items-center px-1.5 select-none text-left ${
      editable ? 'touch-none cursor-grab' : 'cursor-default'
    } ${dragging ? 'ring-2 ring-accent/40' : ''} focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60`
    const barStyle = {
      left: geom.left,
      // Rendered width only — `geom.width` still drives the drag maths. A one-day
      // task is a 4-12px sliver at Quarter/Month zoom, too small to grab or see.
      width: editable ? Math.max(geom.width, MIN_BAR_PX) : geom.width,
      backgroundColor: colors.bg,
    }
    const barChildren = (
      <>
          {editable && (
            <>
              <span
                data-edge="start"
                className={`absolute left-0 top-0 h-full cursor-ew-resize ${EDGE_HINT_START}`}
                style={{ width: EDGE_PX }}
              />
              <span
                data-edge="end"
                className={`absolute right-0 top-0 h-full cursor-ew-resize ${EDGE_HINT_END}`}
                style={{ width: EDGE_PX }}
              />
          </>
        )}
        {dragging && (
          <span className="absolute -top-4 left-0 z-[9] whitespace-nowrap rounded-sm bg-text-primary text-white text-[9px] px-1.5 py-0.5 pointer-events-none">
            {fmt(r.start)} – {fmt(r.end)}
          </span>
        )}
        {showLabel && (
          <span className="min-w-0 flex-1 overflow-hidden">
            <span className={`block text-[9px] font-medium truncate pointer-events-none ${colors.label}`}>{task.title}</span>
          </span>
        )}
      </>
    )
    return (
      <div key={task.id} className="gantt-row flex items-stretch hover:bg-bg/50 transition-colors">
        <div
          className={`sticky left-0 z-10 bg-surface shrink-0 border-r border-border px-4 py-2 ${indent} flex items-center gap-2 min-w-0`}
          style={{ width: labelWidth, minWidth: labelWidth }}
        >
          <div className="w-1.5 h-1.5 rounded-full shrink-0 bg-border" />
          <span className="text-[13px] text-text-primary whitespace-normal leading-snug line-clamp-2 break-words" title={task.title}>
            {task.title}
          </span>
        </div>
        <div className="relative min-h-[32px]" style={{ width: trackW }}>
          {interactive ? (
            <button
              type="button"
              aria-label={barLabel}
              onPointerDown={(e) => beginDrag(e, 'task', task.id, r)}
              onPointerMove={moveDrag}
              onPointerUp={endDrag}
              onPointerCancel={cancelDrag}
              onLostPointerCapture={cancelDrag}
              onClick={(e) => onBarClick(e, 'task', task.id)}
              className={barClassName}
              style={barStyle}
              title={barLabel}
            >
              {barChildren}
            </button>
          ) : (
            <div role="img" aria-label={barLabel} className={barClassName} style={barStyle} title={barLabel}>
              {barChildren}
            </div>
          )}
        </div>
      </div>
    )
  }

  /** The "Not scheduled (n)" tray, under a project or under one milestone. */
  function renderTray(key: string, undated: GanttTask[], indent: string): ReactNode {
    return (
      <div key={key} className="gantt-row flex items-stretch" data-testid="tray">
        <div
          className={`sticky left-0 z-10 bg-surface shrink-0 border-r border-border px-4 py-2 ${indent} flex items-center min-w-0`}
          style={{ width: labelWidth, minWidth: labelWidth }}
        >
          <span className="text-[12px] text-text-secondary whitespace-normal leading-snug line-clamp-2">
            {t('timeline.notScheduled', { n: undated.length })}
          </span>
        </div>
        <div className="sticky z-10 flex items-center gap-1.5 px-2 py-1.5 flex-wrap" style={{ left: labelWidth }}>
          {undated.map((task) =>
            editable ? (
              <button
                key={task.id}
                type="button"
                title={t('timeline.scheduleHint')}
                // The page's handler re-throws after showing its banner, so the
                // promise must be swallowed here or a failed schedule becomes an
                // unhandled rejection (and a duplicate Sentry report).
                onClick={() => {
                  void Promise.resolve(onScheduleTask?.(task.id, { start_date: today, due_date: addDays(today, 6) })).catch(() => undefined)
                }}
                className="px-2 py-0.5 rounded-md border border-dashed border-border bg-surface text-[12px] text-text-secondary hover:border-accent hover:text-accent transition-colors"
              >
                {task.title}
              </button>
            ) : (
              <span
                key={task.id}
                className="px-2 py-0.5 rounded-md border border-dashed border-border bg-surface text-[12px] text-text-secondary"
              >
                {task.title}
              </span>
            ),
          )}
        </div>
      </div>
    )
  }

  /**
   * One milestone: its own row, plus its task rows when expanded.
   * `group` is every task of the milestone (the count and the borrowed span come from
   * it); `shownGroup` is the subset that gets rows once `hideDone` has had its say.
   */
  function renderMilestone(
    m: GanttMilestone,
    group: Array<ReturnType<typeof asMilestoneTask>>,
    shownGroup: Array<ReturnType<typeof asMilestoneTask>>,
  ): ReactNode {
    const isOpen = expanded.has(m.id)
    const { done, total } = milestoneProgress(m, group)
    const count = `${done}/${total}`
    const countTitle = t('timeline.milestoneCount', { done, total })
    const base = milestoneRange(m, group)
    const own = hasOwnDates(m)
    const r = base ? displayRange('milestone', m.id, base) : null
    const geom = r ? barGeometry(r, range.start, px) : null
    // Only an anchored milestone can be dragged: one that follows its tasks has no
    // dates of its own to write back.
    const draggable = editable && own && Boolean(onMilestoneDates)
    const dragging = isDragging('milestone', m.id)
    const fill = total > 0 ? done / total : 0
    const barLabel = r ? `${m.name}: ${fmt(r.start)} – ${fmt(r.end)}` : m.name
    const barTitle = own ? barLabel : `${barLabel} · ${t('timeline.milestoneAutoDates')}`
    // Not just `m.name`: that is the chevron toggle's accessible name too, and two
    // controls in one row answering to it is a screen-reader riddle.
    const placeholderLabel = `${m.name}: ${t('timeline.milestoneNoDates')}`
    const { dated, undated } = splitTasks(shownGroup.map((g) => g.task))

    // Same 18px as a project bar: a milestone contains tasks, so drawing it thinner
    // than the 16px task bars would invert the hierarchy the rows are there to show.
    const barClassName = `gantt-bar group absolute top-1/2 -translate-y-1/2 h-[18px] rounded-[3px] flex items-center px-1.5 select-none text-left ${
      draggable ? 'touch-none cursor-grab' : 'cursor-default'
    } ${dragging ? 'ring-2 ring-accent/40' : ''} focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60`
    const barStyle = geom
      ? {
          left: geom.left,
          width: draggable ? Math.max(geom.width, MIN_BAR_PX) : geom.width,
          backgroundColor: MILESTONE_BAR_BG,
        }
      : undefined
    const barChildren = (
      <>
        {/* Clipping lives on this inset layer, not on the bar, so the drag pill above
            the bar is not cut off by it. */}
        <span className="absolute inset-0 overflow-hidden rounded-[3px] pointer-events-none">
          <span
            data-testid="milestone-fill"
            className="absolute left-0 top-0 h-full bg-accent"
            style={{ width: `${(fill * 100).toFixed(1)}%` }}
          />
        </span>
        {draggable && (
          <>
            <span data-edge="start" className={`absolute left-0 top-0 h-full z-[2] cursor-ew-resize ${EDGE_HINT_START}`} style={{ width: EDGE_PX }} />
            <span data-edge="end" className={`absolute right-0 top-0 h-full z-[2] cursor-ew-resize ${EDGE_HINT_END}`} style={{ width: EDGE_PX }} />
          </>
        )}
        {dragging && r && (
          <span className="absolute -top-4 left-0 z-[9] whitespace-nowrap rounded-sm bg-text-primary text-white text-[9px] px-1.5 py-0.5 pointer-events-none">
            {fmt(r.start)} – {fmt(r.end)}
          </span>
        )}
        {geom && geom.width >= 24 && (
          <span
            className={`relative z-[1] min-w-0 flex-1 flex items-center gap-1.5 overflow-hidden pointer-events-none ${
              // The fill is dark accent, the trough is light sage: whichever the label
              // actually sits on decides which of the two readable colours it takes.
              fill * geom.width >= MILESTONE_LABEL_FLIP_PX ? 'text-white' : 'text-text-primary'
            }`}
          >
            <span className="block text-[9px] font-semibold truncate">{m.name}</span>
            {!isOpen && <span className="text-[9px] font-medium shrink-0 tabular-nums">{count}</span>}
          </span>
        )}
      </>
    )

    return (
      <Fragment key={m.id}>
        {/* A *named* group: the bar's own `group` drives the edge-handle hints, and an
            unnamed group here would make hovering anywhere in the row light them up. */}
        <div
          data-testid="milestone-row"
          data-milestone-id={m.id}
          className="gantt-row group/mrow flex items-stretch hover:bg-bg/50 transition-colors"
        >
          <div
            className="sticky left-0 z-10 bg-surface shrink-0 border-r border-border px-4 py-2.5 pl-6 flex items-center gap-1.5 min-w-0"
            style={{ width: labelWidth, minWidth: labelWidth }}
          >
            {/* Chevron and name are one control: two buttons with the same name would
                read as a duplicate to a screen reader, and both do the same thing. */}
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() => toggleMilestone(m.id)}
              className="flex items-center gap-1.5 min-w-0 text-left rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
              title={m.name}
            >
              <span className="shrink-0 text-text-secondary" aria-hidden="true">
                {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </span>
              <span className="text-[13px] font-semibold text-text-primary whitespace-normal leading-snug line-clamp-2 break-words">
                {m.name}
              </span>
            </button>
            <span className="ml-auto shrink-0 text-[12px] text-text-secondary tabular-nums" title={countTitle}>
              {count}
            </span>
            {/* The only way into edit/delete that does not depend on there being a bar
                to click — a milestone with no dates and no dated tasks has none. */}
            {onMilestoneClick && (
              <button
                type="button"
                aria-label={t('timeline.editMilestone')}
                title={t('timeline.editMilestone')}
                onClick={() => onMilestoneClick(m.id)}
                className="shrink-0 p-0.5 rounded-sm text-text-secondary hover:text-accent opacity-0 group-hover/mrow:opacity-100 focus:opacity-100 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
              >
                <Pencil size={12} aria-hidden="true" />
              </button>
            )}
          </div>
          <div className="relative min-h-[36px]" style={{ width: trackW }}>
            {r &&
              geom &&
              (draggable || onMilestoneClick ? (
                <button
                  type="button"
                  aria-label={barLabel}
                  onPointerDown={draggable ? (e) => beginDrag(e, 'milestone', m.id, r) : undefined}
                  onPointerMove={draggable ? moveDrag : undefined}
                  onPointerUp={draggable ? endDrag : undefined}
                  onPointerCancel={draggable ? cancelDrag : undefined}
                  onLostPointerCapture={draggable ? cancelDrag : undefined}
                  // A draggable bar resolves its own clicks in endDrag, so onBarClick only
                  // handles keyboard activation; a fixed bar has no drag to resolve.
                  onClick={draggable ? (e) => onBarClick(e, 'milestone', m.id) : () => onMilestoneClick?.(m.id)}
                  className={barClassName}
                  style={barStyle}
                  title={barTitle}
                >
                  {barChildren}
                </button>
              ) : (
                <div role="img" aria-label={barLabel} className={barClassName} style={barStyle} title={barTitle}>
                  {barChildren}
                </div>
              ))}
            {/* No dates of its own and no dated tasks to borrow from: without this the
                row has nothing on the track at all, and the only route to edit/delete
                would be the pencil. A one-day dashed outline at today says "put me
                somewhere" and is not draggable — there is no range to drag yet. */}
            {!r &&
              (onMilestoneClick ? (
                <button
                  type="button"
                  data-testid="milestone-placeholder"
                  aria-label={placeholderLabel}
                  title={t('timeline.milestoneNoDates')}
                  onClick={() => onMilestoneClick(m.id)}
                  className="absolute top-1/2 -translate-y-1/2 h-[18px] border border-dashed border-text-secondary/60 rounded-[3px] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                  style={{ left: todayLeft, width: px }}
                />
              ) : (
                <div
                  data-testid="milestone-placeholder"
                  role="img"
                  aria-label={placeholderLabel}
                  title={t('timeline.milestoneNoDates')}
                  className="absolute top-1/2 -translate-y-1/2 h-[18px] border border-dashed border-text-secondary/60 rounded-[3px]"
                  style={{ left: todayLeft, width: px }}
                />
              ))}
          </div>
        </div>
        {isOpen && dated.map(({ task, range: baseRange }) => renderTaskRow(task, baseRange, 'pl-12'))}
        {isOpen && undated.length > 0 && renderTray(`tray:${m.id}`, undated, 'pl-12')}
      </Fragment>
    )
  }

  return (
    <div
      data-gantt
      className="bg-surface rounded-md border border-border overflow-hidden"
      style={{ '--print-scale': String(printScale) } as CSSProperties}
    >
      <div
        ref={scrollRef}
        className="overflow-x-auto"
        data-testid="gantt-scroll"
        tabIndex={0}
        aria-label={t('timeline.projectTask')}
      >
        <div style={{ width: labelWidth + trackW }}>
          {/* Header */}
          <div className="flex border-b border-border bg-surface">
            <div
              className="sticky left-0 z-10 bg-surface shrink-0 border-r border-border px-4 py-2.5"
              style={{ width: labelWidth, minWidth: labelWidth }}
            >
              <span className="text-[12px] font-medium text-text-secondary">{t('timeline.projectTask')}</span>
            </div>
            <div className="relative h-9" style={{ width: trackW }}>
              {months.map((tick, i) => {
                // The synthetic tick at range.start can land days before a real month
                // boundary — common now that the range starts a week before the content —
                // and the two labels then print on top of each other. Keep the gridline,
                // drop the label that has nowhere to go.
                const next = months[i + 1]
                const crowded = Boolean(tick.partial && next && (next.offsetDays - tick.offsetDays) * px < 56)
                return (
                  <div key={tick.iso} className="absolute top-0 h-full flex items-start pt-1" style={{ left: tick.offsetDays * px }}>
                    <div className="h-full w-px bg-border/50" />
                    {!crowded && (
                      <span className="text-[12px] font-medium text-text-secondary ml-1.5 whitespace-nowrap">{monthLabel(tick.iso)}</span>
                    )}
                  </div>
                )
              })}
              {days.map((tick) => (
                <span
                  key={tick.iso}
                  className="absolute bottom-0.5 text-[11px] text-text-secondary"
                  style={{ left: tick.offsetDays * px + 2 }}
                >
                  {parseDate(tick.iso).getDate()}
                </span>
              ))}
              <div className="absolute top-0 h-full w-0.5 bg-accent" style={{ left: todayLeft }} />
              {/* The line needs saying once, in words, where the eye first lands. */}
              <span
                className="absolute bottom-0.5 z-10 whitespace-nowrap pointer-events-none text-[10px] font-medium text-white bg-accent rounded-sm px-1"
                style={{ left: todayLeft + 3 }}
              >
                {t('timeline.today')}
              </span>
            </div>
          </div>

          {/* Rows. One background layer sits behind them all. */}
          <div className="relative">
            <TrackBg weekends={weekends} months={months} todayLeft={todayLeft} px={px} width={trackW} labelWidth={labelWidth} />
            {projects.map((project) => {
            const projectTasks = tasks.filter((tk) => tk.project_id === project.id)
            const projectShown = shownTasks.filter((tk) => tk.project_id === project.id)
            const projectMilestones = sortMilestones(milestones.filter((m) => m.project_id === project.id))
            // Two groupings of the same milestones: all tasks for the counts and spans,
            // the visible ones for the rows.
            const { byMilestone } = groupTasksByMilestone(projectTasks.map(asMilestoneTask), projectMilestones)
            const { byMilestone: shownByMilestone, unassigned } = groupTasksByMilestone(
              projectShown.map(asMilestoneTask),
              projectMilestones,
            )
            // Milestone rows replace the flat task list only when there is something to
            // nest under; Overview has no task rows at all, so it draws diamonds instead.
            const nested = !overview && projectMilestones.length > 0
            const flatTasks = nested ? unassigned.map((a) => a.task) : projectShown
            const { dated, undated } = splitTasks(flatTasks)
            const baseProjectRange = entityRange(project.start_date, project.end_date)
            const color = STATUS_COLORS[project.status] ?? '#3e6b5a'
            const projectRange = baseProjectRange ? displayRange('project', project.id, baseProjectRange) : null
            const projectGeom = projectRange ? barGeometry(projectRange, range.start, px) : null
            const projectDragging = isDragging('project', project.id)

            return (
              <div key={project.id} className="border-b border-border last:border-0">
                {/* Project row */}
                <div className="gantt-row flex items-stretch hover:bg-bg/50 transition-colors">
                  <div
                    className="sticky left-0 z-10 bg-surface shrink-0 border-r border-border px-4 py-3 flex items-center gap-2 min-w-0"
                    style={{ width: labelWidth, minWidth: labelWidth }}
                  >
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                    <span
                      className="text-[13px] font-semibold text-text-primary whitespace-normal leading-snug line-clamp-2 break-words"
                      title={project.name}
                    >
                      {project.name}
                    </span>
                  </div>
                  <div className="relative min-h-[40px]" style={{ width: trackW }}>
                    {projectRange && projectGeom && (
                      <>
                      <div
                        role="img"
                        aria-label={`${project.name}: ${fmt(projectRange.start)} – ${fmt(projectRange.end)}`}
                        onPointerDown={(e) => beginDrag(e, 'project', project.id, projectRange)}
                        onPointerMove={moveDrag}
                        onPointerUp={endDrag}
                        onPointerCancel={cancelDrag}
                        onLostPointerCapture={cancelDrag}
                        className={`gantt-bar group absolute top-1/2 -translate-y-1/2 h-[18px] rounded-[3px] flex items-center px-2 select-none ${
                          editable && canEditProjects ? 'touch-none cursor-grab' : ''
                        } ${projectDragging ? 'ring-2 ring-accent/40' : ''}`}
                        style={{
                          left: projectGeom.left,
                          // Rendered width only: the drag maths keeps using the true width, so
                          // widening a sliver never lies about the dates it saves.
                          width: editable && canEditProjects ? Math.max(projectGeom.width, MIN_BAR_PX) : projectGeom.width,
                          backgroundColor: PROJECT_BAR_BG,
                        }}
                        title={`${project.name}: ${fmt(projectRange.start)} – ${fmt(projectRange.end)}`}
                      >
                        {editable && canEditProjects && (
                          <>
                            <span
                              data-edge="start"
                              className={`absolute left-0 top-0 h-full cursor-ew-resize ${EDGE_HINT_START}`}
                              style={{ width: EDGE_PX }}
                            />
                            <span
                              data-edge="end"
                              className={`absolute right-0 top-0 h-full cursor-ew-resize ${EDGE_HINT_END}`}
                              style={{ width: EDGE_PX }}
                            />
                          </>
                        )}
                        {projectDragging && (
                          <span className="absolute -top-4 left-0 z-[9] whitespace-nowrap rounded-sm bg-text-primary text-white text-[9px] px-1.5 py-0.5 pointer-events-none">
                            {fmt(projectRange.start)} – {fmt(projectRange.end)}
                          </span>
                        )}
                        {projectGeom.width >= 24 && (
                          <span className="min-w-0 flex-1 overflow-hidden">
                            <span className="block text-[9px] font-semibold truncate text-white">
                              {fmt(projectRange.start)} – {fmt(projectRange.end)}
                            </span>
                          </span>
                        )}
                      </div>
                      {/* Overview has no milestone rows, so each milestone is a diamond
                          pinned to the top edge of the project bar at its end date. Inside
                          the bar's own guard: a diamond floating over an undated project
                          is pinned to nothing and reads as a stray mark. */}
                      {overview &&
                        projectMilestones.map((m) => {
                          const at = m.end_date || m.start_date
                          if (!at || !isValidISODate(at)) return null
                          return (
                            <span
                              key={m.id}
                              data-testid="milestone-diamond"
                              title={`${m.name} · ${fmt(at)}`}
                              // The project bar is the same navy, so without the hairline
                              // outline the half sitting on the bar vanishes and the marker
                              // reads as a triangle rather than a diamond.
                              className="absolute w-2 h-2 rotate-45 bg-text-primary border border-surface -translate-x-1/2 -translate-y-1/2"
                              style={{ left: diffDays(range.start, at) * px, top: 'calc(50% - 9px)' }}
                            />
                          )
                        })}
                      </>
                    )}
                  </div>
                </div>

                {/* Milestone rows, each with its own tasks nested when expanded. */}
                {nested &&
                  projectMilestones.map((m) =>
                    renderMilestone(m, byMilestone.get(m.id) ?? [], shownByMilestone.get(m.id) ?? []),
                  )}

                {/* Tasks with no milestone. Grouped under a header only when the project
                    has milestones at all; otherwise the flat layout is unchanged. */}
                {nested && (dated.length > 0 || undated.length > 0) && (
                  <div className="gantt-row flex items-stretch" data-testid="unassigned-row">
                    <div
                      className="sticky left-0 z-10 bg-surface shrink-0 border-r border-border px-4 py-2.5 pl-6 flex items-center min-w-0"
                      style={{ width: labelWidth, minWidth: labelWidth }}
                    >
                      <span className="text-[13px] font-semibold text-text-secondary">{t('timeline.unassigned')}</span>
                    </div>
                    <div className="relative min-h-[36px]" style={{ width: trackW }} />
                  </div>
                )}

                {dated.map(({ task, range: baseRange }) => renderTaskRow(task, baseRange, nested ? 'pl-12' : 'pl-8'))}
                {undated.length > 0 && renderTray(`tray:${project.id}`, undated, nested ? 'pl-12' : 'pl-8')}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Legend — one line of key, no band, no heading. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 border-t border-border text-[12px] text-text-secondary">
        {(['active', 'completed', 'on_hold'] as const).map((s) => {
          const labelKey = s === 'active' ? 'timeline.legendActive' : s === 'completed' ? 'timeline.legendCompleted' : 'timeline.legendOnHold'
          return (
            <div key={s} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: STATUS_COLORS[s] }} />
              <span>{t(labelKey)}</span>
            </div>
          )
        })}
        {(['done', 'in_progress', 'todo'] as const).map((s) => (
          <div key={s} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-[2px]" style={{ backgroundColor: TASK_STATUS_COLORS[s].bg }} />
            <span>
              {t(s === 'done' ? 'timeline.legendDone' : s === 'in_progress' ? 'timeline.legendInProgress' : 'timeline.legendTodo')}
            </span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <div className="w-0.5 h-3 bg-accent" />
          <span>{t('timeline.today')}</span>
        </div>
        <span data-print-hide className="ml-auto hidden md:inline">
          {editable ? t('timeline.dragHint') : t('timeline.readOnlyHint')}
        </span>
      </div>
    </div>
  )
}
