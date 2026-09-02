import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type MouseEvent as ReactMouseEvent } from 'react'
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
  computeRange,
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
}

export const LABEL_W = 220
const EDGE_PX = 8
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
  originX: number
  orig: DateRange
  current: DateRange
  moved: boolean
}

function keyOf(kind: 'task' | 'project', id: string): string {
  return `${kind}:${id}`
}

/** Weekend shading, month gridlines, and the today line behind a row's bars. Top-level so it is a stable component. */
function TrackBg({
  height,
  weekends,
  months,
  todayLeft,
  px,
}: {
  height: number
  weekends: { offsetDays: number; days: number }[]
  months: Tick[]
  todayLeft: number
  px: number
}) {
  return (
    <>
      {weekends.map((w) => (
        <div
          key={w.offsetDays}
          data-testid="weekend"
          className="absolute top-0 bg-input-bg/60"
          style={{ left: w.offsetDays * px, width: w.days * px, height }}
        />
      ))}
      {months.map((tick) => (
        <div key={tick.iso} className="absolute top-0 w-px bg-border/30" style={{ left: tick.offsetDays * px, height }} />
      ))}
      <div className="absolute top-0 w-0.5 bg-accent/20" style={{ left: todayLeft, height }} />
    </>
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
}: TimelineGanttProps) {
  const { t, lang } = useI18n()
  const locale = lang === 'es' ? 'es-ES' : 'en-US'
  const today = todayProp ?? todayISO()
  const px = PX_PER_DAY[zoom]

  const range = useMemo(
    () =>
      computeRange(
        [
          ...projects.flatMap((p) => [p.start_date, p.end_date]),
          ...tasks.flatMap((tk) => [tk.start_date, tk.due_date]),
        ],
        today,
      ),
    [projects, tasks, today],
  )
  const trackW = totalDays(range) * px
  const months = useMemo(() => monthTicks(range), [range])
  const days = useMemo(() => (zoom === 'week' ? dayTicks(range) : []), [range, zoom])
  const weekends = useMemo(() => (zoom === 'week' ? weekendSpans(range) : []), [range, zoom])
  const todayLeft = diffDays(range.start, today) * px

  const [drag, setDrag] = useState<DragState | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const [overrides, setOverrides] = useState<Record<string, DateRange>>({})
  const scrollRef = useRef<HTMLDivElement>(null)

  // Scroll so today sits ~25% from the left of the track on mount and zoom change.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollLeft = Math.max(0, todayLeft - Math.max(0, el.clientWidth - LABEL_W) * 0.25)
  }, [zoom, todayLeft])

  // Escape cancels an in-progress drag.
  useEffect(() => {
    if (!drag) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        dragRef.current = null
        setDrag(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [drag])

  function fmt(iso: string): string {
    return parseDate(iso).toLocaleDateString(locale, { month: 'short', day: 'numeric' })
  }

  function monthLabel(iso: string): string {
    return parseDate(iso).toLocaleDateString(locale, { month: 'short', year: 'numeric' })
  }

  function displayRange(kind: 'task' | 'project', id: string, base: DateRange): DateRange {
    if (drag && drag.kind === kind && drag.id === id) return drag.current
    return overrides[keyOf(kind, id)] ?? base
  }

  // ---- drag handlers (tested in Task 4) ----
  function beginDrag(e: ReactPointerEvent<HTMLElement>, kind: 'task' | 'project', id: string, orig: DateRange) {
    if (!editable) return
    if (kind === 'project' && !canEditProjects) return
    if (e.button !== 0) return
    const edge = (e.target as HTMLElement).dataset.edge as 'start' | 'end' | undefined
    const st: DragState = { kind, id, mode: edge ?? 'move', originX: e.clientX, orig, current: orig, moved: false }
    dragRef.current = st
    setDrag(st)
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* jsdom has no pointer capture */
    }
    e.preventDefault()
  }

  function moveDrag(e: ReactPointerEvent<HTMLElement>) {
    const st = dragRef.current
    if (!st) return
    const dx = e.clientX - st.originX
    const moved = st.moved || Math.abs(dx) >= CLICK_PX
    const d = pxToDays(dx, px)
    const current = st.mode === 'move' ? shiftRange(st.orig, d) : resizeRange(st.orig, st.mode, d)
    const next: DragState = { ...st, current, moved }
    dragRef.current = next
    setDrag(next)
  }

  function endDrag() {
    const st = dragRef.current
    if (!st) return
    dragRef.current = null
    setDrag(null)
    if (!st.moved) {
      if (st.kind === 'task') onTaskClick?.(st.id)
      return
    }
    if (st.current.start === st.orig.start && st.current.end === st.orig.end) return
    const key = keyOf(st.kind, st.id)
    setOverrides((o) => ({ ...o, [key]: st.current }))
    const p =
      st.kind === 'task'
        ? onTaskDates?.(st.id, { start_date: st.current.start, due_date: st.current.end })
        : onProjectDates?.(st.id, { start_date: st.current.start, end_date: st.current.end })
    Promise.resolve(p)
      .catch(() => undefined)
      .finally(() =>
        setOverrides((o) => {
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
    <div className="bg-surface rounded-[14px] shadow-card border border-border overflow-hidden">
      <div ref={scrollRef} className="overflow-x-auto" data-testid="gantt-scroll">
        <div style={{ width: LABEL_W + trackW }}>
          {/* Header */}
          <div className="flex border-b border-border bg-input-bg/60">
            <div
              className="sticky left-0 z-10 bg-input-bg shrink-0 border-r border-border px-4 py-2.5"
              style={{ width: LABEL_W, minWidth: LABEL_W }}
            >
              <span className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">{t('timeline.projectTask')}</span>
            </div>
            <div className="relative h-9" style={{ width: trackW }}>
              {months.map((tick) => (
                <div key={tick.iso} className="absolute top-0 h-full flex items-start pt-1" style={{ left: tick.offsetDays * px }}>
                  <div className="h-full w-px bg-border/50" />
                  <span className="text-[10px] font-semibold text-text-muted ml-1.5 whitespace-nowrap">{monthLabel(tick.iso)}</span>
                </div>
              ))}
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

          {/* Rows */}
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
                <div className="flex items-stretch hover:bg-input-bg/30 transition-colors group">
                  <div
                    className="sticky left-0 z-10 bg-surface shrink-0 border-r border-border px-4 py-3 flex items-center gap-2 min-w-0"
                    style={{ width: LABEL_W, minWidth: LABEL_W }}
                  >
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                    <span className="text-[12px] font-semibold text-text-primary truncate">{project.name}</span>
                  </div>
                  <div className="relative h-10" style={{ width: trackW }}>
                    <TrackBg height={40} weekends={weekends} months={months} todayLeft={todayLeft} px={px} />
                    {projectRange && projectGeom && (
                      <div
                        role={editable && canEditProjects ? 'button' : undefined}
                        tabIndex={editable && canEditProjects ? 0 : undefined}
                        aria-label={`${project.name}: ${fmt(projectRange.start)} – ${fmt(projectRange.end)}`}
                        onPointerDown={(e) => beginDrag(e, 'project', project.id, baseProjectRange!)}
                        onPointerMove={moveDrag}
                        onPointerUp={endDrag}
                        className={`absolute top-1/2 -translate-y-1/2 h-5 rounded-full flex items-center px-2 overflow-hidden select-none ${
                          editable && canEditProjects ? 'cursor-grab' : ''
                        } ${projectDragging ? 'ring-2 ring-accent/40' : ''}`}
                        style={{ left: projectGeom.left, width: projectGeom.width, backgroundColor: color + '22', border: `2px solid ${color}` }}
                        title={`${project.name}: ${fmt(projectRange.start)} – ${fmt(projectRange.end)}`}
                      >
                        {editable && canEditProjects && (
                          <>
                            <span data-edge="start" className="absolute left-0 top-0 h-full cursor-ew-resize" style={{ width: EDGE_PX }} />
                            <span data-edge="end" className="absolute right-0 top-0 h-full cursor-ew-resize" style={{ width: EDGE_PX }} />
                          </>
                        )}
                        <span className="text-[9px] font-semibold whitespace-nowrap truncate" style={{ color }}>
                          {fmt(projectRange.start)} – {fmt(projectRange.end)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Dated task rows */}
                {dated.map(({ task, range: baseRange }) => {
                  const r = displayRange('task', task.id, baseRange)
                  const geom = barGeometry(r, range.start, px)
                  const colors = TASK_STATUS_COLORS[task.status] ?? TASK_STATUS_COLORS.todo
                  const dragging = isDragging('task', task.id)
                  return (
                    <div key={task.id} className="flex items-stretch hover:bg-input-bg/20 transition-colors">
                      <div
                        className="sticky left-0 z-10 bg-surface shrink-0 border-r border-border px-4 py-2 pl-8 flex items-center gap-2 min-w-0"
                        style={{ width: LABEL_W, minWidth: LABEL_W }}
                      >
                        <div className="w-1.5 h-1.5 rounded-full shrink-0 bg-border" />
                        <span className="text-[11px] text-text-secondary truncate">{task.title}</span>
                      </div>
                      <div className="relative h-8" style={{ width: trackW }}>
                        <TrackBg height={32} weekends={weekends} months={months} todayLeft={todayLeft} px={px} />
                        <button
                          type="button"
                          aria-label={`${task.title}: ${fmt(r.start)} – ${fmt(r.end)}`}
                          onPointerDown={(e) => beginDrag(e, 'task', task.id, baseRange)}
                          onPointerMove={moveDrag}
                          onPointerUp={endDrag}
                          onClick={(e) => onBarClick(e, 'task', task.id)}
                          className={`absolute top-1/2 -translate-y-1/2 h-4 rounded flex items-center px-1.5 overflow-hidden select-none text-left ${
                            editable ? 'cursor-grab' : 'cursor-default'
                          } ${dragging ? 'ring-2 ring-accent/40' : ''} focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60`}
                          style={{ left: geom.left, width: geom.width, backgroundColor: colors.bg, border: `1.5px solid ${colors.border}` }}
                          title={`${task.title}: ${fmt(r.start)} – ${fmt(r.end)}`}
                        >
                          {editable && (
                            <>
                              <span data-edge="start" className="absolute left-0 top-0 h-full cursor-ew-resize" style={{ width: EDGE_PX }} />
                              <span data-edge="end" className="absolute right-0 top-0 h-full cursor-ew-resize" style={{ width: EDGE_PX }} />
                            </>
                          )}
                          <span className="text-[9px] font-medium whitespace-nowrap truncate pointer-events-none" style={{ color: colors.border }}>
                            {dragging ? `${fmt(r.start)} – ${fmt(r.end)}` : task.title}
                          </span>
                        </button>
                      </div>
                    </div>
                  )
                })}

                {/* Not-scheduled tray */}
                {undated.length > 0 && (
                  <div className="flex items-stretch" data-testid="tray">
                    <div
                      className="sticky left-0 z-10 bg-surface shrink-0 border-r border-border px-4 py-2 pl-8 flex items-center min-w-0"
                      style={{ width: LABEL_W, minWidth: LABEL_W }}
                    >
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-text-muted truncate">
                        {t('timeline.notScheduled', { n: undated.length })}
                      </span>
                    </div>
                    <div className="sticky z-10 flex items-center gap-1.5 px-2 py-1.5 flex-wrap" style={{ left: LABEL_W }}>
                      {undated.map((task) => (
                        <button
                          key={task.id}
                          type="button"
                          disabled={!editable}
                          title={editable ? t('timeline.scheduleHint') : undefined}
                          onClick={() => {
                            if (!editable) return
                            onScheduleTask?.(task.id, { start_date: today, due_date: addDays(today, 6) })
                          }}
                          className="text-[10px] font-medium px-2 py-0.5 rounded-full border border-dashed border-border text-text-secondary bg-input-bg/40 hover:border-accent hover:text-accent transition-colors disabled:cursor-default disabled:hover:border-border disabled:hover:text-text-secondary"
                        >
                          {task.title}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
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
        {editable && (
          <span className="ml-auto text-[10px] text-text-muted hidden md:inline">{t('timeline.dragHint')}</span>
        )}
      </div>
    </div>
  )
}
