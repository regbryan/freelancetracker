import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type MouseEvent as ReactMouseEvent } from 'react'
import { useI18n } from '../lib/i18n'
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
  tasks: GanttTask[]
  zoom: Zoom
  editable: boolean
  /** Owner only. Lets project bars be dragged. */
  canEditProjects?: boolean
  onTaskDates?: (id: string, dates: TaskDates) => Promise<void>
  onProjectDates?: (id: string, dates: ProjectDates) => Promise<void>
  onTaskClick?: (id: string) => void
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

const TASK_STATUS_COLORS: Record<string, { bg: string; border: string }> = {
  done: { bg: '#bbf7d0', border: '#16a34a' },
  in_progress: { bg: '#c8dcd1', border: '#3e6b5a' },
  todo: { bg: '#e5e7eb', border: '#9ca3af' },
}

type DragState = {
  kind: 'task' | 'project'
  id: string
  mode: 'move' | 'start' | 'end'
  pointerId: number
  originX: number
  orig: DateRange
  current: DateRange
  moved: boolean
}

function keyOf(kind: 'task' | 'project', id: string): string {
  return `${kind}:${id}`
}

/** The range an entity has according to props right now, ignoring any optimistic override. */
function baseRangeOf(
  projects: GanttProject[],
  tasks: GanttTask[],
  kind: 'task' | 'project',
  id: string,
): DateRange | null {
  if (kind === 'task') {
    const tk = tasks.find((x) => x.id === id)
    return tk ? entityRange(tk.start_date, tk.due_date) : null
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
          className="absolute top-0 bg-bg/70"
          style={{ left: w.offsetDays * px, width: w.days * px, height: '100%' }}
        />
      ))}
      {months.map((tick) => (
        <div key={tick.iso} className="absolute top-0 w-px bg-border/30" style={{ left: tick.offsetDays * px, height: '100%' }} />
      ))}
      <div className="absolute top-0 w-0.5 bg-accent/20" style={{ left: todayLeft, height: '100%' }} />
    </div>
  )
}

