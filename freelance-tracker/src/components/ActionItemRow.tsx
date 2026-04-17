import { Pencil, Trash2, FileText } from 'lucide-react'

interface ActionItemRowProps {
  id: string
  title: string
  description?: string | null
  status: 'todo' | 'in_progress' | 'done'
  priority: 'low' | 'medium' | 'high'
  dueDate?: string | null
  assignee: string
  meetingTitle?: string
  onToggle: (id: string, currentStatus: string) => void
  onEdit?: (id: string) => void
  onDelete?: (id: string) => void
  showMeetingBadge?: boolean
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
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function ActionItemRow({
  id,
  title,
  description,
  status,
  priority,
  dueDate,
  assignee,
  meetingTitle,
  onToggle,
  onEdit,
  onDelete,
  showMeetingBadge = false,
}: ActionItemRowProps) {
  const done = status === 'done'
  const overdue = isOverdue(dueDate, status)
  const isClient = assignee !== 'me'

  return (
    <div className="bg-surface rounded-xl border border-border px-4 py-3 flex items-center gap-3 transition-all hover:shadow-sm">
      {/* Checkbox */}
      <button
        type="button"
        onClick={() => onToggle(id, status)}
        className="flex-shrink-0 w-5 h-5 rounded-md border-2 border-border flex items-center justify-center transition-colors hover:border-accent"
        style={done ? { backgroundColor: '#3e6b5a', borderColor: '#3e6b5a' } : undefined}
        aria-label={done ? 'Mark as todo' : 'Mark as done'}
      >
        {done && (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={`text-[13px] leading-tight truncate ${done ? 'line-through text-text-muted' : 'text-text-primary'}`}>
          {title}
        </p>
        {description && (
          <p className="text-text-muted text-[11px] truncate mt-0.5">{description}</p>
        )}
        {showMeetingBadge && meetingTitle && (
          <span className="inline-flex items-center gap-1 mt-1 text-[10px] text-accent/70">
            <FileText size={9} /> {meetingTitle}
          </span>
        )}
      </div>

      {/* Badges */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {/* Assignee badge */}
        <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${
          isClient
            ? 'bg-amber-100 text-amber-700'
            : 'bg-accent-bg text-accent'
        }`}>
          {isClient ? assignee : 'Me'}
        </span>

        {/* Priority badge */}
        {priority === 'high' && (
          <span className="px-1.5 py-0.5 text-[10px] font-medium rounded-md bg-negative-bg text-negative">
            High
          </span>
        )}
        {priority === 'medium' && (
          <span className="px-1.5 py-0.5 text-[10px] font-medium rounded-md bg-status-hold-bg text-status-hold-text">
            Med
          </span>
        )}

        {/* Due date */}
        {dueDate && (
          <span className={`text-[11px] ${overdue ? 'text-negative font-medium' : 'text-text-muted'}`}>
            {formatDate(dueDate)}
          </span>
        )}
      </div>

      {/* Actions */}
      {(onEdit || onDelete) && (
        <div className="flex items-center gap-1 flex-shrink-0">
          {onEdit && (
            <button type="button" onClick={() => onEdit(id)} className="p-1 rounded hover:bg-input-bg transition-colors">
              <Pencil size={12} className="text-text-muted" />
            </button>
          )}
          {onDelete && (
            <button type="button" onClick={() => onDelete(id)} className="p-1 rounded hover:bg-input-bg transition-colors">
              <Trash2 size={12} className="text-negative" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
