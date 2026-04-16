import { useState, useEffect, useRef, useCallback } from 'react'
import { Pencil, Trash2, Play, Square, Clock, X } from 'lucide-react'

export interface TaskRow {
  id: string
  title: string
  description?: string
  status: 'todo' | 'in_progress' | 'done'
  priority: 'low' | 'medium' | 'high'
  dueDate?: string
}

interface TaskListProps {
  tasks: TaskRow[]
  loading?: boolean
  onToggle: (id: string, currentStatus: string) => void
  onEdit: (task: TaskRow) => void
  onDelete: (id: string) => void
  onTimerSave?: (taskId: string, hours: number, description: string) => Promise<void>
  onLogTime?: (taskId: string, hours: number, date: string, billable: boolean) => Promise<void>
}

function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatElapsed(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return [hours, minutes, seconds].map((v) => String(v).padStart(2, '0')).join(':')
}

function isOverdue(dueDate: string | null | undefined, status: string): boolean {
  if (!dueDate || status === 'done') return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(dueDate + 'T00:00:00')
  return due < today
}

function formatDate(date: string): string {
  const d = new Date(date + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function TaskList({ tasks, loading, onToggle, onEdit, onDelete, onTimerSave, onLogTime }: TaskListProps) {
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [isSaving, setIsSaving] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [loggingTaskId, setLoggingTaskId] = useState<string | null>(null)
  const [logHours, setLogHours] = useState('')
  const [logDate, setLogDate] = useState(todayISO)
  const [logBillable, setLogBillable] = useState(true)
  const [logSaving, setLogSaving] = useState(false)

  function openLogForm(taskId: string) {
    setLoggingTaskId(taskId)
    setLogHours('')
    setLogDate(todayISO())
    setLogBillable(true)
  }

  async function submitLogTime(taskId: string) {
    if (!onLogTime || !logHours) return
    const raw = Number(logHours)
    const hours = Math.ceil(raw * 4) / 4
    setLogSaving(true)
    try {
      await onLogTime(taskId, hours, logDate, logBillable)
      setLoggingTaskId(null)
    } finally {
      setLogSaving(false)
    }
  }

  useEffect(() => {
    if (activeTaskId) {
      intervalRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1)
      }, 1000)
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [activeTaskId])

  const handleStart = useCallback((taskId: string) => {
    setActiveTaskId(taskId)
    setElapsedSeconds(0)
  }, [])

  const handleStop = useCallback(
    async (taskId: string, taskTitle: string) => {
      if (!onTimerSave || elapsedSeconds === 0) {
        setActiveTaskId(null)
        setElapsedSeconds(0)
        return
      }
      // Round up to nearest 0.25 hour (15 min) increment, matching Timer.tsx
      const rawHours = elapsedSeconds / 3600
      const hours = Math.ceil(rawHours * 4) / 4
      setIsSaving(true)
      try {
        await onTimerSave(taskId, hours, taskTitle)
      } finally {
        setIsSaving(false)
        setActiveTaskId(null)
        setElapsedSeconds(0)
      }
    },
    [elapsedSeconds, onTimerSave]
  )

  if (loading) {
    return (
      <div className="bg-surface rounded-[14px] shadow-card p-8 flex items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          <p className="text-text-muted text-[12px]">Loading tasks...</p>
        </div>
      </div>
    )
  }

  if (tasks.length === 0) {
    return (
      <div className="bg-surface rounded-[14px] shadow-card p-8 flex items-center justify-center">
        <p className="text-text-muted text-[13px]">No tasks yet.</p>
      </div>
    )
  }

  const doneCount = tasks.filter((t) => t.status === 'done').length
  const pct = tasks.length > 0 ? Math.round((doneCount / tasks.length) * 100) : 0

  return (
    <div className="flex flex-col gap-3">
      {/* Progress bar */}
      <div className="bg-surface rounded-[14px] shadow-card px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-text-muted text-[11px]">
            {doneCount}/{tasks.length} completed ({pct}%)
          </span>
        </div>
        <div className="w-full h-2 bg-border rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${pct}%`,
              background: 'linear-gradient(90deg, #3b82f6, #6366f1)',
            }}
          />
        </div>
      </div>

      {/* Task rows */}
      <div className="flex flex-col gap-1.5">
        {tasks.map((task) => {
          const done = task.status === 'done'
          const overdue = isOverdue(task.dueDate, task.status)

          return (
            <div
              key={task.id}
              className="bg-surface rounded-[14px] shadow-card overflow-hidden"
            >
            <div className="px-4 py-3 flex items-center gap-3">
              {/* Checkbox */}
              <button
                type="button"
                onClick={() => onToggle(task.id, task.status)}
                className="flex-shrink-0 w-5 h-5 rounded-md border-2 border-border flex items-center justify-center transition-colors hover:border-accent"
                style={done ? { backgroundColor: '#6366f1', borderColor: '#6366f1' } : undefined}
                aria-label={done ? 'Mark as todo' : 'Mark as done'}
              >
                {done && (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path
                      d="M2.5 6L5 8.5L9.5 3.5"
                      stroke="white"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </button>

              {/* Title + description */}
              <div className="flex-1 min-w-0">
                <p
                  className={`text-[13px] leading-tight truncate ${
                    done ? 'line-through text-text-muted' : 'text-text-primary'
                  }`}
                >
                  {task.title}
                </p>
                {task.description && (
                  <p className="text-text-muted text-[11px] truncate mt-0.5">
                    {task.description}
                  </p>
                )}
              </div>

              {/* Badges */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {/* Priority badge */}
                {task.priority === 'high' && (
                  <span className="px-1.5 py-0.5 text-[10px] font-medium rounded-md bg-negative-bg text-negative">
                    High
                  </span>
                )}
                {task.priority === 'medium' && (
                  <span className="px-1.5 py-0.5 text-[10px] font-medium rounded-md bg-status-hold-bg text-status-hold-text">
                    Medium
                  </span>
                )}
                {task.priority === 'low' && (
                  <span className="px-1.5 py-0.5 text-[10px] font-medium rounded-md bg-status-completed-bg text-status-completed-text">
                    Low
                  </span>
                )}

                {/* In progress badge */}
                {task.status === 'in_progress' && (
                  <span className="px-1.5 py-0.5 text-[10px] font-medium rounded-md bg-status-scheduled-bg text-status-scheduled-text">
                    In Progress
                  </span>
                )}

                {/* Due date */}
                {task.dueDate && (
                  <span
                    className={`text-[11px] ${
                      overdue ? 'text-negative font-medium' : 'text-text-muted'
                    }`}
                  >
                    {formatDate(task.dueDate)}
                  </span>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 flex-shrink-0">
                {/* Timer */}
                {onTimerSave && !done && (
                  <>
                    {activeTaskId === task.id ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-mono font-semibold text-accent tabular-nums">
                          {formatElapsed(elapsedSeconds)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleStop(task.id, task.title)}
                          disabled={isSaving}
                          aria-label="Stop timer and save entry"
                          className="p-1 rounded hover:bg-input-bg transition-colors disabled:opacity-50"
                        >
                          <Square size={12} className="text-negative" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleStart(task.id)}
                        disabled={activeTaskId !== null || isSaving}
                        aria-label="Start timer"
                        className="p-1 rounded hover:bg-input-bg transition-colors disabled:opacity-30"
                      >
                        <Play size={12} className="text-accent" />
                      </button>
                    )}
                  </>
                )}
                {/* Log time manually */}
                {onLogTime && !done && (
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
                  onClick={() => onEdit(task)}
                  aria-label="Edit task"
                  className="p-1 rounded hover:bg-input-bg transition-colors"
                >
                  <Pencil size={12} className="text-text-muted" />
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(task.id)}
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
                    onClick={() => submitLogTime(task.id)}
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
    </div>
  )
}
