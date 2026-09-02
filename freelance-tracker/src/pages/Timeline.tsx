import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Loader2, AlertCircle, X, Printer } from 'lucide-react'
import { useProjects } from '../hooks/useProjects'
import { useTasks } from '../hooks/useTasks'
import { useMilestones } from '../hooks/useMilestones'
import { useRole } from '../hooks/useWorkspaceRole'
import WorkTabs from '../components/WorkTabs'
import TimelineGantt from '../components/TimelineGantt'
import TaskForm, { type TaskFormData } from '../components/TaskForm'
import MilestoneForm, { type MilestoneFormData, type MilestoneFormMilestone } from '../components/MilestoneForm'
import { sortMilestones } from '../lib/milestones'
import { computeContentRange, parseDate, todayISO, type Zoom } from '../lib/timelineMath'
import { OVERVIEW, resolveSelection } from '../lib/timelineSelection'
import { useI18n } from '../lib/i18n'

const ZOOMS: Zoom[] = ['week', 'month', 'quarter']
const ZOOM_KEY = 'timeline.zoom'
const HIDE_DONE_KEY = 'timeline.hideDone'
const LAST_PROJECT_KEY = 'timeline.lastProject'
/** One entry per project: which milestones the user left open there. */
const EXPANDED_KEY = 'timeline.expanded.'
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
  /** Carried for completeness only — TaskForm shows its project picker only when passed a `projects` prop, which this page does not do. */
  projectId?: string
  /** Pre-selects the milestone picker when the project has milestones. */
  milestoneId?: string | null
}

/** Week is the default: a month of one-day tasks is a row of slivers nobody can grab. */
function readZoom(): Zoom {
  try {
    const v = localStorage.getItem(ZOOM_KEY)
    return v === 'week' || v === 'month' || v === 'quarter' ? v : 'week'
  } catch {
    return 'week'
  }
}

/**
 * Done tasks are history, not plan: 122 mostly-finished one-day tasks buried the
 * handful that still matter, so the filter defaults on and only 'false' turns it off.
 */
function readHideDone(): boolean {
  try {
    return localStorage.getItem(HIDE_DONE_KEY) !== 'false'
  } catch {
    return true
  }
}

function readLastProject(): string | null {
  try {
    return localStorage.getItem(LAST_PROJECT_KEY)
  } catch {
    return null
  }
}

function writeLastProject(id: string) {
  try {
    localStorage.setItem(LAST_PROJECT_KEY, id)
  } catch {
    /* private mode */
  }
}

/**
 * Which milestones are open, per project. Stored as a JSON array of ids: whatever a
 * previous session left behind is treated as noise unless it is exactly that.
 */
function readExpanded(projectId: string): ReadonlySet<string> {
  try {
    const raw = localStorage.getItem(EXPANDED_KEY + projectId)
    if (!raw) return new Set<string>()
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return new Set<string>()
    return new Set(parsed.filter((x): x is string => typeof x === 'string'))
  } catch {
    return new Set<string>()
  }
}

function writeExpanded(projectId: string, ids: ReadonlySet<string>) {
  try {
    localStorage.setItem(EXPANDED_KEY + projectId, JSON.stringify([...ids]))
  } catch {
    /* private mode */
  }
}

/**
 * Min/max of the dates actually on screen. The header states the plan's own span,
 * so it uses the raw bounds, not the padded track computeContentRange draws.
 */
function contentBounds(dates: Array<string | null | undefined>): { min: string; max: string } | null {
  let min: string | null = null
  let max: string | null = null
  for (const d of dates) {
    if (!d) continue
    if (min === null || d < min) min = d
    if (max === null || d > max) max = d
  }
  return min !== null && max !== null ? { min, max } : null
}

