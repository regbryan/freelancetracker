import { Pencil, Trash2 } from 'lucide-react'

export interface TaskRow {
  id: string
  title: string
  description?: string | null
  status: 'todo' | 'in_progress' | 'done'
  priority: 'low' | 'medium' | 'high'
  dueDate?: string | null
}

interface TaskListProps {
  tasks: TaskRow[]
  loading?: boolean
  onToggle: (id: string, currentStatus: string) => void
  onEdit: (task: TaskRow) => void
  onDelete: (id: string) => void
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

export default function TaskList({ tasks, loading, onToggle, onEdit, onDelete }: TaskListProps) {
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
              className="bg-surface rounded-[14px] shadow-card px-4 py-3 flex items-center gap-3"
            >
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
          )
        })}
      </div>
    </div>
  )
}
