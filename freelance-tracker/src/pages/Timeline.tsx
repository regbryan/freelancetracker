import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Loader2, AlertCircle, X } from 'lucide-react'
import { useProjects } from '../hooks/useProjects'
import { useTasks } from '../hooks/useTasks'
import { useRole } from '../hooks/useWorkspaceRole'
import TimelineInsight from '../components/TimelineInsight'
import WorkTabs from '../components/WorkTabs'
import TimelineGantt from '../components/TimelineGantt'
import TaskForm, { type TaskFormData } from '../components/TaskForm'
import { diffDays, todayISO, type Zoom } from '../lib/timelineMath'
import { useI18n } from '../lib/i18n'

const ZOOMS: Zoom[] = ['week', 'month', 'quarter']
const ZOOM_KEY = 'timeline.zoom'
const REFRESH_MS = 60_000
/** Focus and visibilitychange often fire together; don't refetch twice for one return. */
const REFRESH_MIN_GAP_MS = 5_000

/**
 * The dialog's copy of a task, snapshotted once when the bar is clicked.
 * Deriving it from `tasks` every render would hand TaskForm a new object on
 * each refetch, and TaskForm resets its fields whenever `task` identity changes.
 */
type DialogTask = {
  id: string
  title: string
  description?: string
  status: string
  priority: string
  startDate?: string
  dueDate?: string
  projectId?: string
}

function readZoom(): Zoom {
  try {
    const v = localStorage.getItem(ZOOM_KEY)
    return v === 'week' || v === 'month' || v === 'quarter' ? v : 'month'
  } catch {
    return 'month'
  }
}

function TimelineHero({ activeCount, endingSoon }: { activeCount: number; endingSoon: number }) {
  const { t } = useI18n()
  return (
    <div className="rounded-[16px] text-white relative overflow-hidden" style={{ backgroundColor: '#0a1223', minHeight: '160px' }}>
      <img
        src="/timeline-hero.webp"
        alt=""
        aria-hidden="true"
        fetchPriority="high"
        loading="eager"
        decoding="sync"
        className="absolute inset-0 w-full h-full object-cover"
        style={{ objectPosition: 'center 35%' }}
      />
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(90deg, rgba(10,18,35,0.82) 0%, rgba(10,18,35,0.55) 60%, rgba(10,18,35,0.20) 100%)' }}
      />
      <div className="relative z-10 px-7 py-7 max-w-2xl">
        <p className="text-white/60 text-[10px] font-semibold uppercase tracking-[2px]">{t('timeline.yourRunway')}</p>
        <h1 className="text-[24px] font-bold tracking-[-0.4px] text-white mt-1.5">{t('timeline.title')}</h1>
        <p className="text-white/75 text-[13px] mt-2 leading-relaxed italic">{t('timeline.heroQuote')}</p>
        <p className="text-white/60 text-[12px] mt-3">
          {activeCount === 1 ? t('timeline.activeProject', { n: activeCount }) : t('timeline.activeProjects', { n: activeCount })}
          {endingSoon > 0 ? t('timeline.endingIn14', { n: endingSoon }) : ''}
        </p>
      </div>
    </div>
  )
}