export default function Timeline() {
  const { t, lang } = useI18n()
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

  const [hideDone, setHideDone] = useState<boolean>(readHideDone)
  useEffect(() => {
    try {
      localStorage.setItem(HIDE_DONE_KEY, String(hideDone))
    } catch {
      /* private mode */
    }
  }, [hideDone])

  // Read storage once. After the first render the URL is the source of truth, and
  // re-reading would let a sibling tab yank this one to a different project.
  const [storedProject] = useState(readLastProject)
  const paramProject = searchParams.get('project')
  const selection = useMemo(
    () => resolveSelection(paramProject, storedProject, projects),
    [paramProject, storedProject, projects],
  )
  const isOverview = selection === OVERVIEW

  // The selected project's milestones while planning it; every milestone in Overview,
  // where they are drawn as diamonds on the project bars.
  const {
    milestones,
    createMilestone,
    updateMilestone,
    deleteMilestone,
    refetch: refetchMilestones,
  } = useMilestones(isOverview ? undefined : selection)

  // Which milestones are open, seeded from this project's stored set and reset when the
  // project changes. Adjusting state during render (React's documented pattern) rather
  // than in an effect, so the first paint of a project is already its remembered shape.
  const [expandedFor, setExpandedFor] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set<string>())
  if (expandedFor !== selection) {
    setExpandedFor(selection)
    setExpanded(readExpanded(selection))
  }

  function toggleMilestone(id: string) {
    const next = new Set(expanded)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setExpanded(next)
    writeExpanded(selection, next)
  }

  function selectProject(id: string) {
    const next = new URLSearchParams(searchParams)
    next.set('project', id)
    setSearchParams(next, { replace: true })
    writeLastProject(id)
  }

  // `?project=` is what makes a view shareable, so whatever was resolved — from the
  // param, from storage, or from the "newest active project" fallback — goes back
  // into the URL. Waiting for the projects to load keeps an empty list from
  // resolving to Overview and pinning the page there.
  useEffect(() => {
    if (projectsLoading) return
    writeLastProject(selection)
    if (paramProject === selection) return
    const next = new URLSearchParams(searchParams)
    next.set('project', selection)
    setSearchParams(next, { replace: true })
  }, [selection, paramProject, projectsLoading, searchParams, setSearchParams])

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
      refetchMilestones()
    }
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    const id = setInterval(refresh, REFRESH_MS)
    return () => {
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
      clearInterval(id)
    }
  }, [refetchTasks, refetchMilestones])

  const [dialogTask, setDialogTask] = useState<DialogTask | null>(null)
  /** Open when non-null; `milestone: null` is the create case, a value is the edit case. */
  const [milestoneDialog, setMilestoneDialog] = useState<{ milestone: MilestoneFormMilestone | null } | null>(null)

  // One project at a time. Overview is the exception: every project as a single bar,
  // no task rows — 18 projects' worth of one-day tasks in one grid is unreadable.
  const selectedProject = useMemo(
    () => (isOverview ? null : (projects.find((p) => p.id === selection) ?? null)),
    [isOverview, projects, selection],
  )
  const visibleProjects = useMemo(
    () => (isOverview ? projects : selectedProject ? [selectedProject] : []),
    [isOverview, projects, selectedProject],
  )
  const projectTasks = useMemo(
    () => (isOverview ? [] : tasks.filter((tk) => tk.project_id === selection)),
    [isOverview, tasks, selection],
  )
  // Overview has no task rows at all, so the filter only ever bites in per-project mode.
  const visibleTasks = useMemo(
    () => (hideDone ? projectTasks.filter((tk) => tk.status !== 'done') : projectTasks),
    [hideDone, projectTasks],
  )
  const doneHidden = projectTasks.length - visibleTasks.length
  // useMilestones already scopes to the project; filtering again keeps Overview's
  // whole-workspace list out of the "+ Milestone" ordering and the task picker.
  const projectMilestones = useMemo(
    () => (isOverview ? [] : sortMilestones(milestones.filter((m) => m.project_id === selection))),
    [isOverview, milestones, selection],
  )
  const milestonePicker = useMemo(
    () => projectMilestones.map((m) => ({ id: m.id, name: m.name })),
    [projectMilestones],
  )
  // The switcher lists active work first; everything else is still one scroll away.
  const activeProjects = useMemo(
    () => projects.filter((p) => p.status === 'active').sort((a, b) => a.name.localeCompare(b.name)),
    [projects],
  )
  const otherProjects = useMemo(
    () => projects.filter((p) => p.status !== 'active').sort((a, b) => a.name.localeCompare(b.name)),
    [projects],
  )

  // Adjusting state during render (React's documented pattern) rather than in an
  // effect: the first painted frame is already the real page, not a spinner.
  if (!ready && !projectsLoading && !tasksLoading) setReady(true)

  function failMessage(err: unknown): string {
    // useTasks throws 'no-access' when RLS returns zero rows for an update —
    // the caller lost access to the project mid-session.
    if (err instanceof Error && err.message === 'no-access') return t('timeline.accessLost')
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

  async function saveMilestoneDates(id: string, dates: { start_date: string; end_date: string }) {
    try {
      await updateMilestone(id, dates)
    } catch (err) {
      setError(failMessage(err))
      throw err
    }
  }

  function openMilestone(id: string) {
    const m = milestones.find((x) => x.id === id)
    if (!m) return
    setMilestoneDialog({
      milestone: {
        id: m.id,
        name: m.name,
        startDate: m.start_date ?? undefined,
        endDate: m.end_date ?? undefined,
      },
    })
  }

  async function saveMilestone(data: MilestoneFormData) {
    const editing = milestoneDialog?.milestone
    const dates = { start_date: data.startDate ?? null, end_date: data.endDate ?? null }
    try {
      if (editing) {
        await updateMilestone(editing.id, { name: data.name, ...dates })
      } else {
        // Rows are ordered by sort_order, so a new milestone goes after the ones there.
        const nextOrder = projectMilestones.reduce((max, m) => Math.max(max, m.sort_order), -1) + 1
        await createMilestone({ project_id: selection, name: data.name, ...dates, sort_order: nextOrder })
      }
    } catch (err) {
      // Same contract as the task dialog: banner here, re-throw so the form stays open.
      setError(failMessage(err))
      throw err
    }
    setMilestoneDialog(null)
  }

  async function removeMilestone(id: string) {
    try {
      await deleteMilestone(id)
    } catch (err) {
      setError(failMessage(err))
      throw err
    }
    setMilestoneDialog(null)
  }

  if (!ready) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-accent" />
      </div>
    )
  }

  const today = todayISO()
  const fetchError = projectsError ?? tasksError
  // Same inputs TimelineGantt feeds computeContentRange, so the printed header names
  // the range the printed grid actually covers.
  const printRange = computeContentRange(
    [
      ...visibleProjects.flatMap((p) => [p.start_date, p.end_date]),
      ...visibleTasks.flatMap((tk) => [tk.start_date, tk.due_date]),
      ...milestones.flatMap((m) => [m.start_date, m.end_date]),
    ],
    today,
  )
  const longDate = (iso: string) =>
    parseDate(iso).toLocaleDateString(lang === 'es' ? 'es-ES' : 'en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })

  const headerTitle = isOverview ? t('timeline.overview') : (selectedProject?.name ?? t('timeline.overview'))
  const bounds = contentBounds([
    selectedProject?.start_date,
    selectedProject?.end_date,
    ...visibleTasks.flatMap((tk) => [tk.start_date, tk.due_date]),
  ])
  const headerSub = isOverview
    ? t('timeline.overviewHint')
    : `${bounds ? `${longDate(bounds.min)} – ${longDate(bounds.max)}` : t('timeline.noDatesYet')} · ${t('timeline.taskCounts', {
        n: projectTasks.length,
        m: projectTasks.filter((tk) => tk.status !== 'done').length,
      })}${projectMilestones.length > 0 ? ` · ${t('timeline.milestoneCounts', { n: projectMilestones.length })}` : ''}`

  return (
    <div className="p-6 flex flex-col gap-5">
      <div data-print-hide>
        <WorkTabs />
      </div>

      {/* Header — which plan, over what dates, and the one action that leaves the page. */}
      <div data-print-hide className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0 flex flex-col items-start gap-1.5">
          <select
            aria-label={t('timeline.filterProject')}
            value={selection}
            onChange={(e) => selectProject(e.target.value)}
            className="h-8 max-w-[260px] rounded-md border border-border bg-surface px-2 text-[13px] text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/30"
          >
            <option value={OVERVIEW}>{t('timeline.overview')}</option>
            {activeProjects.length > 0 && (
              <optgroup label={t('timeline.groupActive')}>
                {activeProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </optgroup>
            )}
            {otherProjects.length > 0 && (
              <optgroup label={t('timeline.groupOther')}>
                {otherProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
          <h1 className="text-[20px] font-semibold text-text-primary tracking-[-0.01em]">{headerTitle}</h1>
          <p className="text-[13px] text-text-secondary">{headerSub}</p>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-border bg-surface text-[13px] text-text-primary hover:bg-bg"
        >
          <Printer size={13} />
          {t('timeline.print')}
        </button>
      </div>

      {/* Toolbar — how the chart is drawn, nothing else. */}
      <div data-print-hide className="flex items-center gap-3 flex-wrap">
        <div
          role="radiogroup"
          aria-label={t('timeline.zoomLabel')}
          className="inline-flex rounded-md border border-border overflow-hidden"
        >
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
                className={`h-8 px-3 text-[13px] border-l border-border first:border-l-0 ${
                  active ? 'bg-accent text-white' : 'bg-surface text-text-secondary hover:bg-bg'
                }`}
              >
                {t(key)}
              </button>
            )
          })}
        </div>
        <label className="inline-flex items-center gap-2 text-[13px] text-text-secondary">
          <input type="checkbox" checked={hideDone} onChange={(e) => setHideDone(e.target.checked)} className="accent-accent" />
          {t('timeline.hideDone')}
        </label>
        {doneHidden > 0 && (
          <span className="text-[13px] text-text-secondary">{t('timeline.doneHidden', { n: doneHidden })}</span>
        )}
        {/* Structure, not drawing — but it belongs with the chart it changes, and there
            is nothing to hang a milestone on until a project is selected. */}
        {!isOverview && selectedProject && (
          <button
            type="button"
            onClick={() => setMilestoneDialog({ milestone: null })}
            className="ml-auto inline-flex items-center h-8 px-3 rounded-md border border-border bg-surface text-[13px] text-text-primary hover:bg-bg"
          >
            {t('timeline.addMilestone')}
          </button>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-md border border-negative/30 bg-negative-bg text-negative text-[13px] px-3 py-2"
        >
          <AlertCircle size={14} />
          <span className="flex-1">{error}</span>
          <button type="button" onClick={() => setError(null)} aria-label={t('common.close')} className="p-1 rounded hover:bg-negative/10">
            <X size={12} />
          </button>
        </div>
      )}

      {/* A failed fetch is not an empty workspace — say so, and don't auto-dismiss it. */}
      {fetchError && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-md border border-negative/30 bg-negative-bg text-negative text-[13px] px-3 py-2"
        >
          <AlertCircle size={14} />
          <span className="flex-1">{fetchError}</span>
        </div>
      )}

      {projects.length === 0 && !fetchError ? (
        <div className="rounded-md border border-border bg-surface px-4 py-10 text-center">
          <p className="text-text-secondary text-[13px]">{t('timeline.empty')}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {/* Screen shows the header block; paper gets this instead. */}
          <div className="hidden print:block">
            <h2 className="text-[16px] font-bold text-text-primary">{headerTitle}</h2>
            <p className="text-[11px] text-text-secondary mt-0.5">
              {longDate(printRange.start)} – {longDate(printRange.end)} ·{' '}
              {t('timeline.printedOn', { date: longDate(today) })}
            </p>
          </div>
          <TimelineGantt
            projects={visibleProjects}
            // Every task of the project, done ones included: the Gantt needs them for the
            // milestone counts and drops the done rows itself when `hideDone` is on.
            tasks={projectTasks}
            mode={isOverview ? 'overview' : 'project'}
            hideDone={hideDone}
            milestones={milestones}
            expandedMilestoneIds={expanded}
            onToggleMilestone={toggleMilestone}
            zoom={zoom}
            editable
            canEditProjects={role === 'owner'}
            onTaskDates={saveTaskDates}
            onProjectDates={saveProjectDates}
            onMilestoneDates={saveMilestoneDates}
            onMilestoneClick={openMilestone}
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
                milestoneId: tk.milestone_id,
              })
            }}
          />
        </div>
      )}

      <TaskForm
        open={dialogTask !== null}
        onOpenChange={(open) => {
          if (!open) setDialogTask(null)
        }}
        task={dialogTask}
        // Only where there is something to pick: a project with no milestones gets the
        // dialog it has always had.
        milestones={milestonePicker.length > 0 ? milestonePicker : undefined}
        onSave={async (data: TaskFormData) => {
          if (!dialogTask) return
          try {
            await updateTask(dialogTask.id, {
              title: data.title,
              description: data.description ?? null,
              status: data.status,
              priority: data.priority,
              start_date: data.startDate ?? null,
              due_date: data.dueDate ?? null,
              // Absent when no picker was shown — never null out a link the user never saw.
              ...(data.milestoneId !== undefined ? { milestone_id: data.milestoneId } : {}),
            })
          } catch (err) {
            setError(failMessage(err))
            throw err
          }
          setDialogTask(null)
        }}
      />

      <MilestoneForm
        open={milestoneDialog !== null}
        onOpenChange={(open) => {
          if (!open) setMilestoneDialog(null)
        }}
        milestone={milestoneDialog?.milestone ?? null}
        onSave={saveMilestone}
        onDelete={removeMilestone}
      />
    </div>
  )
}
