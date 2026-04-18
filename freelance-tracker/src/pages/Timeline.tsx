import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, ChevronRight } from 'lucide-react'
import { useProjects } from '../hooks/useProjects'
import { useTasks } from '../hooks/useTasks'
import TimelineInsight from '../components/TimelineInsight'

function TimelineHero({ activeCount, endingSoon }: { activeCount: number; endingSoon: number }) {
  return (
    <div
      className="rounded-[16px] text-white relative overflow-hidden"
      style={{
        backgroundColor: '#0a1223',
        backgroundImage: 'url(/timeline-hero.webp)',
        backgroundSize: 'cover',
        backgroundPosition: 'center 35%',
        minHeight: '160px',
      }}
    >
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(90deg, rgba(10,18,35,0.82) 0%, rgba(10,18,35,0.55) 60%, rgba(10,18,35,0.20) 100%)' }}
      />
      <div className="relative z-10 px-7 py-7 max-w-2xl">
        <p className="text-white/60 text-[10px] font-semibold uppercase tracking-[2px]">Your Runway</p>
        <h1 className="text-[24px] font-bold tracking-[-0.4px] text-white mt-1.5">Timeline</h1>
        <p className="text-white/75 text-[13px] mt-2 leading-relaxed italic">
          "Time is the axis — every commitment casts a shadow forward."
        </p>
        <p className="text-white/60 text-[12px] mt-3">
          {activeCount} active {activeCount === 1 ? 'project' : 'projects'}
          {endingSoon > 0 ? ` · ${endingSoon} ending in 14 days` : ''}
        </p>
      </div>
    </div>
  )
}

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

