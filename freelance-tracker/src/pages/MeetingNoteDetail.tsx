import { useState, useMemo, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft,
  Calendar,
  Users,
  FolderKanban,
  Circle,
  CheckCircle2,
  Archive,
  ChevronDown,
  ChevronRight,
  Plus,
  Loader2,
  Pencil,
  Trash2,
  BookOpen,
} from 'lucide-react'
import { useMeetingNote } from '../hooks/useMeetingNotes'
import { useClients } from '../hooks/useClients'
import { useProjects } from '../hooks/useProjects'
import { useTasks } from '../hooks/useTasks'
import MeetingTopicEditor from '../components/MeetingTopicEditor'
import MeetingNoteForm from '../components/MeetingNoteForm'
import ActionItemRow from '../components/ActionItemRow'

const STATUS_CONFIG = {
  draft: { label: 'Draft', icon: Circle, style: 'bg-status-hold-bg text-status-hold-text', next: 'reviewed' as const },
  reviewed: { label: 'Reviewed', icon: CheckCircle2, style: 'bg-status-active-bg text-status-active-text', next: 'archived' as const },
  archived: { label: 'Archived', icon: Archive, style: 'bg-status-completed-bg text-status-completed-text', next: 'draft' as const },
}

function formatFullDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

export default function MeetingNoteDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { meetingNote, topics, loading, error, updateNote, createTopic, updateTopic, deleteTopic, refetch } = useMeetingNote(id)
  const { clients } = useClients()
  const { projects } = useProjects()
  const { tasks, createTask, updateTask, deleteTask } = useTasks(undefined, id)

  const [showTranscript, setShowTranscript] = useState(false)
  const [showEditForm, setShowEditForm] = useState(false)
  const [editingSummary, setEditingSummary] = useState(false)
  const [summaryDraft, setSummaryDraft] = useState('')

  // New action item inline form
  const [showNewAction, setShowNewAction] = useState(false)
  const [newActionTitle, setNewActionTitle] = useState('')
  const [newActionAssignee, setNewActionAssignee] = useState('me')
  const [newActionDueDate, setNewActionDueDate] = useState('')
  const [newActionPriority, setNewActionPriority] = useState<'low' | 'medium' | 'high'>('medium')

  const clientMap = useMemo(() => new Map(clients.map(c => [c.id, c])), [clients])
  const projectMap = useMemo(() => new Map(projects.map(p => [p.id, p])), [projects])

  const client = meetingNote?.client_id ? clientMap.get(meetingNote.client_id) : null
  const project = meetingNote?.project_id ? projectMap.get(meetingNote.project_id) : null

  const handleToggleTask = useCallback(async (taskId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'done' ? 'todo' : 'done'
    await updateTask(taskId, { status: newStatus })
  }, [updateTask])

  const handleAddActionItem = async () => {
    if (!newActionTitle.trim() || !meetingNote) return
    await createTask({
      project_id: meetingNote.project_id || '',
      title: newActionTitle.trim(),
      description: null,
      status: 'todo',
      priority: newActionPriority,
      due_date: newActionDueDate || null,
      meeting_note_id: meetingNote.id,
      assignee: newActionAssignee,
    })
    setNewActionTitle('')
    setNewActionAssignee('me')
    setNewActionDueDate('')
    setNewActionPriority('medium')
    setShowNewAction(false)
  }

  const handleSaveSummary = async () => {
    if (!meetingNote) return
    await updateNote({ summary: summaryDraft })
    setEditingSummary(false)
  }

  const handleEditSubmit = async (data: Parameters<typeof updateNote>[0]) => {
    await updateNote(data)
    setShowEditForm(false)
    refetch()
  }

  const handleCycleStatus = async () => {
    if (!meetingNote) return
    const cfg = STATUS_CONFIG[meetingNote.status]
    await updateNote({ status: cfg.next })
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-32">
        <Loader2 size={28} className="animate-spin text-accent" />
        <p className="text-text-muted text-[13px]">Loading meeting note...</p>
      </div>
    )
  }

  if (error || !meetingNote) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-32">
        <p className="text-negative text-[13px]">{error || 'Meeting note not found'}</p>
        <button onClick={() => navigate('/meetings')} className="text-accent text-[12px] font-medium hover:underline">
          ← Back to Meeting Notes
        </button>
      </div>
    )
  }

  const statusCfg = STATUS_CONFIG[meetingNote.status]
  const StatusIcon = statusCfg.icon
  const doneCount = tasks.filter(t => t.status === 'done').length

  return (
    <div className="flex flex-col gap-5 max-w-4xl">
      {/* Back + Header */}
      <div>
        <button
          onClick={() => navigate('/meetings')}
          className="flex items-center gap-1 text-text-muted text-[12px] hover:text-accent transition-colors mb-3"
        >
          <ArrowLeft size={14} /> Back to Meeting Notes
        </button>

        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-9 h-9 rounded-xl bg-accent-bg flex items-center justify-center shrink-0">
                <BookOpen size={16} className="text-accent" />
              </div>
              <h1 className="text-text-primary text-[22px] font-bold tracking-[-0.3px] truncate">
                {meetingNote.title}
              </h1>
            </div>

            <div className="flex items-center gap-3 flex-wrap text-[11px] text-text-muted">
              <span className="flex items-center gap-1">
                <Calendar size={11} />
                {formatFullDate(meetingNote.meeting_date)} · {formatTime(meetingNote.meeting_date)}
              </span>
              {client && (
                <Link to={`/clients/${client.id}`} className="flex items-center gap-1 text-accent hover:underline">
                  <Users size={11} /> {client.name}
                </Link>
              )}
              {project && (
                <Link to={`/projects/${project.id}`} className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-accent-bg text-accent font-medium hover:underline">
                  <FolderKanban size={10} /> {project.name}
                </Link>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleCycleStatus}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all hover:opacity-80 ${statusCfg.style}`}
            >
              <StatusIcon size={11} />
              {statusCfg.label}
            </button>
            <button
              onClick={() => setShowEditForm(true)}
              className="p-2 rounded-lg border border-border hover:bg-input-bg transition-colors"
            >
              <Pencil size={14} className="text-text-muted" />
            </button>
            <button
              onClick={async () => {
                if (confirm('Delete this meeting note?')) {
                  const { deleteMeetingNote } = await import('../hooks/useMeetingNotes').then(m => {
                    // We need to call the hook version — redirect instead
                    return { deleteMeetingNote: null }
                  })
                  // Simple approach: use supabase directly
                  const { supabase } = await import('../lib/supabase')
                  await supabase.from('meeting_notes').delete().eq('id', meetingNote.id)
                  navigate('/meetings')
                }
              }}
              className="p-2 rounded-lg border border-border hover:bg-negative/10 transition-colors"
            >
              <Trash2 size={14} className="text-negative" />
            </button>
          </div>
        </div>

        {/* Attendees */}
        {meetingNote.attendees.length > 0 && (
          <div className="flex items-center gap-1.5 mt-3">
            <span className="text-text-muted text-[11px]">Attendees:</span>
            {meetingNote.attendees.map((name, i) => (
              <span key={i} className="px-2 py-0.5 rounded-full bg-accent-bg text-accent text-[11px] font-medium">
                {name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="bg-surface rounded-xl border border-border p-5">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-text-primary text-[14px] font-bold">Summary</h3>
          {!editingSummary && (
            <button
              onClick={() => { setSummaryDraft(meetingNote.summary); setEditingSummary(true) }}
              className="text-accent text-[11px] font-medium hover:underline"
            >
              Edit
            </button>
          )}
        </div>
        {editingSummary ? (
          <div className="flex flex-col gap-2">
            <textarea
              autoFocus
              value={summaryDraft}
              onChange={e => setSummaryDraft(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-border bg-input-bg text-text-primary text-[13px] focus:outline-none focus:border-accent transition-all resize-none"
            />
            <div className="flex items-center gap-2 justify-end">
              <button onClick={() => setEditingSummary(false)} className="h-8 px-3 rounded-lg border border-border text-text-muted text-[11px] hover:bg-input-bg transition-all">Cancel</button>
              <button onClick={handleSaveSummary} className="h-8 px-4 rounded-lg text-white text-[11px] font-semibold hover:opacity-90 transition-all" style={{ background: 'linear-gradient(135deg, #0058be 0%, #2170e4 100%)' }}>Save</button>
            </div>
          </div>
        ) : (
          <p className="text-text-secondary text-[13px] leading-relaxed">
            {meetingNote.summary || <span className="text-text-muted italic">No summary yet — click Edit to add one.</span>}
          </p>
        )}
      </div>

      {/* Topics */}
      <div className="bg-surface rounded-xl border border-border p-5">
        <h3 className="text-text-primary text-[14px] font-bold mb-3">What We Discussed</h3>
        {topics.length === 0 && (
          <p className="text-text-muted text-[12px] mb-3">No topics added yet.</p>
        )}
        <MeetingTopicEditor
          topics={topics}
          onCreateTopic={createTopic}
          onUpdateTopic={updateTopic}
          onDeleteTopic={deleteTopic}
        />
      </div>

      {/* Action Items */}
      <div className="bg-surface rounded-xl border border-border p-5">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-text-primary text-[14px] font-bold">Action Items</h3>
          <span className="text-text-muted text-[11px]">
            {doneCount}/{tasks.length} completed
          </span>
        </div>

        {tasks.length > 0 && (
          <div className="w-full h-1.5 bg-border rounded-full overflow-hidden mb-4">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${tasks.length > 0 ? Math.round((doneCount / tasks.length) * 100) : 0}%`,
                background: doneCount === tasks.length ? '#10b981' : 'linear-gradient(90deg, #0058be, #2170e4)',
              }}
            />
          </div>
        )}

        <div className="flex flex-col gap-2 mb-3">
          {tasks.map(task => (
            <ActionItemRow
              key={task.id}
              id={task.id}
              title={task.title}
              description={task.description}
              status={task.status}
              priority={task.priority}
              dueDate={task.due_date}
              assignee={task.assignee || 'me'}
              onToggle={handleToggleTask}
              onEdit={() => {/* Could open edit dialog */}}
              onDelete={async (taskId) => { if (confirm('Delete this action item?')) await deleteTask(taskId) }}
            />
          ))}
        </div>

        {/* Add new action item */}
        {showNewAction ? (
          <div className="bg-input-bg/50 rounded-xl border border-border/50 p-4 flex flex-col gap-3">
            <input
              autoFocus
              type="text"
              value={newActionTitle}
              onChange={e => setNewActionTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAddActionItem() }}
              placeholder="What needs to be done?"
              className="w-full h-9 px-3 rounded-lg border border-border bg-surface text-text-primary text-[13px] placeholder:text-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all"
            />
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={newActionAssignee}
                onChange={e => setNewActionAssignee(e.target.value)}
                className="h-8 px-2 rounded-lg border border-border bg-surface text-text-primary text-[11px] focus:outline-none focus:border-accent transition-all"
              >
                <option value="me">Assigned to: Me</option>
                {clients.map(c => (
                  <option key={c.id} value={c.name}>{`Assigned to: ${c.name}`}</option>
                ))}
              </select>
              <select
                value={newActionPriority}
                onChange={e => setNewActionPriority(e.target.value as 'low' | 'medium' | 'high')}
                className="h-8 px-2 rounded-lg border border-border bg-surface text-text-primary text-[11px] focus:outline-none focus:border-accent transition-all"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
              <input
                type="date"
                value={newActionDueDate}
                onChange={e => setNewActionDueDate(e.target.value)}
                className="h-8 px-2 rounded-lg border border-border bg-surface text-text-primary text-[11px] focus:outline-none focus:border-accent transition-all"
              />
              <div className="flex-1" />
              <button onClick={() => { setShowNewAction(false); setNewActionTitle('') }} className="h-8 px-3 rounded-lg border border-border text-text-muted text-[11px] hover:bg-input-bg transition-all">Cancel</button>
              <button
                onClick={handleAddActionItem}
                className="h-8 px-4 rounded-lg text-white text-[11px] font-semibold hover:opacity-90 transition-all"
                style={{ background: 'linear-gradient(135deg, #0058be 0%, #2170e4 100%)' }}
              >
                Add
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowNewAction(true)}
            className="flex items-center gap-1.5 text-accent text-[12px] font-medium hover:text-accent/80 transition-colors py-1"
          >
            <Plus size={14} /> Add Action Item
          </button>
        )}
      </div>

      {/* Transcript */}
      {(meetingNote.raw_transcript || true) && (
        <div className="bg-surface rounded-xl border border-border overflow-hidden">
          <button
            onClick={() => setShowTranscript(!showTranscript)}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-input-bg/30 transition-colors"
          >
            <h3 className="text-text-primary text-[14px] font-bold">Transcript / Full Notes</h3>
            {showTranscript ? <ChevronDown size={16} className="text-text-muted" /> : <ChevronRight size={16} className="text-text-muted" />}
          </button>
          {showTranscript && (
            <div className="px-5 pb-5">
              {meetingNote.raw_transcript ? (
                <pre className="whitespace-pre-wrap text-text-secondary text-[12px] font-mono leading-relaxed bg-input-bg/50 rounded-lg p-4 max-h-[400px] overflow-y-auto">
                  {meetingNote.raw_transcript}
                </pre>
              ) : (
                <div>
                  <p className="text-text-muted text-[12px] mb-2 italic">No transcript yet.</p>
                  <button
                    onClick={() => setShowEditForm(true)}
                    className="text-accent text-[12px] font-medium hover:underline"
                  >
                    Add transcript →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Edit Form Modal */}
      {showEditForm && (
        <MeetingNoteForm
          clients={clients}
          projects={projects}
          initial={{
            title: meetingNote.title,
            meeting_date: meetingNote.meeting_date,
            client_id: meetingNote.client_id,
            project_id: meetingNote.project_id,
            attendees: meetingNote.attendees,
            summary: meetingNote.summary,
            raw_transcript: meetingNote.raw_transcript,
            status: meetingNote.status,
          }}
          onSubmit={handleEditSubmit}
          onClose={() => setShowEditForm(false)}
        />
      )}
    </div>
  )
}
