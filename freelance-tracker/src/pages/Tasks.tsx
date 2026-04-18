import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Clock, X, ExternalLink, Loader2, Plus, Pencil, Trash2, Check, ChevronDown, ChevronRight } from 'lucide-react'
import { useTasks } from '../hooks/useTasks'
import { useProjects } from '../hooks/useProjects'
import { useTimeEntries } from '../hooks/useTimeEntries'
import { supabase } from '../lib/supabase'
import TaskForm from '../components/TaskForm'
import type { TaskFormData } from '../components/TaskForm'
import type { TaskRow } from '../components/TaskList'
import TaskInsight from '../components/TaskInsight'

type StatusFilter = 'all' | 'todo' | 'in_progress' | 'done'

function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function Tasks() {
  const { tasks, loading: tasksLoading, createTask, updateTask, deleteTask } = useTasks()
  const { projects, loading: projectsLoading } = useProjects()
  const { entries: timeEntries, updateEntry, deleteEntry, refetch: refetchTimeEntries } = useTimeEntries()

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [taskFormOpen, setTaskFormOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<TaskRow | null>(null)
  const [loggingTaskId, setLoggingTaskId] = useState<string | null>(null)
  const [logHours, setLogHours] = useState('')
  const [logDate, setLogDate] = useState(todayISO)
  const [logBillable, setLogBillable] = useState(true)
  const [logNotes, setLogNotes] = useState('')
  const [logSaving, setLogSaving] = useState(false)

  const projectMap = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects])

  const timeByTaskId = useMemo(() => {
    const map: Record<string, number> = {}
    for (const e of timeEntries) {
      if (e.task_id) map[e.task_id] = (map[e.task_id] ?? 0) + e.hours
    }
    return map
  }, [timeEntries])

  const entriesByTaskId = useMemo(() => {
    const map: Record<string, typeof timeEntries> = {}
    for (const e of timeEntries) {
      if (!e.task_id) continue
      if (!map[e.task_id]) map[e.task_id] = []
      map[e.task_id].push(e)
    }
    for (const arr of Object.values(map)) arr.sort((a, b) => b.date.localeCompare(a.date))
    return map
  }, [timeEntries])

  const [expandedTimeTaskId, setExpandedTimeTaskId] = useState<string | null>(null)
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null)
  const [editHours, setEditHours] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editBillable, setEditBillable] = useState(true)
  const [editSaving, setEditSaving] = useState(false)

  function openEntryEdit(entry: typeof timeEntries[0]) {
    setEditingEntryId(entry.id)
    setEditHours(String(entry.hours))
    setEditDate(entry.date)
    setEditNotes(entry.description ?? '')
    setEditBillable(entry.billable)
  }

  async function saveEntryEdit() {
    if (!editingEntryId || !editHours) return
    setEditSaving(true)
    try {
      await updateEntry(editingEntryId, {
        hours: Math.ceil(Number(editHours) * 4) / 4,
        date: editDate,
        description: editNotes.trim() || undefined,
        billable: editBillable,
      })
      setEditingEntryId(null)
    } finally {
      setEditSaving(false)
    }
  }

  async function handleDeleteEntry(id: string) {
    if (!confirm('Delete this time entry?')) return
    await deleteEntry(id)
  }

  const doneCount = tasks.filter((t) => t.status === 'done').length
  const todoCount = tasks.filter((t) => t.status === 'todo').length
  const inProgressCount = tasks.filter((t) => t.status === 'in_progress').length

  const FILTERS: { value: StatusFilter; label: string; count: number }[] = [
    { value: 'all', label: 'All', count: tasks.length },
    { value: 'todo', label: 'To Do', count: todoCount },
    { value: 'in_progress', label: 'In Progress', count: inProgressCount },
    { value: 'done', label: 'Done', count: doneCount },
  ]

  // Filter + sort by due date
  const filtered = useMemo(() => {
    return tasks
      .filter((t) => statusFilter === 'all' || t.status === statusFilter)
      .sort((a, b) => {
        if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date)
        if (a.due_date) return -1
        if (b.due_date) return 1
        return 0
      })
  }, [tasks, statusFilter])

  // Build date groups
  const groups = useMemo(() => {
    const today = new Date().toDateString()
    const result: { key: string; label: string; isOverdue: boolean; tasks: typeof filtered }[] = []
    const seen = new Set<string>()
    for (const t of filtered) {
      const key = t.due_date ?? 'none'
      if (!seen.has(key)) {
        seen.add(key)
        let label = 'No Due Date'
        let isOverdue = false
        if (t.due_date) {
          const d = new Date(t.due_date + 'T00:00:00')
          const isToday = d.toDateString() === today
          const isPast = d < new Date(today)
          isOverdue = isPast && !isToday
          label = isToday ? 'Today' : d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
        }
        result.push({ key, label, isOverdue, tasks: [] })
      }
      result.find(g => g.key === key)!.tasks.push(t)
    }
    return result
  }, [filtered])

  function openLogForm(taskId: string) {
    setLoggingTaskId(taskId)
    setLogHours('')
    setLogDate(todayISO())
    setLogBillable(true)
    setLogNotes('')
  }

  async function submitLogTime(task: { id: string; project_id: string; title: string }) {
    if (!logHours) return
    const hours = Math.ceil(Number(logHours) * 4) / 4
    setLogSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      await supabase.from('time_entries').insert({
        user_id: user.id,
        project_id: task.project_id,
        task_id: task.id,
        description: logNotes.trim() || task.title,
        hours,
        date: logDate,
        billable: logBillable,
        invoice_id: null,
      })
      setLoggingTaskId(null)
      refetchTimeEntries()
    } finally {
      setLogSaving(false)
    }
  }

  if (tasksLoading || projectsLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-text-muted">
        <Loader2 size={24} className="animate-spin text-accent" />
        <p className="text-[13px] font-medium">Loading tasks...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Hero Banner */}
      <div
        className="rounded-[16px] text-white relative overflow-hidden"
        style={{
          backgroundColor: '#0a1223',
          backgroundImage: 'url(/tasks-hero.webp)',
          backgroundSize: 'cover',
          backgroundPosition: 'center 30%',
          minHeight: '160px',
        }}
      >
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(90deg, rgba(10,18,35,0.80) 0%, rgba(10,18,35,0.50) 60%, rgba(10,18,35,0.15) 100%)' }}
        />
        <div className="relative z-10 px-7 py-7 max-w-2xl">
          <p className="text-white/60 text-[10px] font-semibold uppercase tracking-[2px]">Your Focus</p>
          <h1 className="text-[24px] font-bold tracking-[-0.4px] text-white mt-1.5">Tasks</h1>
          <p className="text-white/75 text-[13px] mt-2 leading-relaxed italic">
            "Finishing beats starting — momentum is the quiet compounder."
          </p>
          <p className="text-white/60 text-[12px] mt-3">{tasks.length} total · {doneCount} done · {inProgressCount} in progress</p>
        </div>
      </div>

      {/* Task Insight */}
      <TaskInsight tasks={tasks} />

      {/* Controls */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Progress bar */}
          {tasks.length > 0 && (
            <div className="flex items-center gap-2 mr-1">
              <div className="w-28 h-1.5 bg-border rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.round((doneCount / tasks.length) * 100)}%`,
                    background: doneCount === tasks.length ? '#10b981' : 'linear-gradient(90deg, #3e6b5a, #5a8f7b)',
                  }}
                />
              </div>
              <span className="text-text-muted text-[11px]">{Math.round((doneCount / tasks.length) * 100)}%</span>
            </div>
          )}
          {/* Status filters */}
          <div className="flex items-center gap-1 border-b border-border">
            {FILTERS.map((f) => {
              const isActive = statusFilter === f.value
              return (
                <button
                  key={f.value}
                  onClick={() => setStatusFilter(f.value)}
                  className={`relative px-3 py-2 text-[12px] font-semibold transition-colors ${
                    isActive ? 'text-accent' : 'text-text-muted hover:text-text-primary'
                  }`}
                >
                  {f.label}
                  <span className="ml-1.5 opacity-60">{f.count}</span>
                  {isActive && (
                    <span className="absolute left-2 right-2 -bottom-px h-[2px] bg-accent rounded-full" />
                  )}
                </button>
              )
            })}
          </div>
          <button
            onClick={() => { setEditingTask(null); setTaskFormOpen(true) }}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-white text-[12px] font-semibold hover:opacity-90 transition-all active:scale-[0.98]"
            style={{ background: 'linear-gradient(135deg, #305445 0%, #3e6b5a 100%)' }}
          >
            <Plus size={12} />
            Add Task
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-surface rounded-[14px] shadow-card overflow-hidden">
        {/* Column headers */}
        <div className="grid grid-cols-[1fr_160px_110px_110px_130px_88px] border-b border-border bg-input-bg/60 px-5 py-2.5">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">Task</span>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">Project</span>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">Priority</span>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">Status</span>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">Dates</span>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">Actions</span>
        </div>

        {/* Rows */}
        <div className="flex flex-col">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <p className="text-text-muted text-[13px]">
                {tasks.length === 0 ? 'No tasks yet — add one above.' : 'No tasks match this filter.'}
              </p>
            </div>
          ) : (
            groups.map(group => (
              <div key={group.key}>
                {/* Group header */}
                <div className="flex items-center gap-2 px-5 py-2 border-b border-border bg-input-bg/30">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${group.isOverdue ? 'bg-negative' : group.key === 'none' ? 'bg-border' : 'bg-accent'}`} />
                  <span className="text-[11px] font-semibold text-text-secondary">
                    {group.label}
                  </span>
                  <span className="text-[10px] text-text-muted">{group.tasks.length}</span>
                  {group.isOverdue && (
                    <span className="text-[10px] font-medium text-negative uppercase tracking-wide ml-1">Overdue</span>
                  )}
                </div>

                {/* Tasks */}
                {group.tasks.map((task) => {
                  const project = projectMap.get(task.project_id)
                  const isLogging = loggingTaskId === task.id
                  const hoursLogged = timeByTaskId[task.id] ?? 0
                  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
                  const due = task.due_date ? new Date(task.due_date + 'T00:00:00') : null
                  const diffDays = due ? Math.ceil((due.getTime() - todayStart.getTime()) / 86400000) : null
                  const isPastDue = diffDays !== null && diffDays < 0 && task.status !== 'done'
                  const isDueSoon = diffDays !== null && diffDays >= 0 && diffDays <= 3 && task.status !== 'done'
                  const isUpcoming = diffDays !== null && diffDays > 3 && task.status !== 'done'
                  const dueDateColor = task.status === 'done' ? 'text-text-muted' : isPastDue ? 'text-negative font-semibold' : isDueSoon ? 'text-amber-500 font-semibold' : isUpcoming ? 'text-emerald-600' : 'text-text-muted'

                  return (
                    <div key={task.id} className="border-b border-border/50 last:border-0">
                      {/* Main row */}
                      <div className="grid grid-cols-[1fr_160px_110px_110px_130px_88px] items-center px-5 py-3 hover:bg-input-bg/30 transition-colors group">
                        {/* Task title */}
                        <div className="flex items-center gap-2.5 min-w-0">
                          <button
                            onClick={() => updateTask(task.id, { status: task.status === 'done' ? 'todo' : 'done' })}
                            className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors ${
                              task.status === 'done' ? 'border-accent bg-accent' : 'border-border hover:border-accent'
                            }`}
                          >
                            {task.status === 'done' && <Check size={9} className="text-white" />}
                          </button>
                          <div className="min-w-0">
                            <p className={`text-[12px] font-medium truncate ${task.status === 'done' ? 'line-through text-text-muted' : 'text-text-primary'}`}>
                              {task.title}
                            </p>
                            {hoursLogged > 0 && (
                              <button
                                type="button"
                                onClick={() => setExpandedTimeTaskId(expandedTimeTaskId === task.id ? null : task.id)}
                                className="text-[10px] text-text-muted flex items-center gap-0.5 mt-0.5 hover:text-accent transition-colors"
                              >
                                {expandedTimeTaskId === task.id ? <ChevronDown size={9} /> : <ChevronRight size={9} />}
                                <Clock size={8} className="ml-0.5" />{hoursLogged}h logged
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Project */}
                        <div className="pr-3">
                          {project ? (
                            <Link
                              to={`/projects/${project.id}`}
                              className="flex items-center gap-1 text-[11px] text-accent hover:underline truncate w-fit max-w-full"
                            >
                              <span className="truncate">{project.name}</span>
                              <ExternalLink size={9} className="shrink-0" />
                            </Link>
                          ) : (
                            <span className="text-text-muted text-[11px]">—</span>
                          )}
                        </div>

                        {/* Priority */}
                        <div>
                          {task.priority === 'high' && (
                            <span className="text-[10px] font-semibold text-negative">High</span>
                          )}
                          {task.priority === 'medium' && (
                            <span className="text-[10px] font-semibold text-status-medium-text">Medium</span>
                          )}
                          {task.priority === 'low' && (
                            <span className="text-[10px] font-semibold text-text-muted">Low</span>
                          )}
                        </div>

                        {/* Status */}
                        <div>
                          {task.status === 'todo' && (
                            <span className="text-[10px] font-semibold text-text-muted">To Do</span>
                          )}
                          {task.status === 'in_progress' && (
                            <span className="text-[10px] font-semibold text-status-scheduled-text">In Progress</span>
                          )}
                          {task.status === 'done' && (
                            <span className="text-[10px] font-semibold text-positive">Done</span>
                          )}
                        </div>

                        {/* Date range */}
                        <div>
                          {task.due_date ? (
                            <span className={`text-[11px] ${dueDateColor}`}>
                              {task.start_date && task.start_date !== task.due_date
                                ? `${new Date(task.start_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${new Date(task.due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                                : new Date(task.due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </span>
                          ) : (
                            <span className="text-text-muted text-[11px]">—</span>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-0.5">
                          {task.status !== 'done' && (
                            <button
                              type="button"
                              onClick={() => isLogging ? setLoggingTaskId(null) : openLogForm(task.id)}
                              title="Log time"
                              className={`p-1.5 rounded-md transition-all active:scale-95 ${
                                isLogging
                                  ? 'bg-accent/10 text-accent'
                                  : 'text-text-muted hover:text-accent hover:bg-accent/10 opacity-0 group-hover:opacity-100 focus:opacity-100'
                              }`}
                            >
                              <Clock size={12} />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setEditingTask({ id: task.id, title: task.title, description: task.description ?? undefined, status: task.status, priority: task.priority, startDate: task.start_date ?? undefined, dueDate: task.due_date ?? undefined })
                              setTaskFormOpen(true)
                            }}
                            title="Edit task"
                            className="p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-input-bg transition-all active:scale-95 opacity-0 group-hover:opacity-100 focus:opacity-100"
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => { if (confirm('Delete this task?')) deleteTask(task.id) }}
                            title="Delete task"
                            className="p-1.5 rounded-md text-text-muted hover:text-negative hover:bg-negative/10 transition-all active:scale-95 opacity-0 group-hover:opacity-100 focus:opacity-100"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>

                      {/* Per-day time breakdown */}
                      {expandedTimeTaskId === task.id && entriesByTaskId[task.id] && (
                        <div className="px-5 pb-2 pt-1 border-t border-border/40 bg-input-bg/20">
                          {entriesByTaskId[task.id].map(entry => (
                            <div key={entry.id}>
                              {editingEntryId === entry.id ? (
                                <div className="flex flex-wrap items-end gap-2 py-2">
                                  <div className="flex flex-col gap-1 flex-1 min-w-[160px]">
                                    <label className="text-[10px] text-text-muted">Notes</label>
                                    <input
                                      type="text" value={editNotes}
                                      onChange={(e) => setEditNotes(e.target.value)}
                                      placeholder="Notes"
                                      className="h-7 rounded-[6px] border border-border bg-input-bg px-2 text-[11px] text-text-primary focus:outline-none focus:border-accent"
                                    />
                                  </div>
                                  <div className="flex flex-col gap-1">
                                    <label className="text-[10px] text-text-muted">Hours</label>
                                    <input
                                      type="number" min="0.25" step="0.25" value={editHours}
                                      onChange={(e) => setEditHours(e.target.value)}
                                      className="h-7 w-[70px] rounded-[6px] border border-border bg-input-bg px-2 text-[11px] text-text-primary focus:outline-none focus:border-accent"
                                    />
                                  </div>
                                  <div className="flex flex-col gap-1">
                                    <label className="text-[10px] text-text-muted">Date</label>
                                    <input
                                      type="date" value={editDate}
                                      onChange={(e) => setEditDate(e.target.value)}
                                      className="h-7 w-[130px] rounded-[6px] border border-border bg-input-bg px-2 text-[11px] text-text-primary focus:outline-none focus:border-accent"
                                    />
                                  </div>
                                  <div className="flex flex-col gap-1 items-center">
                                    <label className="text-[10px] text-text-muted">Billable</label>
                                    <button
                                      type="button" onClick={() => setEditBillable(!editBillable)}
                                      className={`h-7 w-7 rounded-[6px] border transition-colors flex items-center justify-center ${editBillable ? 'bg-accent border-accent text-white' : 'bg-input-bg border-border text-text-muted'}`}
                                    >
                                      <svg width="10" height="10" viewBox="0 0 12 12" fill="none" className={editBillable ? 'opacity-100' : 'opacity-30'}>
                                        <path d="M10 3L5 9L2 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                      </svg>
                                    </button>
                                  </div>
                                  <button
                                    type="button" onClick={saveEntryEdit}
                                    disabled={editSaving || !editHours}
                                    className="h-7 px-3 rounded-[6px] text-[11px] font-semibold text-white disabled:opacity-50"
                                    style={{ background: 'linear-gradient(135deg, #305445 0%, #3e6b5a 100%)' }}
                                  >
                                    {editSaving ? 'Saving…' : 'Save'}
                                  </button>
                                  <button
                                    type="button" onClick={() => setEditingEntryId(null)}
                                    className="h-7 w-7 flex items-center justify-center rounded-[6px] hover:bg-input-bg"
                                  >
                                    <X size={11} className="text-text-muted" />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-3 py-1 group/entry">
                                  <span className="text-[10px] text-text-muted w-16 shrink-0">
                                    {new Date(entry.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                  </span>
                                  <span className="text-[10px] font-semibold text-text-secondary w-10 shrink-0">{entry.hours}h</span>
                                  {entry.description && (
                                    <span className="text-[10px] text-text-muted truncate flex-1">{entry.description}</span>
                                  )}
                                  <div className="flex items-center gap-0.5 opacity-0 group-hover/entry:opacity-100 transition-opacity ml-auto">
                                    <button
                                      type="button" onClick={() => openEntryEdit(entry)}
                                      className="p-1 rounded hover:bg-input-bg transition-colors"
                                    >
                                      <Pencil size={10} className="text-text-muted" />
                                    </button>
                                    <button
                                      type="button" onClick={() => handleDeleteEntry(entry.id)}
                                      className="p-1 rounded hover:bg-negative/10 transition-colors"
                                    >
                                      <Trash2 size={10} className="text-negative" />
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Inline log time form */}
                      {isLogging && (
                        <div className="px-5 pb-3 pt-2 border-t border-border/50 bg-input-bg/40">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted mb-2">Log time — {task.title}</p>
                          <div className="flex flex-wrap items-end gap-2">
                            <div className="flex flex-col gap-1 w-full">
                              <label className="text-[10px] text-text-muted">Notes (optional)</label>
                              <input
                                type="text" value={logNotes}
                                onChange={(e) => setLogNotes(e.target.value)}
                                placeholder="What did you work on?"
                                className="h-8 w-full rounded-[8px] border border-border bg-input-bg px-2 text-[12px] text-text-primary focus:outline-none focus:border-accent"
                              />
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-[10px] text-text-muted">Hours</label>
                              <input
                                type="number" min="0.25" step="0.25" value={logHours}
                                onChange={(e) => setLogHours(e.target.value)}
                                placeholder="0.0"
                                className="h-8 w-[80px] rounded-[8px] border border-border bg-input-bg px-2 text-[12px] text-text-primary focus:outline-none focus:border-accent"
                              />
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-[10px] text-text-muted">Date</label>
                              <input
                                type="date" value={logDate}
                                onChange={(e) => setLogDate(e.target.value)}
                                className="h-8 w-[140px] rounded-[8px] border border-border bg-input-bg px-2 text-[12px] text-text-primary focus:outline-none focus:border-accent"
                              />
                            </div>
                            <div className="flex flex-col gap-1 items-center">
                              <label className="text-[10px] text-text-muted">Billable</label>
                              <button
                                type="button" role="checkbox" aria-checked={logBillable}
                                onClick={() => setLogBillable(!logBillable)}
                                className={`h-8 w-8 rounded-[8px] border transition-colors flex items-center justify-center ${logBillable ? 'bg-accent border-accent text-white' : 'bg-input-bg border-border text-text-muted'}`}
                              >
                                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className={logBillable ? 'opacity-100' : 'opacity-30'}>
                                  <path d="M10 3L5 9L2 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              </button>
                            </div>
                            <button
                              type="button" onClick={() => submitLogTime(task)}
                              disabled={logSaving || !logHours}
                              className="h-8 px-3 rounded-[8px] text-[12px] font-semibold text-white disabled:opacity-50 transition-all"
                              style={{ background: 'linear-gradient(135deg, #305445 0%, #3e6b5a 100%)' }}
                            >
                              {logSaving ? 'Saving...' : 'Save'}
                            </button>
                            <button
                              type="button" onClick={() => setLoggingTaskId(null)}
                              className="h-8 w-8 flex items-center justify-center rounded-[8px] hover:bg-input-bg transition-colors"
                            >
                              <X size={12} className="text-text-muted" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ))
          )}
        </div>
      </div>

      <TaskForm
        open={taskFormOpen}
        onOpenChange={(open) => { setTaskFormOpen(open); if (!open) setEditingTask(null) }}
        task={editingTask}
        projects={projects.map((p) => ({ id: p.id, name: p.name }))}
        onSave={async (data: TaskFormData) => {
          if (editingTask) {
            await updateTask(editingTask.id, { title: data.title, description: data.description ?? null, status: data.status, priority: data.priority, start_date: data.startDate ?? null, due_date: data.dueDate ?? null })
            setEditingTask(null)
          } else {
            await createTask({ project_id: data.projectId!, title: data.title, description: data.description ?? null, status: data.status, priority: data.priority, start_date: data.startDate ?? null, due_date: data.dueDate ?? null, meeting_note_id: null, assignee: 'me' })
          }
        }}
      />
    </div>
  )
}
