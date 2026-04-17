import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles, Calendar, Clock, CheckCircle2, Circle } from 'lucide-react'
import type { Project } from '../hooks/useProjects'
import type { Task } from '../hooks/useTasks'
import type { TimeEntry } from '../hooks/useTimeEntries'

interface MilestoneWidgetProps {
  projects: Project[]
  tasks: Task[]
  entries?: TimeEntry[]
}

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function formatRange(start: Date, end: Date): string {
  const s = `${MONTH_SHORT[start.getMonth()]} ${start.getDate()}`
  const e = `${MONTH_SHORT[end.getMonth()]} ${end.getDate()}`
  return `${s} — ${e}`
}

export default function MilestoneWidget({ projects, tasks, entries = [] }: MilestoneWidgetProps) {
  const navigate = useNavigate()

  const milestone = useMemo(() => {
    const now = new Date()
    const candidates = projects
      .filter(p => p.status === 'active' && p.end_date)
      .map(p => ({ project: p, end: new Date(p.end_date!) }))
      .filter(({ end }) => end >= now)
      .sort((a, b) => a.end.getTime() - b.end.getTime())

    if (candidates.length === 0) return null

    const { project, end } = candidates[0]
    const start = project.start_date
      ? new Date(project.start_date)
      : new Date(project.created_at)

    const projectTasks = tasks.filter(t => t.project_id === project.id)
    const doneTasks = projectTasks.filter(t => t.status === 'done').length
    const totalTasks = projectTasks.length
    const taskProgress = totalTasks > 0
      ? Math.round((doneTasks / totalTasks) * 100)
      : null

    const totalMs = end.getTime() - start.getTime()
    const elapsedMs = now.getTime() - start.getTime()
    const timeProgress = totalMs > 0
      ? Math.max(0, Math.min(100, Math.round((elapsedMs / totalMs) * 100)))
      : 0

    const progress = taskProgress ?? timeProgress

    const daysRemaining = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))

    const hoursLogged = entries
      .filter(e => e.project_id === project.id)
      .reduce((s, e) => s + e.hours, 0)

    const nextTask = projectTasks
      .filter(t => t.status !== 'done')
      .sort((a, b) => {
        if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date)
        if (a.due_date) return -1
        if (b.due_date) return 1
        return 0
      })[0]

    return {
      project,
      start,
      end,
      progress,
      daysRemaining,
      hoursLogged,
      doneTasks,
      totalTasks,
      nextTask,
    }
  }, [projects, tasks, entries])

  if (!milestone) {
    return (
      <div
        className="rounded-xl p-5 h-full w-full min-w-0 flex flex-col justify-between text-white overflow-hidden relative shadow-card min-h-[260px]"
        style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 55%, #3b82f6 100%)' }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-white/70 text-[11px] font-semibold uppercase tracking-wide">Next Milestone</p>
            <p className="text-white text-[15px] font-bold mt-1">No active deadlines</p>
          </div>
          <Sparkles size={18} className="text-white/70 shrink-0" />
        </div>
        <p className="text-white/70 text-[11px] mt-4">
          Set an end date on an active project to see your next milestone.
        </p>
      </div>
    )
  }

  const { project, start, end, progress, daysRemaining, hoursLogged, doneTasks, totalTasks, nextTask } = milestone

  return (
    <button
      onClick={() => navigate(`/projects/${project.id}`)}
      className="rounded-xl p-5 h-full w-full min-w-0 flex flex-col text-white overflow-hidden relative shadow-card text-left hover:shadow-card-hover transition-all active:scale-[0.995] min-h-[260px]"
      style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 55%, #3b82f6 100%)' }}
    >
      {/* Decorative glow */}
      <div
        className="absolute -top-20 -right-20 w-56 h-56 rounded-full opacity-30 pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.4) 0%, transparent 70%)' }}
      />
      <div
        className="absolute -bottom-24 -left-16 w-48 h-48 rounded-full opacity-20 pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.3) 0%, transparent 70%)' }}
      />

      {/* Header */}
      <div className="flex items-start justify-between gap-3 relative">
        <div className="min-w-0">
          <p className="text-white/70 text-[10px] font-semibold uppercase tracking-wide">Next Milestone</p>
          <p className="text-white text-[17px] font-bold mt-1 leading-tight truncate">
            {project.name}
          </p>
          {project.clients?.name && (
            <p className="text-white/70 text-[11px] mt-0.5 truncate">
              {project.clients.name}
            </p>
          )}
        </div>
        <div className="shrink-0 flex flex-col items-end gap-1">
          <Sparkles size={18} className="text-white/90" />
          <span className="text-white text-[11px] font-bold bg-white/15 px-2 py-0.5 rounded-full whitespace-nowrap">
            {daysRemaining}d left
          </span>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 mt-4 relative">
        <div>
          <p className="text-white/60 text-[9px] font-semibold uppercase tracking-wider">Hours</p>
          <p className="text-white text-[14px] font-bold flex items-center gap-1 mt-0.5">
            <Clock size={11} className="text-white/70" />
            {hoursLogged.toFixed(1)}
          </p>
        </div>
        <div>
          <p className="text-white/60 text-[9px] font-semibold uppercase tracking-wider">Tasks</p>
          <p className="text-white text-[14px] font-bold mt-0.5">
            {doneTasks}/{totalTasks || 0}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="relative mt-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-white/80 text-[11px] font-medium">Progress</span>
          <span className="text-white text-[12px] font-bold">{progress}%</span>
        </div>
        <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
          <div
            className="h-full bg-white rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Next task preview */}
      {nextTask && (
        <div className="relative mt-3 pt-3 border-t border-white/15">
          <p className="text-white/60 text-[9px] font-semibold uppercase tracking-wider mb-1">Up Next</p>
          <div className="flex items-center gap-1.5 min-w-0">
            <Circle size={10} className="text-white/70 shrink-0" />
            <span className="text-white text-[11.5px] font-medium truncate">
              {nextTask.title}
            </span>
          </div>
        </div>
      )}
      {!nextTask && totalTasks > 0 && doneTasks === totalTasks && (
        <div className="relative mt-3 pt-3 border-t border-white/15">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 size={11} className="text-white/90" />
            <span className="text-white/90 text-[11.5px] font-medium">
              All tasks complete
            </span>
          </div>
        </div>
      )}

      {/* Footer — date range */}
      <div className="relative mt-auto pt-4">
        <div className="flex items-center gap-1.5 text-white/80 text-[11px]">
          <Calendar size={11} />
          <span>{formatRange(start, end)}</span>
        </div>
      </div>
    </button>
  )
}
