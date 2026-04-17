import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus,
  Search,
  BookOpen,
  Calendar,
  Users,
  CheckCircle2,
  Circle,
  Archive,
  Loader2,
  FileText,
} from 'lucide-react'
import { useMeetingNotes } from '../hooks/useMeetingNotes'
import { useClients } from '../hooks/useClients'
import { useProjects } from '../hooks/useProjects'
import { useTasks } from '../hooks/useTasks'
import MeetingNoteForm from '../components/MeetingNoteForm'

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function getDateGroup(dateStr: string): string {
  const d = new Date(dateStr)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const weekAgo = new Date(today)
  weekAgo.setDate(weekAgo.getDate() - 7)

  if (d >= today) return 'Today'
  if (d >= yesterday) return 'Yesterday'
  if (d >= weekAgo) return 'This Week'
  return 'Earlier'
}

const STATUS_CONFIG = {
  draft: { label: 'Draft', icon: Circle, style: 'bg-status-hold-bg text-status-hold-text' },
  reviewed: { label: 'Reviewed', icon: CheckCircle2, style: 'bg-status-active-bg text-status-active-text' },
  archived: { label: 'Archived', icon: Archive, style: 'bg-status-completed-bg text-status-completed-text' },
}

export default function MeetingNotes() {
  const navigate = useNavigate()
  const { meetingNotes, loading, createMeetingNote } = useMeetingNotes()
  const { clients } = useClients()
  const { projects } = useProjects()
  const { tasks } = useTasks()
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')
  const [filterClient, setFilterClient] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  const clientMap = useMemo(() => new Map(clients.map(c => [c.id, c])), [clients])
  const projectMap = useMemo(() => new Map(projects.map(p => [p.id, p])), [projects])

  // Count action items per meeting note
  const actionItemCounts = useMemo(() => {
    const counts = new Map<string, { total: number; done: number }>()
    for (const t of tasks) {
      if (t.meeting_note_id) {
        const existing = counts.get(t.meeting_note_id) || { total: 0, done: 0 }
        existing.total++
        if (t.status === 'done') existing.done++
        counts.set(t.meeting_note_id, existing)
      }
    }
    return counts
  }, [tasks])

  const filtered = useMemo(() => {
    let notes = meetingNotes
    if (search) {
      const q = search.toLowerCase()
      notes = notes.filter(n =>
        n.title.toLowerCase().includes(q) ||
        n.summary.toLowerCase().includes(q) ||
        n.attendees.some(a => a.toLowerCase().includes(q))
      )
    }
    if (filterClient) notes = notes.filter(n => n.client_id === filterClient)
    if (filterStatus) notes = notes.filter(n => n.status === filterStatus)
    return notes
  }, [meetingNotes, search, filterClient, filterStatus])

  const grouped = useMemo(() => {
    const groups = new Map<string, typeof filtered>()
    const order = ['Today', 'Yesterday', 'This Week', 'Earlier']
    for (const note of filtered) {
      const group = getDateGroup(note.meeting_date)
      if (!groups.has(group)) groups.set(group, [])
      groups.get(group)!.push(note)
    }
    return order.filter(g => groups.has(g)).map(g => ({ label: g, notes: groups.get(g)! }))
  }, [filtered])

  const handleCreate = async (data: Parameters<typeof createMeetingNote>[0]) => {
    const note = await createMeetingNote(data)
    setShowForm(false)
    navigate(`/meetings/${note.id}`)
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-32">
        <Loader2 size={28} className="animate-spin text-accent" />
        <p className="text-text-muted text-[13px]">Loading meeting notes...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-text-primary text-[20px] font-bold tracking-[-0.3px] flex items-center gap-2">
            <BookOpen size={20} className="text-accent" />
            Meeting Notes
          </h2>
          <p className="text-text-muted text-[12px] mt-0.5">
            {meetingNotes.length} meeting{meetingNotes.length !== 1 ? 's' : ''} recorded
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 h-9 px-4 rounded-lg text-white text-[12px] font-semibold hover:opacity-90 transition-all active:scale-[0.98]"
          style={{ background: 'linear-gradient(135deg, #305445 0%, #3e6b5a 100%)' }}
        >
          <Plus size={14} /> New Meeting Note
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-[320px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search notes..."
            className="w-full h-9 pl-8 pr-3 rounded-lg border border-border bg-input-bg text-text-primary text-[12px] placeholder:text-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all"
          />
        </div>
        <select
          value={filterClient}
          onChange={e => setFilterClient(e.target.value)}
          className="h-9 px-3 rounded-lg border border-border bg-input-bg text-text-primary text-[12px] focus:outline-none focus:border-accent transition-all"
        >
          <option value="">All Clients</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="h-9 px-3 rounded-lg border border-border bg-input-bg text-text-primary text-[12px] focus:outline-none focus:border-accent transition-all"
        >
          <option value="">All Status</option>
          <option value="draft">Draft</option>
          <option value="reviewed">Reviewed</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      {/* Notes List */}
      {grouped.length === 0 ? (
        <div className="bg-surface rounded-xl border border-border p-12 flex flex-col items-center gap-3">
          <FileText size={32} className="text-text-muted/40" />
          <p className="text-text-muted text-[13px]">
            {meetingNotes.length === 0
              ? 'No meeting notes yet. Create your first one!'
              : 'No meetings match your filters.'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {grouped.map(group => (
            <div key={group.label}>
              <h3 className="text-text-muted text-[11px] font-semibold uppercase tracking-wide mb-2">
                {group.label}
              </h3>
              <div className="flex flex-col gap-2">
                {group.notes.map(note => {
                  const client = note.client_id ? clientMap.get(note.client_id) : null
                  const project = note.project_id ? projectMap.get(note.project_id) : null
                  const statusCfg = STATUS_CONFIG[note.status]
                  const StatusIcon = statusCfg.icon
                  const counts = actionItemCounts.get(note.id)

                  return (
                    <button
                      key={note.id}
                      onClick={() => navigate(`/meetings/${note.id}`)}
                      className="bg-surface rounded-xl border border-border p-4 flex items-start gap-4 text-left hover:shadow-md hover:border-accent/30 transition-all group w-full"
                    >
                      {/* Icon */}
                      <div className="w-10 h-10 rounded-xl bg-accent-bg flex items-center justify-center shrink-0 group-hover:bg-accent group-hover:text-white transition-all">
                        <BookOpen size={16} className="text-accent group-hover:text-white" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="text-text-primary text-[14px] font-semibold truncate">
                            {note.title}
                          </h4>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${statusCfg.style}`}>
                            <StatusIcon size={10} />
                            {statusCfg.label}
                          </span>
                        </div>

                        {note.summary && (
                          <p className="text-text-muted text-[12px] truncate mb-2">{note.summary}</p>
                        )}

                        <div className="flex items-center gap-3 text-[11px] text-text-muted">
                          <span className="flex items-center gap-1">
                            <Calendar size={10} /> {formatDate(note.meeting_date)} · {formatTime(note.meeting_date)}
                          </span>
                          {client && (
                            <span className="flex items-center gap-1">
                              <Users size={10} /> {client.name}
                            </span>
                          )}
                          {project && (
                            <span className="px-1.5 py-0.5 rounded bg-accent-bg text-accent text-[10px] font-medium">
                              {project.name}
                            </span>
                          )}
                          {note.attendees.length > 0 && (
                            <span>{note.attendees.length} attendee{note.attendees.length !== 1 ? 's' : ''}</span>
                          )}
                        </div>
                      </div>

                      {/* Action item progress */}
                      {counts && counts.total > 0 && (
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className="text-text-muted text-[11px]">
                            {counts.done}/{counts.total} done
                          </span>
                          <div className="w-16 h-1.5 bg-border rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${Math.round((counts.done / counts.total) * 100)}%`,
                                background: counts.done === counts.total
                                  ? '#10b981'
                                  : 'linear-gradient(90deg, #3e6b5a, #5a8f7b)',
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Form Modal */}
      {showForm && (
        <MeetingNoteForm
          clients={clients}
          projects={projects}
          onSubmit={handleCreate}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  )
}
