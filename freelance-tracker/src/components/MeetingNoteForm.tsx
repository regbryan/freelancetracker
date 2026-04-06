import { useState } from 'react'
import { X, Plus, Trash2 } from 'lucide-react'
import type { Client } from '../hooks/useClients'

interface Project {
  id: string
  name: string
  client_id: string | null
}

interface MeetingNoteFormProps {
  clients: Client[]
  projects: Project[]
  onSubmit: (data: {
    title: string
    meeting_date: string
    client_id: string | null
    project_id: string | null
    attendees: string[]
    summary: string
    raw_transcript: string
    status: 'draft' | 'reviewed' | 'archived'
  }) => void
  onClose: () => void
  initial?: {
    title?: string
    meeting_date?: string
    client_id?: string | null
    project_id?: string | null
    attendees?: string[]
    summary?: string
    raw_transcript?: string
    status?: 'draft' | 'reviewed' | 'archived'
  }
}

export default function MeetingNoteForm({ clients, projects, onSubmit, onClose, initial }: MeetingNoteFormProps) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [meetingDate, setMeetingDate] = useState(
    initial?.meeting_date
      ? new Date(initial.meeting_date).toISOString().slice(0, 16)
      : new Date().toISOString().slice(0, 16)
  )
  const [clientId, setClientId] = useState<string>(initial?.client_id ?? '')
  const [projectId, setProjectId] = useState<string>(initial?.project_id ?? '')
  const [attendees, setAttendees] = useState<string[]>(initial?.attendees ?? [])
  const [attendeeInput, setAttendeeInput] = useState('')
  const [summary, setSummary] = useState(initial?.summary ?? '')
  const [transcript, setTranscript] = useState(initial?.raw_transcript ?? '')
  const [status] = useState<'draft' | 'reviewed' | 'archived'>(initial?.status ?? 'draft')

  const filteredProjects = clientId
    ? projects.filter(p => p.client_id === clientId)
    : projects

  const addAttendee = () => {
    const name = attendeeInput.trim()
    if (name && !attendees.includes(name)) {
      setAttendees([...attendees, name])
      setAttendeeInput('')
    }
  }

  const removeAttendee = (index: number) => {
    setAttendees(attendees.filter((_, i) => i !== index))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    onSubmit({
      title: title.trim(),
      meeting_date: new Date(meetingDate).toISOString(),
      client_id: clientId || null,
      project_id: projectId || null,
      attendees,
      summary,
      raw_transcript: transcript,
      status,
    })
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-surface rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-text-primary text-[16px] font-bold">
            {initial ? 'Edit Meeting Note' : 'New Meeting Note'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-input-bg transition-colors">
            <X size={16} className="text-text-muted" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          {/* Title */}
          <div>
            <label className="block text-text-secondary text-[11px] font-semibold uppercase tracking-wide mb-1.5">
              Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Website Redesign Kickoff"
              className="w-full h-10 px-3 rounded-lg border border-border bg-input-bg text-text-primary text-[13px] placeholder:text-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all"
              required
            />
          </div>

          {/* Date + Client + Project row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-text-secondary text-[11px] font-semibold uppercase tracking-wide mb-1.5">
                Date & Time
              </label>
              <input
                type="datetime-local"
                value={meetingDate}
                onChange={e => setMeetingDate(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-border bg-input-bg text-text-primary text-[13px] focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all"
              />
            </div>
            <div>
              <label className="block text-text-secondary text-[11px] font-semibold uppercase tracking-wide mb-1.5">
                Client
              </label>
              <select
                value={clientId}
                onChange={e => { setClientId(e.target.value); setProjectId(''); }}
                className="w-full h-10 px-3 rounded-lg border border-border bg-input-bg text-text-primary text-[13px] focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all"
              >
                <option value="">No client</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-text-secondary text-[11px] font-semibold uppercase tracking-wide mb-1.5">
                Project
              </label>
              <select
                value={projectId}
                onChange={e => setProjectId(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-border bg-input-bg text-text-primary text-[13px] focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all"
              >
                <option value="">No project</option>
                {filteredProjects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Attendees */}
          <div>
            <label className="block text-text-secondary text-[11px] font-semibold uppercase tracking-wide mb-1.5">
              Attendees
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {attendees.map((name, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-accent-bg text-accent text-[11px] font-medium"
                >
                  {name}
                  <button type="button" onClick={() => removeAttendee(i)} className="hover:text-negative transition-colors">
                    <X size={10} />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={attendeeInput}
                onChange={e => setAttendeeInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addAttendee(); } }}
                placeholder="Add attendee name"
                className="flex-1 h-9 px-3 rounded-lg border border-border bg-input-bg text-text-primary text-[12px] placeholder:text-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all"
              />
              <button
                type="button"
                onClick={addAttendee}
                className="h-9 px-3 rounded-lg border border-border text-text-muted text-[12px] hover:bg-input-bg hover:text-accent transition-all flex items-center gap-1"
              >
                <Plus size={12} /> Add
              </button>
            </div>
          </div>

          {/* Summary */}
          <div>
            <label className="block text-text-secondary text-[11px] font-semibold uppercase tracking-wide mb-1.5">
              Summary
            </label>
            <textarea
              value={summary}
              onChange={e => setSummary(e.target.value)}
              placeholder="Quick 2-3 sentence overview of what was discussed..."
              rows={3}
              className="w-full px-3 py-2.5 rounded-lg border border-border bg-input-bg text-text-primary text-[13px] placeholder:text-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all resize-none"
            />
          </div>

          {/* Transcript */}
          <div>
            <label className="block text-text-secondary text-[11px] font-semibold uppercase tracking-wide mb-1.5">
              Transcript / Full Notes
            </label>
            <textarea
              value={transcript}
              onChange={e => setTranscript(e.target.value)}
              placeholder="Paste your meeting transcript from Granola, Google, or any note-taker here..."
              rows={6}
              className="w-full px-3 py-2.5 rounded-lg border border-border bg-input-bg text-text-primary text-[12px] font-mono placeholder:text-text-muted placeholder:font-sans focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all resize-y"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 rounded-lg border border-border text-text-secondary text-[12px] font-medium hover:bg-input-bg transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="h-9 px-5 rounded-lg text-white text-[12px] font-semibold hover:opacity-90 transition-all active:scale-[0.98]"
              style={{ background: 'linear-gradient(135deg, #0058be 0%, #2170e4 100%)' }}
            >
              {initial ? 'Save Changes' : 'Create Meeting Note'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