export default function Timeline() {
  const { t } = useI18n()
  const role = useRole()
  const [searchParams, setSearchParams] = useSearchParams()
  const { projects, loading: projectsLoading, error: projectsError, updateProject } = useProjects()
  const { tasks, loading: tasksLoading, error: tasksError, updateTask, refetch: refetchTasks } = useTasks()

  const [ready, setReady] = useState(false)

  const [zoom, setZoom] = useState<Zoom>(readZoom)
  useEffect(() => {
    try {
      localStorage.setItem(ZOOM_KEY, zoom)
    } catch {
      /* private mode */
    }
  }, [zoom])

  const projectFilter = searchParams.get('project') ?? ''
  function setProjectFilter(id: string) {
    const next = new URLSearchParams(searchParams)
    if (id) next.set('project', id)
    else next.delete('project')
    setSearchParams(next, { replace: true })
  }

  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!error) return
    const id = setTimeout(() => setError(null), 6000)
    return () => clearTimeout(id)
  }, [error])

  // Two people may be editing: refresh when the tab comes back and every minute,
  // but never while the tab is hidden, and never twice for the same return.
  useEffect(() => {
    let last = 0
    function refresh() {
      if (document.visibilityState !== 'visible') return
      const now = Date.now()
      if (now - last < REFRESH_MIN_GAP_MS) return
      last = now
      refetchTasks()
    }
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    const id = setInterval(refresh, REFRESH_MS)
    return () => {
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
      clearInterval(id)
    }
  }, [refetchTasks])

  const [dialogTask, setDialogTask] = useState<DialogTask | null>(null)
  /** Set when a dialog save is rejected, so the close TaskForm asks for is ignored once. */
  const saveFailedRef = useRef(false)

  // A `?project=` id left over from a deleted project would otherwise hide every row.
  const effectiveFilter = projectFilter && projects.some((p) => p.id === projectFilter) ? projectFilter : ''

  const visibleProjects = useMemo(
    () => (effectiveFilter ? projects.filter((p) => p.id === effectiveFilter) : projects),
    [projects, effectiveFilter],
  )
  const visibleTasks = useMemo(() => {
    const ids = new Set(visibleProjects.map((p) => p.id))
    return tasks.filter((tk) => ids.has(tk.project_id))
  }, [tasks, visibleProjects])

  // Adjusting state during render (React's documented pattern) rather than in an
  // effect: the first painted frame is already the real page, not a spinner.
  if (!ready && !projectsLoading && !tasksLoading) setReady(true)

  function failMessage(err: unknown): string {
    return t('timeline.saveFailed', { error: err instanceof Error ? err.message : String(err) })
  }

  async function saveTaskDates(id: string, dates: { start_date: string; due_date: string }) {
    try {
      await updateTask(id, dates)
    } catch (err) {
      setError(failMessage(err))
      throw err
    }
  }

  async function saveProjectDates(id: string, dates: { start_date: string; end_date: string }) {
    try {
      await updateProject(id, dates)
    } catch (err) {
      setError(failMessage(err))
      throw err
    }
  }

  if (!ready) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-accent" />
      </div>
    )
  }

  const today = todayISO()
  const activeCount = projects.filter((p) => p.status === 'active').length
  const endingSoon = projects.filter((p) => {
    if (p.status !== 'active' || !p.end_date) return false
    const days = diffDays(today, p.end_date)
    return days >= 0 && days <= 14
  }).length
  const fetchError = projectsError ?? tasksError

  return (
    <div className="p-6 flex flex-col gap-5">
      <TimelineHero activeCount={activeCount} endingSoon={endingSoon} />
      <WorkTabs />
      {role === 'owner' && <TimelineInsight projects={projects} tasks={tasks} />}

      {/* Controls */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <label className="flex items-center gap-2 text-[12px] text-text-secondary">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">{t('timeline.filterProject')}</span>
          <select
            value={effectiveFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="h-8 rounded-lg border border-border bg-surface px-2 text-[12px] text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/30"
          >
            <option value="">{t('timeline.allProjects')}</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">{t('timeline.zoomLabel')}</span>
          <div role="radiogroup" aria-label={t('timeline.zoomLabel')} className="inline-flex rounded-lg border border-border bg-surface p-0.5">
            {ZOOMS.map((z) => {
              const key = z === 'week' ? 'timeline.zoomWeek' : z === 'month' ? 'timeline.zoomMonth' : 'timeline.zoomQuarter'
              const active = z === zoom
              return (
                <button
                  key={z}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setZoom(z)}
                  className={`px-2.5 h-7 rounded-md text-[11px] font-semibold transition-colors ${
                    active ? 'text-white' : 'text-text-muted hover:text-text-primary'
                  }`}
                  style={active ? { background: 'linear-gradient(135deg, #305445 0%, #3e6b5a 100%)' } : undefined}
                >
                  {t(key)}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {error && (
        <div role="alert" className="flex items-center gap-2 bg-negative-bg text-negative rounded-[12px] px-4 py-2.5 text-[12px]">
          <AlertCircle size={14} />
          <span className="flex-1">{error}</span>
          <button type="button" onClick={() => setError(null)} aria-label={t('common.close')} className="p-1 rounded hover:bg-negative/10">
            <X size={12} />
          </button>
        </div>
      )}

      {/* A failed fetch is not an empty workspace — say so, and don't auto-dismiss it. */}
      {fetchError && (
        <div role="alert" className="flex items-center gap-2 bg-negative-bg text-negative rounded-[12px] px-4 py-2.5 text-[12px]">
          <AlertCircle size={14} />
          <span className="flex-1">{fetchError}</span>
        </div>
      )}

      {projects.length === 0 && !fetchError ? (
        <div className="bg-surface rounded-[14px] shadow-card border border-border p-12 flex items-center justify-center">
          <p className="text-text-muted text-[13px]">{t('timeline.empty')}</p>
        </div>
      ) : (
        <TimelineGantt
          projects={visibleProjects}
          tasks={visibleTasks}
          zoom={zoom}
          editable
          canEditProjects={role === 'owner'}
          onTaskDates={saveTaskDates}
          onProjectDates={saveProjectDates}
          onScheduleTask={saveTaskDates}
          onTaskClick={(id) => {
            const tk = tasks.find((x) => x.id === id)
            if (!tk) return
            setDialogTask({
              id: tk.id,
              title: tk.title,
              description: tk.description ?? undefined,
              status: tk.status,
              priority: tk.priority,
              startDate: tk.start_date ?? undefined,
              dueDate: tk.due_date ?? undefined,
              projectId: tk.project_id,
            })
          }}
        />
      )}

      <TaskForm
        open={dialogTask !== null}
        onOpenChange={(open) => {
          if (open) return
          // TaskForm asks to close as soon as onSave settles. After a failed save
          // we swallow that one request so the dialog stays put with the user's
          // edits; a later Cancel or Escape closes normally.
          if (saveFailedRef.current) {
            saveFailedRef.current = false
            return
          }
          setDialogTask(null)
        }}
        task={dialogTask}
        onSave={async (data: TaskFormData) => {
          if (!dialogTask) return
          saveFailedRef.current = false
          try {
            await updateTask(dialogTask.id, {
              title: data.title,
              description: data.description ?? null,
              status: data.status,
              priority: data.priority,
              start_date: data.startDate ?? null,
              due_date: data.dueDate ?? null,
            })
          } catch (err) {
            setError(failMessage(err))
            saveFailedRef.current = true
            return
          }
          setDialogTask(null)
        }}
      />
    </div>
  )
}
