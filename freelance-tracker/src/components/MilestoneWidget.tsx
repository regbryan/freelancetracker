import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles, Calendar } from 'lucide-react'
import type { Project } from '../hooks/useProjects'
import type { Task } from '../hooks/useTasks'

interface MilestoneWidgetProps {
  projects: Project[]
  tasks: Task[]
}

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function formatRange(start: Date, end: Date): string {
  const s = `${MONTH_SHORT[start.getMonth()]} ${start.getDate()}`
  const e = `${MONTH_SHORT[end.getMonth()]} ${end.getDate()}`
  return `${s} — ${e}`
}

export default function MilestoneWidget({ projects, tasks }: MilestoneWidgetProps) {
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
    const taskProgress = projectTasks.length > 0
      ? Math.round((doneTasks / projectTasks.length) * 100)
      : null

    const totalMs = end.getTime() - start.getTime()
    const elapsedMs = now.getTime() - start.getTime()
    const timeProgress = totalMs > 0
      ? Math.max(0, Math.min(100, Math.round((elapsedMs / totalMs) * 100)))
      : 0

    const progress = taskProgress ?? timeProgress

    return {
      project,
      start,
      end,
      progress,
      source: taskProgress !== null ? 'tasks' : 'time' as const,
    }
  }, [projects, tasks])

  if (!milestone) {
    return (
      <div
        className="rounded-xl p-5 h-full flex flex-col justify-between text-white overflow-hidden relative shadow-card"
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

  const { project, start, end, progress } = milestone

  return (
    <button
      onClick={() => navigate(`/projects/${project.id}`)}
      className="rounded-xl p-5 h-full flex flex-col justify-between text-white overflow-hidden relative shadow-card text-left hover:shadow-card-hover transition-all active:scale-[0.995]"
      style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 55%, #3b82f6 100%)' }}
    >
      {/* Decorative glow */}
      <div
        className="absolute -top-16 -right-16 w-48 h-48 rounded-full opacity-30 pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.4) 0%, transparent 70%)' }}
      />

      <div className="flex items-start justify-between gap-3 relative">
        <div className="min-w-0">
          <p className="text-white/70 text-[10px] font-semibold uppercase tracking-wide">Next Milestone</p>
          <p className="text-white text-[16px] font-bold mt-1 leading-tight truncate">
            {project.name}
          </p>
          {project.clients?.name && (
            <p className="text-white/70 text-[11px] mt-0.5 truncate">
              {project.clients.name}
            </p>
          )}
        </div>
        <Sparkles size={18} className="text-white/90 shrink-0" />
      </div>

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
        <div className="flex items-center gap-1.5 mt-2.5 text-white/80 text-[11px]">
          <Calendar size={11} />
          <span>{formatRange(start, end)}</span>
        </div>
      </div>
    </button>
  )
}