export default function TimelineGantt({
  projects,
  tasks,
  zoom,
  editable,
  canEditProjects = false,
  onTaskDates,
  onProjectDates,
  onTaskClick,
  onScheduleTask,
  today: todayProp,
  labelWidth = LABEL_W,
}: TimelineGanttProps) {
  const { t, lang } = useI18n()
  const locale = lang === 'es' ? 'es-ES' : 'en-US'
  const today = todayProp ?? todayISO()
  const px = PX_PER_DAY[zoom]

  const dates = useMemo(
    () => [
      ...projects.flatMap((p) => [p.start_date, p.end_date]),
      ...tasks.flatMap((tk) => [tk.start_date, tk.due_date]),
    ],
    [projects, tasks],
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
        const kind = key.slice(0, sep) as 'task' | 'project'
        const base = baseRangeOf(projects, tasks, kind, key.slice(sep + 1))
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
  }, [projects, tasks])

  function fmt(iso: string): string {
    return parseDate(iso).toLocaleDateString(locale, { month: 'short', day: 'numeric' })
  }

  function monthLabel(iso: string): string {
    return parseDate(iso).toLocaleDateString(locale, { month: 'short', year: 'numeric' })
  }

  function displayRange(kind: 'task' | 'project', id: string, base: DateRange): DateRange {
    if (drag && drag.kind === kind && drag.id === id) return drag.current
    return overrides[keyOf(kind, id)]?.range ?? base
  }

  // ---- drag handlers (tested in TimelineGantt.test.tsx) ----
  function beginDrag(e: ReactPointerEvent<HTMLElement>, kind: 'task' | 'project', id: string, orig: DateRange) {
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
      return
    }
    if (st.current.start === st.orig.start && st.current.end === st.orig.end) return
    const key = keyOf(st.kind, st.id)
    // The optimistic position sticks until props catch up; only a rejection rolls it back,
    // and only if a newer drag has not already replaced it.
    const seq = ++seqRef.current
    // st.orig is the *displayed* range, which may itself be an override; the handoff
    // check needs the range props actually had when we wrote this entry.
    const baseAtWrite = baseRangeOf(projects, tasks, st.kind, st.id) ?? st.orig
    setOverrides((o) => ({ ...o, [key]: { range: st.current, seq, baseAtWrite } }))
    const p =
      st.kind === 'task'
        ? onTaskDates?.(st.id, { start_date: st.current.start, due_date: st.current.end })
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
  function onBarClick(e: ReactMouseEvent<HTMLElement>, kind: 'task' | 'project', id: string) {
    if (e.detail !== 0) return
    if (kind === 'task') onTaskClick?.(id)
  }

  const isDragging = (kind: 'task' | 'project', id: string) => Boolean(drag && drag.kind === kind && drag.id === id)

  return (
    <div
      data-gantt
      className="bg-surface rounded-[14px] shadow-card border border-border overflow-hidden"
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
          <div className="flex border-b border-border bg-input-bg/60">
            <div
              className="sticky left-0 z-10 bg-input-bg shrink-0 border-r border-border px-4 py-2.5"
              style={{ width: labelWidth, minWidth: labelWidth }}
            >
              <span className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">{t('timeline.projectTask')}</span>
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
                      <span className="text-[10px] font-semibold text-text-muted ml-1.5 whitespace-nowrap">{monthLabel(tick.iso)}</span>
                    )}
                  </div>
                )
              })}
              {days.map((tick) => (
                <span
                  key={tick.iso}
                  className="absolute bottom-0.5 text-[9px] text-text-muted"
                  style={{ left: tick.offsetDays * px + 2 }}
                >
                  {parseDate(tick.iso).getDate()}
                </span>
              ))}
              <div className="absolute top-0 h-full w-0.5 bg-accent/60" style={{ left: todayLeft }} />
            </div>
          </div>

          {/* Rows. One background layer sits behind them all. */}
          <div className="relative">
            <TrackBg weekends={weekends} months={months} todayLeft={todayLeft} px={px} width={trackW} labelWidth={labelWidth} />
            {projects.map((project) => {
            const projectTasks = tasks.filter((tk) => tk.project_id === project.id)
            const dated = projectTasks
              .map((tk) => ({ task: tk, range: entityRange(tk.start_date, tk.due_date) }))
              .filter((x): x is { task: GanttTask; range: DateRange } => x.range !== null)
              .sort((a, b) => a.range.start.localeCompare(b.range.start))
            const undated = projectTasks.filter((tk) => !tk.start_date && !tk.due_date)
            const baseProjectRange = entityRange(project.start_date, project.end_date)
            const color = STATUS_COLORS[project.status] ?? '#3e6b5a'
            const projectRange = baseProjectRange ? displayRange('project', project.id, baseProjectRange) : null
            const projectGeom = projectRange ? barGeometry(projectRange, range.start, px) : null
            const projectDragging = isDragging('project', project.id)

            return (
              <div key={project.id} className="border-b border-border last:border-0">
                {/* Project row */}
                <div className="gantt-row flex items-stretch hover:bg-input-bg/30 transition-colors group">
                  <div
                    className="sticky left-0 z-10 bg-surface shrink-0 border-r border-border px-4 py-3 flex items-center gap-2 min-w-0"
                    style={{ width: labelWidth, minWidth: labelWidth }}
                  >
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                    <span
                      className="text-[12px] font-semibold text-text-primary whitespace-normal leading-snug line-clamp-2 break-words"
                      title={project.name}
                    >
                      {project.name}
                    </span>
                  </div>
                  <div className="relative min-h-[40px]" style={{ width: trackW }}>
                    {projectRange && projectGeom && (
                      <div
                        role="img"
                        aria-label={`${project.name}: ${fmt(projectRange.start)} – ${fmt(projectRange.end)}`}
                        onPointerDown={(e) => beginDrag(e, 'project', project.id, projectRange)}
                        onPointerMove={moveDrag}
                        onPointerUp={endDrag}
                        onPointerCancel={cancelDrag}
                        onLostPointerCapture={cancelDrag}
                        className={`gantt-bar absolute top-1/2 -translate-y-1/2 h-5 rounded-full flex items-center px-2 select-none ${
                          editable && canEditProjects ? 'touch-none cursor-grab' : ''
                        } ${projectDragging ? 'ring-2 ring-accent/40' : ''}`}
                        style={{
                          left: projectGeom.left,
                          // Rendered width only: the drag maths keeps using the true width, so
                          // widening a sliver never lies about the dates it saves.
                          width: editable && canEditProjects ? Math.max(projectGeom.width, MIN_BAR_PX) : projectGeom.width,
                          backgroundColor: color + '22',
                          border: `2px solid ${color}`,
                        }}
                        title={`${project.name}: ${fmt(projectRange.start)} – ${fmt(projectRange.end)}`}
                      >
                        {editable && canEditProjects && (
                          <>
                            <span data-edge="start" className="absolute left-0 top-0 h-full cursor-ew-resize" style={{ width: EDGE_PX }} />
                            <span data-edge="end" className="absolute right-0 top-0 h-full cursor-ew-resize" style={{ width: EDGE_PX }} />
                          </>
                        )}
                        {projectDragging && (
                          <span className="absolute -top-4 left-0 z-[9] whitespace-nowrap rounded bg-text-primary text-white text-[9px] px-1.5 py-0.5 pointer-events-none">
                            {fmt(projectRange.start)} – {fmt(projectRange.end)}
                          </span>
                        )}
                        {projectGeom.width >= 24 && (
                          <span className="min-w-0 flex-1 overflow-hidden">
                            <span className="block text-[9px] font-semibold truncate" style={{ color }}>
                              {fmt(projectRange.start)} – {fmt(projectRange.end)}
                            </span>
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Dated task rows */}
                {dated.map(({ task, range: baseRange }) => {
                  const r = displayRange('task', task.id, baseRange)
                  const geom = barGeometry(r, range.start, px)
                  const showLabel = geom.width >= 24
                  const colors = TASK_STATUS_COLORS[task.status] ?? TASK_STATUS_COLORS.todo
                  const dragging = isDragging('task', task.id)
                  // Read-only with no click handler: nothing to activate, so it must not be a button.
                  const interactive = editable || Boolean(onTaskClick)
                  const barLabel = `${task.title}: ${fmt(r.start)} – ${fmt(r.end)}`
                  const barClassName = `gantt-bar absolute top-1/2 -translate-y-1/2 h-4 rounded flex items-center px-1.5 select-none text-left ${
                    editable ? 'touch-none cursor-grab' : 'cursor-default'
                  } ${dragging ? 'ring-2 ring-accent/40' : ''} focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60`
                  const barStyle = {
                    left: geom.left,
                    // Rendered width only — `geom.width` still drives the drag maths. A one-day
                    // task is a 4-12px sliver at Quarter/Month zoom, too small to grab or see.
                    width: editable ? Math.max(geom.width, MIN_BAR_PX) : geom.width,
                    backgroundColor: colors.bg,
                    border: `1.5px solid ${colors.border}`,
                  }
                  const barChildren = (
                    <>
                      {editable && (
                        <>
                          <span data-edge="start" className="absolute left-0 top-0 h-full cursor-ew-resize" style={{ width: EDGE_PX }} />
                          <span data-edge="end" className="absolute right-0 top-0 h-full cursor-ew-resize" style={{ width: EDGE_PX }} />
                        </>
                      )}
                      {dragging && (
                        <span className="absolute -top-4 left-0 z-[9] whitespace-nowrap rounded bg-text-primary text-white text-[9px] px-1.5 py-0.5 pointer-events-none">
                          {fmt(r.start)} – {fmt(r.end)}
                        </span>
                      )}
                      {showLabel && (
                        <span className="min-w-0 flex-1 overflow-hidden">
                          <span className="block text-[9px] font-medium truncate pointer-events-none" style={{ color: colors.border }}>
                            {task.title}
                          </span>
                        </span>
                      )}
                    </>
                  )
                  return (
                    <div key={task.id} className="gantt-row flex items-stretch hover:bg-input-bg/20 transition-colors">
                      <div
                        className="sticky left-0 z-10 bg-surface shrink-0 border-r border-border px-4 py-2 pl-8 flex items-center gap-2 min-w-0"
                        style={{ width: labelWidth, minWidth: labelWidth }}
                      >
                        <div className="w-1.5 h-1.5 rounded-full shrink-0 bg-border" />
                        <span
                          className="text-[11px] text-text-secondary whitespace-normal leading-snug line-clamp-2 break-words"
                          title={task.title}
                        >
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
                })}

                {/* Not-scheduled tray */}
                {undated.length > 0 && (
                  <div className="gantt-row flex items-stretch" data-testid="tray">
                    <div
                      className="sticky left-0 z-10 bg-surface shrink-0 border-r border-border px-4 py-2 pl-8 flex items-center min-w-0"
                      style={{ width: labelWidth, minWidth: labelWidth }}
                    >
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-text-muted whitespace-normal leading-snug line-clamp-2">
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
                            className="text-[10px] font-medium px-2 py-0.5 rounded-full border border-dashed border-border text-text-secondary bg-input-bg/40 hover:border-accent hover:text-accent transition-colors"
                          >
                            {task.title}
                          </button>
                        ) : (
                          <span
                            key={task.id}
                            className="text-[10px] font-medium px-2 py-0.5 rounded-full border border-dashed border-border text-text-secondary bg-input-bg/40"
                          >
                            {task.title}
                          </span>
                        ),
                      )}
                    </div>
                  </div>
                )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-4 py-2.5 border-t border-border bg-input-bg/30 flex-wrap">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">{t('timeline.legend')}</span>
        {(['active', 'completed', 'on_hold'] as const).map((s) => {
          const labelKey = s === 'active' ? 'timeline.legendActive' : s === 'completed' ? 'timeline.legendCompleted' : 'timeline.legendOnHold'
          return (
            <div key={s} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: STATUS_COLORS[s] }} />
              <span className="text-[11px] text-text-secondary">{t(labelKey)}</span>
            </div>
          )
        })}
        <div className="w-px h-4 bg-border mx-1" />
        {(['done', 'in_progress', 'todo'] as const).map((s) => {
          const labelKey = s === 'done' ? 'timeline.legendDone' : s === 'in_progress' ? 'timeline.legendInProgress' : 'timeline.legendTodo'
          return (
            <div key={s} className="flex items-center gap-1.5">
              <div className="w-8 h-2.5 rounded" style={{ backgroundColor: TASK_STATUS_COLORS[s].bg, border: `1.5px solid ${TASK_STATUS_COLORS[s].border}` }} />
              <span className="text-[11px] text-text-secondary">{t(labelKey)}</span>
            </div>
          )
        })}
        <div className="w-px h-4 bg-border mx-1" />
        <div className="flex items-center gap-1.5">
          <div className="w-0.5 h-4 bg-accent/60" />
          <span className="text-[11px] text-text-secondary">{t('timeline.today')}</span>
        </div>
        <span data-print-hide className="ml-auto text-[10px] text-text-muted hidden md:inline">
          {editable ? t('timeline.dragHint') : t('timeline.readOnlyHint')}
        </span>
      </div>
    </div>
  )
}
