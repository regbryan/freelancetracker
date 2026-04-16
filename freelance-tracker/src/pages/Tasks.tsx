import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Clock, X, ExternalLink, Loader2, Plus, Pencil, Trash2 } from 'lucide-react'
import { useTasks } from '../hooks/useTasks'
import { useProjects } from '../hooks/useProjects'
import { supabase } from '../lib/supabase'
import TaskForm from '../components/TaskForm'
import type { TaskFormData } from '../components/TaskForm'
import type { TaskRow } from '../components/TaskList'

type StatusFilter = 'all' | 'todo' | 'in_progress' | 'done'

function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function isOverdue(dueDate: string | null | undefined, status: string): boolean {
  if (!dueDate || status === 'done') return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return new Date(dueDate + 'T00:00:00') < today
}

function formatDate(date: string): string {
  return new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

export default function Tasks() {
  const { tasks, loading: tasksLoading, createTask, updateTask, deleteTask } = useTasks()
  const { projects, loading: projectsLoading } = useProjects()

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [taskFormOpen, setTaskFormOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<TaskRow | null>(null)
  const [loggingTaskId, setLoggingTaskId] = useState<string | null>(null)
  const [logHours, setLogHours] = useState('')
  const [logDate, setLogDate] = useState(todayISO)
  const [logBillable, setLogBillable] = useState(true)
  const [logSaving, setLogSaving] = useState(false)

  const projectMap = new Map(projects.map((p) => [p.id, p]))

  const filtered = tasks.filter((t) =>
    statusFilter === 'all' ? true : t.status === statusFilter
  )

  const doneCount = tasks.filter((t) => t.status === 'done').length
  const todoCount = tasks.filter((t) => t.status === 'todo').length
  const inProgressCount = tasks.filter((t) => t.status === 'in_progress').length

  function openLogForm(taskId: string) {
    setLoggingTaskId(taskId)
    setLogHours('')
    setLogDate(todayISO())
    setLogBillable(true)
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
        description: task.title,
        hours,
        date: logDate,
        billable: logBillable,
        invoice_id: null,
      })
      setLoggingTaskId(null)
    } finally {
      setLogSaving(false)
    }
  }

  const FILTERS: { value: StatusFilter; label: string; count: number }[] = [
    { value: 'all', label: 'All', count: tasks.length },
    { value: 'todo', label: 'To Do', count: todoCount },
    { value: 'in_progress', label: 'In Progress', count: inProgressCount },
    { value: 'done', label: 'Done', count: doneCount },
  ]

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
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-text-primary text-[20px] font-bold tracking-[-0.3px]">Tasks</h1>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`h-7 px-3 rounded-lg text-[11px] font-semibold transition-colors ${
                statusFilter === f.value
                  ? 'bg-accent text-white'
                  : 'bg-surface text-text-muted hover:text-text-primary shadow-card'
              }`}
            >
              {f.label}
              <span className={`ml-1.5 ${statusFilter === f.value ? 'opacity-70' : 'opacity-50'}`}>
                {f.count}
              </span>
            </button>
          ))}
          </div>
          <button
            onClick={() => { setEditingTask(null); setTaskFormOpen(true) }}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-white text-[12px] font-semibold hover:opacity-90 transition-all active:scale-[0.98]"
            style={{ background: 'linear-gradient(135deg, #0058be 0%, #2170e4 100%)' }}
          >
            <Plus size={12} />
            Add Task
          </button>
        </div>
      </div>

      {/* Task list */}
      {filtered.length === 0 ? (
        <div className="bg-surface rounded-[14px] shadow-card p-8 flex items-center justify-center">
          <p className="text-text-muted text-[13px]">No tasks.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {filtered.map((task) => {
            const done = task.status === 'done'
            const overdue = isOverdue(task.due_date, task.status)
            const project = projectMap.get(task.project_id)

            return (
              <div key={task.id} className="bg-surface rounded-[14px] shadow-card overflow-hidden">
                <div className="px-4 py-3 flex items-center gap-3">
                  {/* Checkbox */}
                  <button
                    type="button"
                    onClick={() => updateTask(task.id, { status: done ? 'todo' : 'done' })}
                    className="flex-shrink-0 w-5 h-5 rounded-md border-2 border-border flex items-center justify-center transition-colors hover:border-accent"
                    style={done ? { backgroundColor: '#6366f1', borderColor: '#6366f1' } : undefined}
                    aria-label={done ? 'Mark as todo' : 'Mark as done'}
                  >
                    {done && (
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>

                  {/* Title */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-[13px] leading-tight truncate ${done ? 'line-through text-text-muted' : 'text-text-primary'}`}>
                      {task.title}
                    </p>
                    {task.description && (
                      <p className="text-text-muted text-[11px] truncate mt-0.5">{task.description}</p>
                    )}
                  </div>

                  {/* Badges */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {project && (
                      <Link
                        to={`/projects/${project.id}`}
                        className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded-md bg-accent-bg text-accent hover:underline"
                      >
                        {project.name}
                        <ExternalLink size={9} />
                      </Link>
                    )}
                    {task.priority === 'high' && (
                      <span className="px-1.5 py-0.5 text-[10px] font-medium rounded-md bg-negative-bg text-negative">High</span>
                    )}
                    {task.priority === 'medium' && (
                      <span className="px-1.5 py-0.5 text-[10px] font-medium rounded-md bg-status-hold-bg text-status-hold-text">Medium</span>
                    )}
                    {task.priority === 'low' && (
                      <span className="px-1.5 py-0.5 text-[10px] font-medium rounded-md bg-status-completed-bg text-status-completed-text">Low</span>
                    )}
                    {task.status === 'in_progress' && (
                      <span className="px-1.5 py-0.5 text-[10px] font-medium rounded-md bg-status-scheduled-bg text-status-scheduled-text">In Progress</span>
                    )}
                    {task.due_date && (
                      <span className={`text-[11px] ${overdue ? 'text-negative font-medium' : 'text-text-muted'}`}>
                        {formatDate(task.due_date)}
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {!done && (
                      <button
                        type="button"
                        onClick={() => loggingTaskId === task.id ? setLoggingTaskId(null) : openLogForm(task.id)}
                        aria-label="Log time"
                        title="Log time"
                        className="p-1 rounded hover:bg-input-bg transition-colors"
                      >
                        <Clock size={12} className={loggingTaskId === task.id ? 'text-accent' : 'text-text-muted'} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setEditingTask({
                          id: task.id,
                          title: task.title,
                          description: task.description ?? undefined,
                          status: task.status,
                          priority: task.priority,
                          dueDate: task.due_date ?? undefined,
                        })
                        setTaskFormOpen(true)
                      }}
                      aria-label="Edit task"
                      className="p-1 rounded hover:bg-input-bg transition-colors"
                    >
                      <Pencil size={12} className="text-text-muted" />
                    </button>
                    <button
                      type="button"
                      onClick={() => { if (confirm('Delete this task?')) deleteTask(task.id) }}
                      aria-label="Delete task"
                      className="p-1 rounded hover:bg-input-bg transition-colors"
                    >
                      <Trash2 size={12} className="text-negative" />
                    </button>
                  </div>
                </div>

                {/* Inline log time form */}
                {loggingTaskId === task.id && (
                  <div className="px-4 pb-3 pt-2 border-t border-border/50">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted mb-2">
                      Log time — {task.title}
                    </p>
                    <div className="flex flex-wrap items-end gap-2">
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-text-muted">Hours</label>
                        <input
                          type="number"
                          min="0.25"
                          step="0.25"
                          value={logHours}
                          onChange={(e) => setLogHours(e.target.value)}
                          placeholder="0.0"
                          className="h-8 w-[80px] rounded-[8px] border border-border bg-input-bg px-2 text-[12px] text-text-primary focus:outline-none focus:border-accent"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-text-muted">Date</label>
                        <input
                          type="date"
                          value={logDate}
                          onChange={(e) => setLogDate(e.target.value)}
                          className="h-8 w-[140px] rounded-[8px] border border-border bg-input-bg px-2 text-[12px] text-text-primary focus:outline-none focus:border-accent"
                        />
                      </div>
                      <div className="flex flex-col gap-1 items-center">
                        <label className="text-[10px] text-text-muted">Billable</label>
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={logBillable}
                          onClick={() => setLogBillable(!logBillable)}
                          className={`h-8 w-8 rounded-[8px] border transition-colors flex items-center justify-center ${
                            logBillable ? 'bg-accent border-accent text-white' : 'bg-input-bg border-border text-text-muted'
                          }`}
                        >
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className={logBillable ? 'opacity-100' : 'opacity-30'}>
                            <path d="M10 3L5 9L2 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => submitLogTime(task)}
                        disabled={logSaving || !logHours}
                        className="h-8 px-3 rounded-[8px] text-[12px] font-semibold text-white disabled:opacity-50 transition-all"
                        style={{ background: 'linear-gradient(135deg, #0058be 0%, #2170e4 100%)' }}
                      >
                        {logSaving ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setLoggingTaskId(null)}
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
      )}

      <TaskForm
        open={taskFormOpen}
        onOpenChange={(open) => {
          setTaskFormOpen(open)
          if (!open) setEditingTask(null)
        }}
        task={editingTask}
        projects={projects.map((p) => ({ id: p.id, name: p.name }))}
        onSave={async (data: TaskFormData) => {
          if (editingTask) {
            await updateTask(editingTask.id, {
              title: data.title,
              description: data.description ?? null,
              status: data.status,
              priority: data.priority,
              due_date: data.dueDate ?? null,
            })
            setEditingTask(null)
          } else {
            await createTask({
              project_id: data.projectId!,
              title: data.title,
              description: data.description ?? null,
              status: data.status,
              priority: data.priority,
              due_date: data.dueDate ?? null,
              meeting_note_id: null,
              assignee: 'me',
            })
          }
        }}
      />
    </div>
  )
}