function parseDate(iso: string): Date {
  return new Date(iso + 'T00:00:00')
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function monthLabel(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

export default function Timeline() {
  const navigate = useNavigate()
  const { projects, loading: projectsLoading } = useProjects()
  const { tasks, loading: tasksLoading } = useTasks()

  const loading = projectsLoading || tasksLoading

  // Projects that have at least a start or end date
  const datedProjects = useMemo(
    () => projects.filter((p) => p.start_date || p.end_date),
    [projects],
  )

  // Compute time range
  const { minDate, maxDate, totalDays } = useMemo(() => {
    const today = new Date()
    const allDates: Date[] = [addDays(today, -30), addDays(today, 90)]

    for (const p of datedProjects) {
      if (p.start_date) allDates.push(parseDate(p.start_date))
      if (p.end_date) allDates.push(parseDate(p.end_date))
    }
    for (const t of tasks) {
      if (t.start_date) allDates.push(parseDate(t.start_date))
      if (t.due_date) allDates.push(parseDate(t.due_date))
    }

    const min = addDays(new Date(Math.min(...allDates.map((d) => d.getTime()))), -7)
    const max = addDays(new Date(Math.max(...allDates.map((d) => d.getTime()))), 14)
    min.setHours(0, 0, 0, 0)
    max.setHours(0, 0, 0, 0)
    const total = Math.max(1, Math.round((max.getTime() - min.getTime()) / 86400000))
    return { minDate: min, maxDate: max, totalDays: total }
  }, [datedProjects, tasks])

  // Month tick marks
  const monthTicks = useMemo(() => {
    const ticks: { label: string; left: number }[] = []
    let cur = startOfMonth(minDate)
    while (cur <= maxDate) {
      const left = ((cur.getTime() - minDate.getTime()) / 86400000 / totalDays) * 100
      ticks.push({ label: monthLabel(cur), left })
      cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1)
    }
    return ticks
  }, [minDate, maxDate, totalDays])

  // Today marker
  const todayLeft = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    return Math.max(0, Math.min(100, ((today.getTime() - minDate.getTime()) / 86400000 / totalDays) * 100))
  }, [minDate, totalDays])

  function barProps(start: string | null, end: string | null, fallback: string | null) {
    const s = start ? parseDate(start) : end ? parseDate(end) : fallback ? parseDate(fallback) : null
    const e = end ? parseDate(end) : start ? parseDate(start) : fallback ? parseDate(fallback) : null
    if (!s || !e) return null
    const left = Math.max(0, ((s.getTime() - minDate.getTime()) / 86400000 / totalDays) * 100)
    const right = Math.min(100, ((e.getTime() - minDate.getTime()) / 86400000 / totalDays) * 100)
    const width = Math.max(0.5, right - left)
    return { left: `${left}%`, width: `${width}%` }
  }

  function formatDate(iso: string | null) {
    if (!iso) return ''
    return parseDate(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const LABEL_W = 220

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-accent" />
      </div>
    )
  }

  const activeCount = projects.filter((p) => p.status === 'active').length
  const endingSoon = projects.filter((p) => {
    if (p.status !== 'active' || !p.end_date) return false
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const days = Math.ceil((parseDate(p.end_date).getTime() - today.getTime()) / 86400000)
    return days >= 0 && days <= 14
  }).length

  if (datedProjects.length === 0) {
    return (
      <div className="p-6 flex flex-col gap-5">
        <TimelineHero activeCount={activeCount} endingSoon={endingSoon} />
        <div className="bg-surface rounded-[14px] shadow-card border border-border p-12 flex flex-col items-center justify-center gap-3">
          <p className="text-text-muted text-[13px]">No projects have start or end dates yet.</p>
          <p className="text-text-muted text-[12px]">Open a project, click Edit, and set its start and end dates to see them here.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 flex flex-col gap-5">
      {/* Editorial Hero */}
      <TimelineHero activeCount={activeCount} endingSoon={endingSoon} />

      {/* Runway Insight */}
      <TimelineInsight projects={projects} tasks={tasks} />

      <div className="bg-surface rounded-[14px] shadow-card border border-border overflow-hidden">
        {/* Scrollable grid */}
        <div className="overflow-x-auto">
          <div style={{ minWidth: `${LABEL_W + 900}px` }}>

            {/* Header row — month labels */}
            <div className="flex border-b border-border bg-input-bg/60">
              {/* Label column spacer */}
              <div style={{ width: LABEL_W, minWidth: LABEL_W }} className="border-r border-border shrink-0 px-4 py-2.5">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">Project / Task</span>
              </div>
              {/* Time axis */}
              <div className="relative flex-1 h-9">
                {monthTicks.map((tick) => (
                  <div
                    key={tick.label}
                    className="absolute top-0 h-full flex items-center"
                    style={{ left: `${tick.left}%` }}
                  >
                    <div className="h-full w-px bg-border/50" />
                    <span className="text-[10px] font-semibold text-text-muted ml-1.5 whitespace-nowrap">{tick.label}</span>
                  </div>
                ))}
                {/* Today line in header */}
                <div
                  className="absolute top-0 h-full w-0.5 bg-accent/60"
                  style={{ left: `${todayLeft}%` }}
                />
              </div>
            </div>

            {/* Project rows */}
            {datedProjects.map((project) => {
              const projectTasks = tasks.filter((t) => t.project_id === project.id && (t.start_date || t.due_date))
              const projectBar = barProps(project.start_date, project.end_date, null)
              const color = STATUS_COLORS[project.status] ?? '#3e6b5a'

              return (
                <div key={project.id} className="border-b border-border last:border-0">
                  {/* Project row */}
                  <div className="flex items-center hover:bg-input-bg/30 transition-colors group">
                    <div
                      style={{ width: LABEL_W, minWidth: LABEL_W }}
                      className="border-r border-border shrink-0 px-4 py-3 flex items-center gap-2 min-w-0"
                    >
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                      <button
                        onClick={() => navigate(`/projects/${project.id}`)}
                        className="text-[12px] font-semibold text-text-primary truncate hover:underline text-left flex items-center gap-1"
                      >
                        {project.name}
                        <ChevronRight size={10} className="text-text-muted shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    </div>
                    <div className="relative flex-1 h-10">
                      {/* Grid lines */}
                      {monthTicks.map((tick) => (
                        <div
                          key={tick.label}
                          className="absolute top-0 h-full w-px bg-border/30"
                          style={{ left: `${tick.left}%` }}
                        />
                      ))}
                      {/* Today line */}
                      <div
                        className="absolute top-0 h-full w-0.5 bg-accent/20"
                        style={{ left: `${todayLeft}%` }}
                      />
                      {/* Project bar */}
                      {projectBar && (
                        <div
                          className="absolute top-1/2 -translate-y-1/2 h-5 rounded-full flex items-center px-2 overflow-hidden"
                          style={{ left: projectBar.left, width: projectBar.width, backgroundColor: color + '22', border: `2px solid ${color}` }}
                          title={`${project.name}: ${formatDate(project.start_date)} – ${formatDate(project.end_date)}`}
                        >
                          <span className="text-[9px] font-semibold whitespace-nowrap truncate" style={{ color }}>
                            {formatDate(project.start_date)} – {formatDate(project.end_date)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Task sub-rows */}
                  {projectTasks.map((task) => {
                    const taskBar = barProps(task.start_date, task.due_date, task.due_date)
                    const colors = TASK_STATUS_COLORS[task.status] ?? TASK_STATUS_COLORS.todo
                    return (
                      <div key={task.id} className="flex items-center hover:bg-input-bg/20 transition-colors">
                        <div
                          style={{ width: LABEL_W, minWidth: LABEL_W }}
                          className="border-r border-border shrink-0 px-4 py-2 flex items-center gap-2 min-w-0 pl-8"
                        >
                          <div className="w-1.5 h-1.5 rounded-full shrink-0 bg-border" />
                          <span className="text-[11px] text-text-secondary truncate">{task.title}</span>
                        </div>
                        <div className="relative flex-1 h-8">
                          {monthTicks.map((tick) => (
                            <div
                              key={tick.label}
                              className="absolute top-0 h-full w-px bg-border/30"
                              style={{ left: `${tick.left}%` }}
                            />
                          ))}
                          <div
                            className="absolute top-0 h-full w-0.5 bg-accent/20"
                            style={{ left: `${todayLeft}%` }}
                          />
                          {taskBar && (
                            <div
                              className="absolute top-1/2 -translate-y-1/2 h-4 rounded flex items-center px-1.5 overflow-hidden"
                              style={{
                                left: taskBar.left,
                                width: taskBar.width,
                                backgroundColor: colors.bg,
                                border: `1.5px solid ${colors.border}`,
                              }}
                              title={`${task.title}: ${formatDate(task.start_date)} – ${formatDate(task.due_date)}`}
                            >
                              <span className="text-[9px] font-medium whitespace-nowrap truncate" style={{ color: colors.border }}>
                                {task.title}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })}

          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 px-4 py-2.5 border-t border-border bg-input-bg/30 flex-wrap">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">Legend</span>
          {(['active', 'completed', 'on_hold'] as const).map((s) => (
            <div key={s} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: STATUS_COLORS[s] }} />
              <span className="text-[11px] text-text-secondary capitalize">{s.replace('_', ' ')}</span>
            </div>
          ))}
          <div className="w-px h-4 bg-border mx-1" />
          <div className="flex items-center gap-1.5">
            <div className="w-8 h-2.5 rounded" style={{ backgroundColor: TASK_STATUS_COLORS.done.bg, border: `1.5px solid ${TASK_STATUS_COLORS.done.border}` }} />
            <span className="text-[11px] text-text-secondary">Done</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-8 h-2.5 rounded" style={{ backgroundColor: TASK_STATUS_COLORS.in_progress.bg, border: `1.5px solid ${TASK_STATUS_COLORS.in_progress.border}` }} />
            <span className="text-[11px] text-text-secondary">In Progress</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-8 h-2.5 rounded" style={{ backgroundColor: TASK_STATUS_COLORS.todo.bg, border: `1.5px solid ${TASK_STATUS_COLORS.todo.border}` }} />
            <span className="text-[11px] text-text-secondary">To Do</span>
          </div>
          <div className="w-px h-4 bg-border mx-1" />
          <div className="flex items-center gap-1.5">
            <div className="w-0.5 h-4 bg-accent/60" />
            <span className="text-[11px] text-text-secondary">Today</span>
          </div>
        </div>
      </div>
    </div>
  )
}
