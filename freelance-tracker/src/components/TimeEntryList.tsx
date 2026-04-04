import { Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

export interface TimeEntry {
  id: string
  projectId: string
  description: string
  hours: number
  date: string
  billable: boolean
}

interface TimeEntryListProps {
  entries: TimeEntry[]
  onEdit: (entry: TimeEntry) => void
  onDelete: (id: string) => void
  loading?: boolean
}

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function TimeEntryList({ entries, onEdit, onDelete, loading }: TimeEntryListProps) {
  if (loading) {
    return (
      <div className="bg-surface rounded-[14px] shadow-card p-8 flex items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          <p className="text-text-muted text-[12px]">Loading entries...</p>
        </div>
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div className="bg-surface rounded-[14px] shadow-card p-8 flex items-center justify-center">
        <p className="text-text-muted text-[13px]">No time entries yet.</p>
      </div>
    )
  }

  return (
    <div className="bg-surface rounded-[14px] shadow-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[500px]">
          <thead>
            <tr className="text-[10px] text-text-muted font-semibold uppercase tracking-wide border-b border-border">
              <th className="text-left px-5 py-3">Date</th>
              <th className="text-left px-3 py-3">Description</th>
              <th className="text-right px-3 py-3">Hours</th>
              <th className="text-center px-3 py-3">Billable</th>
              <th className="text-right px-5 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr
                key={entry.id}
                className="border-b border-border/50 last:border-0 hover:bg-input-bg/50 transition-colors"
              >
                <td className="px-5 py-3 text-text-muted text-[12px]">
                  {formatDate(entry.date)}
                </td>
                <td className="px-3 py-3 text-text-secondary text-[12px]">
                  {entry.description}
                </td>
                <td className="px-3 py-3 text-text-primary text-[12px] font-bold text-right">
                  {entry.hours.toFixed(2)}
                </td>
                <td className="px-3 py-3 text-center">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      entry.billable
                        ? 'bg-status-active-bg text-status-active-text'
                        : 'bg-status-completed-bg text-status-completed-text'
                    }`}
                  >
                    {entry.billable ? 'Yes' : 'No'}
                  </span>
                </td>
                <td className="px-5 py-3 text-right">
                  <div className="inline-flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => onEdit(entry)}
                      aria-label="Edit entry"
                    >
                      <Pencil size={12} className="text-text-muted" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => onDelete(entry.id)}
                      aria-label="Delete entry"
                    >
                      <Trash2 size={12} className="text-negative" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
