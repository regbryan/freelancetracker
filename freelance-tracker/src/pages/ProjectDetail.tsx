import { useState, useMemo, useRef, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Plus, Loader2, Download, Eye, X, Receipt, CreditCard, Check, FileCheck, Link2, Trash2, Pencil, BookOpen, Calendar, Clock } from 'lucide-react'
import { useProject, useProjects } from '../hooks/useProjects'
import { useClients } from '../hooks/useClients'
import { useTimeEntries } from '../hooks/useTimeEntries'
import { useInvoices, type Invoice, type InvoiceItem } from '../hooks/useInvoices'
import { useTasks } from '../hooks/useTasks'
import TaskForm from '../components/TaskForm'
import type { TaskFormData } from '../components/TaskForm'
import ProjectForm from '../components/ProjectForm'
import type { ProjectFormData } from '../components/ProjectForm'
import TaskList from '../components/TaskList'
import type { TaskRow } from '../components/TaskList'
import { useContracts } from '../hooks/useContracts'
import ContractForm from '../components/ContractForm'
import type { ContractFormData } from '../components/ContractForm'
import { generateContractPDF } from '../components/ContractPDF'
import { supabase } from '../lib/supabase'
import { useCommunications } from '../hooks/useCommunications'
import { useMeetingNotes } from '../hooks/useMeetingNotes'
import InvoiceBuilder from '../components/InvoiceBuilder'
import EmailComposer from '../components/EmailComposer'
import type { ReplyTarget } from '../components/EmailComposer'
import CommunicationFeed from '../components/CommunicationFeed'
import EmailSyncButton from '../components/EmailSyncButton'
import { generateInvoicePDF } from '../components/InvoicePDF'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useI18n } from '../lib/i18n'

const STATUS_CONFIG: Record<string, { labelKey: string; bg: string; text: string }> = {
  active: { labelKey: 'projectDetail.statusActive', bg: 'bg-status-active-bg', text: 'text-status-active-text' },
  completed: { labelKey: 'projectDetail.statusCompleted', bg: 'bg-status-completed-bg', text: 'text-status-completed-text' },
  on_hold: { labelKey: 'projectDetail.statusOnHold', bg: 'bg-status-hold-bg', text: 'text-status-hold-text' },
  cancelled: { labelKey: 'projectDetail.statusCancelled', bg: 'bg-status-completed-bg', text: 'text-status-completed-text' },
}

const INVOICE_STATUS_CONFIG: Record<string, { labelKey: string; bg: string; text: string }> = {
  draft: { labelKey: 'projectDetail.invStatusDraft', bg: 'bg-status-completed-bg', text: 'text-status-completed-text' },
  sent: { labelKey: 'projectDetail.invStatusSent', bg: 'bg-status-scheduled-bg', text: 'text-status-scheduled-text' },
  paid: { labelKey: 'projectDetail.invStatusPaid', bg: 'bg-status-active-bg', text: 'text-status-active-text' },
  overdue: { labelKey: 'projectDetail.invStatusOverdue', bg: 'bg-negative-bg', text: 'text-negative' },
}

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t, lang } = useI18n()

  const formatDate = (iso: string | null): string => {
    if (!iso) return '--'
    const d = new Date(iso + 'T00:00:00')
    return d.toLocaleDateString(lang === 'es' ? 'es-ES' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const { project, loading: projectLoading, error: projectError } = useProject(id)
  const { deleteProject, updateProject } = useProjects()
  const { clients } = useClients()
  const {
    entries,
    createEntry,
  } = useTimeEntries(id)
  const invoiceFilters = useMemo(() => ({ projectId: id }), [id])
  const { invoices, loading: invoicesLoading, refetch: invoicesRefetch } = useInvoices(invoiceFilters)
  const meetingFilters = useMemo(() => ({ projectId: id }), [id])
  const { meetingNotes, loading: meetingsLoading } = useMeetingNotes(meetingFilters)
  const { communications, loading: commsLoading, refetch: refetchComms } = useCommunications(id)
  const {
    tasks,
    loading: tasksLoading,
    createTask,
    updateTask,
    deleteTask,
  } = useTasks(id)
  const [projectFormOpen, setProjectFormOpen] = useState(false)
  const [taskFormOpen, setTaskFormOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<TaskRow | null>(null)
  const [notesText, setNotesText] = useState<string | null>(null)
  const [notesSaving, setNotesSaving] = useState(false)
  const [taskStatusFilter, setTaskStatusFilter] = useState<'all' | 'todo' | 'in_progress' | 'done'>('all')
  const [taskSortBy, setTaskSortBy] = useState<'due_date' | 'priority' | 'status'>('due_date')
  const [loggingTaskId, setLoggingTaskId] = useState<string | null>(null)
  const [logHours, setLogHours] = useState('')
  const [logDate, setLogDate] = useState('')
  const [logBillable, setLogBillable] = useState(true)
  const [logSaving, setLogSaving] = useState(false)

  function openLogForm(taskId: string) {
    setLoggingTaskId(taskId)
    setLogHours('')
    setLogDate(new Date().toISOString().slice(0, 10))
    setLogBillable(true)
  }

  async function submitLogForm(taskId: string) {
    const hours = parseFloat(logHours)
    if (!hours || hours <= 0 || !logDate) return
    setLogSaving(true)
    try {
      await handleTaskLogTime(taskId, hours, logDate, logBillable)
      setLoggingTaskId(null)
    } finally {
      setLogSaving(false)
    }
  }

  const contractFilters = useMemo(() => ({ projectId: id }), [id])

  const timeByTaskId = useMemo(() => {
    const map: Record<string, number> = {}
    for (const e of entries) {
      if (e.task_id) map[e.task_id] = (map[e.task_id] ?? 0) + e.hours
    }
    return map
  }, [entries])
  const { contracts, loading: contractsLoading, createContract } = useContracts(contractFilters)

  const [invoiceBuilderOpen, setInvoiceBuilderOpen] = useState(false)
  const [contractFormOpen, setContractFormOpen] = useState(false)
  const [copiedContractId, setCopiedContractId] = useState<string | null>(null)
  const [paymentLoading, setPaymentLoading] = useState<string | null>(null)
  const [copiedPayId, setCopiedPayId] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null)
  const previewBlobRef = useRef<string | null>(null)
  const [replyingTo, setReplyingTo] = useState<ReplyTarget | null>(null)
  const composerRef = useRef<HTMLDivElement | null>(null)

  async function handleNotesSave() {
    if (!project || notesText === null) return
    setNotesSaving(true)
    try {
      await updateProject(project.id, { description: notesText || null })
    } finally {
      setNotesSaving(false)
      setNotesText(null)
    }
  }

  function cleanupPreview() {
    if (previewBlobRef.current) {
      URL.revokeObjectURL(previewBlobRef.current)
      previewBlobRef.current = null
    }
    setPreviewUrl(null)
    setPreviewInvoice(null)
  }

  async function buildPDF(invoice: Invoice) {
    if (!project) throw new Error('Project not loaded')

    // Use pre-loaded items if available, otherwise fetch
    let items: InvoiceItem[] = invoice.invoice_items ?? []
    if (items.length === 0) {
      const { data, error: itemsError } = await supabase
        .from('invoice_items')
        .select('*')
        .eq('invoice_id', invoice.id)

      if (itemsError) throw new Error(`Failed to load invoice items: ${itemsError.message}`)
      items = (data as InvoiceItem[]) ?? []
    }

    const clientInfo = {
      id: project.clients?.id ?? '',
      name: project.clients?.name ?? 'Client',
      email: project.clients?.email,
      company: project.clients?.company,
    }

    return generateInvoicePDF(
      invoice,
      items,
      project,
      clientInfo,
      lang,
    )
  }

  async function handlePreviewPDF(invoice: Invoice) {
    try {
      const doc = await buildPDF(invoice)
      const blob = doc.output('blob')
      const url = URL.createObjectURL(blob)
      cleanupPreview()
      previewBlobRef.current = url
      setPreviewUrl(url)
      setPreviewInvoice(invoice)
    } catch (err) {
      console.error('Failed to preview PDF:', err)
      alert(`Failed to preview invoice: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  async function handleDownloadPDF(invoice: Invoice) {
    try {
      const doc = await buildPDF(invoice)
      doc.save(`${invoice.invoice_number}.pdf`)
    } catch (err) {
      console.error('Failed to generate PDF:', err)
      alert(`Failed to download invoice: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  const rate = project?.hourly_rate ?? 0


  const handleGetPayLink = useCallback(async (invoice: Invoice) => {
    const apiUrl = import.meta.env.VITE_CALENDAR_API_URL || ''
    if (!apiUrl) return

    setPaymentLoading(invoice.id)
    try {
      const res = await fetch(`${apiUrl}/api/create-checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoice_number,
          amount: invoice.total,
          returnUrl: window.location.origin + '/invoices',
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create payment link')

      await navigator.clipboard.writeText(data.url)
      setCopiedPayId(invoice.id)
      setTimeout(() => setCopiedPayId(null), 3000)

      await supabase
        .from('invoices')
        .update({ payment_url: data.url })
        .eq('id', invoice.id)
    } catch (err) {
      alert(`Failed to create payment link: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setPaymentLoading(null)
    }
  }, [])

  async function handleTaskLogTime(taskId: string, hours: number, date: string, billable: boolean) {
    const task = tasks.find((tk) => tk.id === taskId)
    await createEntry({
      project_id: id!,
      description: task?.title ?? '',
      hours,
      date,
      billable,
      invoice_id: null,
      task_id: taskId,
    })
  }


  if (projectLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-text-muted">
        <Loader2 size={28} className="animate-spin text-accent" />
        <p className="text-[13px] font-medium">{t('projectDetail.loading')}</p>
      </div>
    )
  }

  if (projectError || !project) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-text-muted">
        <p className="text-[13px] font-medium text-negative">
          {projectError ?? t('projectDetail.notFound')}
        </p>
        <button
          onClick={() => navigate('/projects')}
          className="text-accent text-[13px] hover:underline"
        >
          {t('projectDetail.back')}
        </button>
      </div>
    )
  }

  const status = STATUS_CONFIG[project.status] ?? STATUS_CONFIG.active

  return (
    <div className="flex flex-col gap-5">
      {/* Back button */}
      <button
        onClick={() => navigate('/projects')}
        className="flex items-center gap-1 text-accent text-[13px] font-medium hover:underline w-fit"
      >
        <ArrowLeft size={14} />
        {t('projectDetail.back')}
      </button>

      {/* Project header */}
      <div className="bg-surface rounded-[14px] shadow-card p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-text-primary text-[20px] font-bold tracking-[-0.3px]">
              {project.name}
            </h2>
            <div className="flex items-center gap-3 mt-1">
              {project.clients && (
                <Link
                  to={`/clients/${project.clients.id}`}
                  className="text-accent text-[13px] hover:underline"
                >
                  {project.clients.name}
                </Link>
              )}
              <span className={`${status.bg} ${status.text} text-[10px] font-semibold px-2 py-0.5 rounded-full`}>
                {t(status.labelKey)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setProjectFormOpen(true)}
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border text-text-secondary text-[12px] font-medium hover:bg-input-bg transition-colors"
            >
              <Pencil size={12} />
              {t('common.edit')}
            </button>
            <button
              onClick={async () => {
                if (!confirm(t('projectDetail.confirmDelete', { name: project.name }))) return
                try {
                  await deleteProject(project.id)
                  navigate('/projects')
                } catch (err) {
                  alert(t('projectDetail.failedDelete', { error: err instanceof Error ? err.message : t('projectDetail.unknownError') }))
                }
              }}
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border text-negative text-[12px] font-medium hover:bg-negative/10 transition-colors"
            >
              <Trash2 size={12} />
              {t('common.delete')}
            </button>
          </div>
        </div>

        {project.description && (
          <p className="text-text-secondary text-[13px] mt-3 leading-relaxed">
            {project.description}
          </p>
        )}

        {/* Detail fields row */}
        <div className="mt-4 pt-4 border-t border-border grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted mb-0.5">{t('projectDetail.type')}</p>
            <p className="text-text-primary text-[13px] font-medium">{project.type || '—'}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted mb-0.5">{t('projectDetail.billing')}</p>
            <p className="text-text-primary text-[13px] font-medium capitalize">
              {project.billing_type === 'monthly' ? t('projectDetail.monthlyFlat') : t('projectDetail.hourly')}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted mb-0.5">{t('projectDetail.rate')}</p>
            <p className="text-text-primary text-[13px] font-medium">
              {project.billing_type === 'monthly'
                ? project.monthly_rate != null ? `$${project.monthly_rate.toFixed(2)}/mo` : '—'
                : project.hourly_rate != null ? `$${project.hourly_rate.toFixed(2)}/hr` : '—'}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted mb-0.5">{t('projectDetail.created')}</p>
            <p className="text-text-primary text-[13px] font-medium">
              {new Date(project.created_at).toLocaleDateString(lang === 'es' ? 'es-ES' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="tasks">
        <TabsList className="w-full overflow-x-auto flex-nowrap justify-start">
          <TabsTrigger value="tasks" className="text-[11px] sm:text-[12px] shrink-0">{t('projectDetail.tabTasks')}</TabsTrigger>
          <TabsTrigger value="meetings" className="text-[11px] sm:text-[12px] shrink-0">{t('projectDetail.tabMeetings')}</TabsTrigger>
          <TabsTrigger value="notes" className="text-[11px] sm:text-[12px] shrink-0">{t('projectDetail.tabNotes')}</TabsTrigger>
          <TabsTrigger value="communications" className="text-[11px] sm:text-[12px] shrink-0">{t('projectDetail.tabComms')}</TabsTrigger>
          <TabsTrigger value="contracts" className="text-[11px] sm:text-[12px] shrink-0">{t('projectDetail.tabContracts')}</TabsTrigger>
          <TabsTrigger value="invoices" className="text-[11px] sm:text-[12px] shrink-0">{t('projectDetail.tabInvoices')}</TabsTrigger>
        </TabsList>

        {/* Tasks Tab */}
        <TabsContent value="tasks">
          {(() => {
            const today = new Date().toDateString()
            const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 }
            const STATUS_ORDER: Record<string, number> = { in_progress: 0, todo: 1, done: 2 }

            const filtered = tasks
              .filter(tk => taskStatusFilter === 'all' || tk.status === taskStatusFilter)
              .sort((a, b) => {
                if (taskSortBy === 'due_date') {
                  if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date)
                  if (a.due_date) return -1
                  if (b.due_date) return 1
                  return 0
                }
                if (taskSortBy === 'priority') {
                  return (PRIORITY_ORDER[a.priority] ?? 3) - (PRIORITY_ORDER[b.priority] ?? 3)
                }
                return (STATUS_ORDER[a.status] ?? 3) - (STATUS_ORDER[b.status] ?? 3)
              })

            const groups: { key: string; label: string; isOverdue: boolean; tasks: typeof filtered }[] = []
            const seen = new Set<string>()
            for (const tk of filtered) {
              const key = taskSortBy === 'due_date' ? (tk.due_date ?? 'none') : tk.status
              if (!seen.has(key)) {
                seen.add(key)
                let label = key
                let isOverdue = false
                if (taskSortBy === 'due_date') {
                  if (tk.due_date) {
                    const d = new Date(tk.due_date + 'T00:00:00')
                    const isToday = d.toDateString() === today
                    const isPast = d < new Date(today)
                    isOverdue = isPast && !isToday
                    label = isToday ? t('projectDetail.today') : d.toLocaleDateString(lang === 'es' ? 'es-ES' : 'en-US', { weekday: 'long', month: 'long', day: 'numeric' })
                  } else {
                    label = t('projectDetail.noDueDate')
                  }
                } else if (taskSortBy === 'priority') {
                  label = key === 'high' ? t('projectDetail.highPriority') : key === 'medium' ? t('projectDetail.mediumPriority') : t('projectDetail.lowPriority')
                } else {
                  label = key === 'in_progress' ? t('projectDetail.inProgress') : key === 'todo' ? t('projectDetail.todo') : t('projectDetail.done')
                }
                groups.push({ key, label, isOverdue, tasks: [] })
              }
              groups.find(g => g.key === key)!.tasks.push(tk)
            }

            return (
              <div className="bg-surface rounded-[14px] shadow-card border border-border-accent overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
                  <div className="flex items-center gap-2 flex-wrap">
                    {(['all', 'todo', 'in_progress', 'done'] as const).map(s => (
                      <button
                        key={s}
                        onClick={() => setTaskStatusFilter(s)}
                        className={`h-6 px-2.5 rounded-full text-[11px] font-semibold transition-colors ${taskStatusFilter === s ? 'bg-accent text-white' : 'bg-input-bg text-text-muted hover:text-text-secondary'}`}
                      >
                        {s === 'all' ? t('projectDetail.all') : s === 'todo' ? t('projectDetail.todo') : s === 'in_progress' ? t('projectDetail.inProgress') : t('projectDetail.done')}
                      </button>
                    ))}
                    <div className="w-px h-4 bg-border mx-1" />
                    <select
                      value={taskSortBy}
                      onChange={e => setTaskSortBy(e.target.value as typeof taskSortBy)}
                      className="h-6 px-2 rounded-lg bg-input-bg text-text-muted text-[11px] border border-border focus:outline-none cursor-pointer"
                    >
                      <option value="due_date">{t('projectDetail.sortDueDate')}</option>
                      <option value="priority">{t('projectDetail.sortPriority')}</option>
                      <option value="status">{t('projectDetail.sortStatus')}</option>
                    </select>
                  </div>
                  <button
                    onClick={() => { setEditingTask(null); setTaskFormOpen(true) }}
                    className="flex items-center gap-1.5 h-7 px-3 rounded-lg text-white text-[11px] font-semibold hover:opacity-90 transition-all active:scale-[0.98] shrink-0"
                    style={{ background: 'linear-gradient(135deg, #305445 0%, #3e6b5a 100%)' }}
                  >
                    <Plus size={11} />
                    {t('projectDetail.addTask')}
                  </button>
                </div>

                {/* Column headers */}
                <div className="grid grid-cols-[1fr_110px_100px_130px] border-b border-border bg-input-bg/50 px-5 py-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">{t('projectDetail.colTask')}</span>
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">{t('projectDetail.colPriority')}</span>
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">{t('projectDetail.colStatus')}</span>
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">{t('projectDetail.colDates')}</span>
                </div>

                {/* Rows */}
                <div className="flex flex-col max-h-[480px] overflow-y-auto">
                  {tasksLoading ? (
                    <div className="flex items-center justify-center py-10">
                      <Loader2 size={20} className="animate-spin text-accent" />
                    </div>
                  ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 gap-2">
                      <p className="text-text-muted text-[12px]">{tasks.length === 0 ? t('projectDetail.noTasksYet') : t('projectDetail.noTasksFilter')}</p>
                    </div>
                  ) : (
                    groups.map(group => (
                      <div key={group.key}>
                        <div className={`flex items-center gap-2 px-5 py-1.5 border-b border-border ${group.isOverdue ? 'bg-negative/5' : 'bg-input-bg/30'}`}>
                          <span className={`w-2 h-2 rounded-full shrink-0 ${group.isOverdue ? 'bg-negative' : group.key === 'none' || group.key === 'done' ? 'bg-border' : 'bg-accent'}`} />
                          <span className={`text-[11px] font-semibold ${group.isOverdue ? 'text-negative' : 'text-text-secondary'}`}>{group.label}</span>
                          <span className="text-[10px] text-text-muted ml-1">{group.tasks.length}</span>
                        </div>
                        {group.tasks.map(task => {
                          const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
                          const due = task.due_date ? new Date(task.due_date + 'T00:00:00') : null
                          const diffDays = due ? Math.ceil((due.getTime() - todayStart.getTime()) / 86400000) : null
                          const isPastDue = diffDays !== null && diffDays < 0 && task.status !== 'done'
                          const isDueSoon = diffDays !== null && diffDays >= 0 && diffDays <= 3 && task.status !== 'done'
                          const isUpcoming = diffDays !== null && diffDays > 3 && task.status !== 'done'
                          const dueDateColor = task.status === 'done' ? 'text-text-muted' : isPastDue ? 'text-negative font-semibold' : isDueSoon ? 'text-amber-500 font-semibold' : isUpcoming ? 'text-emerald-600' : 'text-text-muted'
                          const taskHours = timeByTaskId[task.id] ?? 0
                          const isLogging = loggingTaskId === task.id
                          const isDone = task.status === 'done'
                          return (
                          <div key={task.id} className="border-b border-border/40 last:border-0">
                          <div
                            className="grid grid-cols-[1fr_110px_100px_130px] items-center px-5 py-2.5 hover:bg-input-bg/40 transition-colors group"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <button
                                onClick={() => updateTask(task.id, { status: task.status === 'done' ? 'todo' : 'done' })}
                                className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors ${task.status === 'done' ? 'border-accent bg-accent' : 'border-border hover:border-accent'}`}
                              >
                                {task.status === 'done' && <Check size={9} className="text-white" />}
                              </button>
                              <button
                                onClick={() => { setEditingTask({ id: task.id, title: task.title, description: task.description ?? undefined, status: task.status, priority: task.priority, startDate: task.start_date ?? undefined, dueDate: task.due_date ?? undefined }); setTaskFormOpen(true) }}
                                className={`text-[12px] font-medium truncate text-left hover:underline ${task.status === 'done' ? 'line-through text-text-muted' : isPastDue ? 'text-negative' : 'text-text-primary'}`}
                              >
                                {task.title}
                              </button>
                              {taskHours > 0 && (
                                <span className="text-[10px] text-text-muted shrink-0">{taskHours.toFixed(1)}h</span>
                              )}
                              <div className="flex items-center gap-1 ml-auto shrink-0">
                                {!isDone && (
                                  <button
                                    onClick={() => isLogging ? setLoggingTaskId(null) : openLogForm(task.id)}
                                    className="p-1 rounded hover:bg-input-bg transition-colors"
                                    title={t('projectDetail.logTime') !== 'projectDetail.logTime' ? t('projectDetail.logTime') : 'Log time'}
                                  >
                                    <Clock size={11} className={isLogging ? 'text-accent' : 'text-text-muted hover:text-accent'} />
                                  </button>
                                )}
                                <button onClick={() => deleteTask(task.id)} className="p-1 rounded hover:bg-negative/10 text-text-muted hover:text-negative transition-colors opacity-0 group-hover:opacity-100">
                                  <Trash2 size={10} />
                                </button>
                              </div>
                            </div>
                            <div>
                              {task.priority === 'high' && <span className="text-[10px] font-semibold text-negative">{t('projectDetail.high')}</span>}
                              {task.priority === 'medium' && <span className="text-[10px] font-semibold text-status-medium-text">{t('projectDetail.medium')}</span>}
                              {task.priority === 'low' && <span className="text-[10px] font-semibold text-text-muted">{t('projectDetail.low')}</span>}
                            </div>
                            <div>
                              {task.status === 'in_progress' && <span className="text-[10px] font-semibold text-status-scheduled-text">{t('projectDetail.inProgress')}</span>}
                              {task.status === 'todo' && <span className="text-[10px] font-semibold text-text-muted">{t('projectDetail.todo')}</span>}
                              {task.status === 'done' && <span className="text-[10px] font-semibold text-positive">{t('projectDetail.done')}</span>}
                            </div>
                            <div>
                              {task.due_date ? (
                                <span className={`text-[11px] ${dueDateColor}`}>
                                  {task.start_date && task.start_date !== task.due_date
                                    ? `${new Date(task.start_date + 'T00:00:00').toLocaleDateString(lang === 'es' ? 'es-ES' : 'en-US', { month: 'short', day: 'numeric' })} – ${new Date(task.due_date + 'T00:00:00').toLocaleDateString(lang === 'es' ? 'es-ES' : 'en-US', { month: 'short', day: 'numeric' })}`
                                    : new Date(task.due_date + 'T00:00:00').toLocaleDateString(lang === 'es' ? 'es-ES' : 'en-US', { month: 'short', day: 'numeric' })}
                                </span>
                              ) : <span className="text-text-muted text-[11px]">—</span>}
                            </div>
                          </div>
                          {isLogging && (
                            <div className="px-5 pb-3 pt-2 bg-input-bg/30 border-t border-border/50">
                              <div className="flex flex-wrap items-end gap-2">
                                <div className="flex flex-col gap-1">
                                  <label className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">Hours</label>
                                  <input
                                    type="number"
                                    step="0.25"
                                    min="0"
                                    value={logHours}
                                    onChange={(e) => setLogHours(e.target.value)}
                                    placeholder="2.5"
                                    autoFocus
                                    className="h-7 w-20 px-2 rounded-md border border-border bg-surface text-[12px] text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                                  />
                                </div>
                                <div className="flex flex-col gap-1">
                                  <label className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">Date</label>
                                  <input
                                    type="date"
                                    value={logDate}
                                    onChange={(e) => setLogDate(e.target.value)}
                                    className="h-7 px-2 rounded-md border border-border bg-surface text-[12px] text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                                  />
                                </div>
                                <label className="flex items-center gap-1.5 h-7 text-[11px] text-text-secondary cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={logBillable}
                                    onChange={(e) => setLogBillable(e.target.checked)}
                                    className="accent-accent"
                                  />
                                  Billable
                                </label>
                                <div className="flex items-center gap-2 ml-auto">
                                  <button
                                    type="button"
                                    onClick={() => setLoggingTaskId(null)}
                                    className="h-7 px-3 rounded-md text-[11px] text-text-muted hover:text-text-secondary"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => submitLogForm(task.id)}
                                    disabled={logSaving || !logHours || !logDate}
                                    className="h-7 px-3 rounded-md text-white text-[11px] font-semibold disabled:opacity-50"
                                    style={{ background: 'linear-gradient(135deg, #305445 0%, #3e6b5a 100%)' }}
                                  >
                                    {logSaving ? 'Saving…' : 'Log time'}
                                  </button>
                                </div>
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
            )
          })()}

          <TaskForm
            open={taskFormOpen}
            onOpenChange={(open) => { setTaskFormOpen(open); if (!open) setEditingTask(null) }}
            task={editingTask}
            onSave={async (data: TaskFormData) => {
              if (editingTask) {
                await updateTask(editingTask.id, { title: data.title, description: data.description ?? null, status: data.status, priority: data.priority, start_date: data.startDate ?? null, due_date: data.dueDate ?? null })
                setEditingTask(null)
              } else {
                await createTask({ project_id: id!, title: data.title, description: data.description ?? null, status: data.status, priority: data.priority, start_date: data.startDate ?? null, due_date: data.dueDate ?? null, meeting_note_id: null, assignee: 'me' })
              }
            }}
          />
        </TabsContent>



        {/* Meetings Tab */}
        <TabsContent value="meetings">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">{t('projectDetail.meetingNotes')}</p>
              <button onClick={() => navigate('/meetings')} className="text-accent text-[11px] font-semibold hover:underline">{t('common.viewAll')}</button>
            </div>
            {meetingsLoading ? (
              <div className="bg-surface rounded-[14px] shadow-card p-8 flex items-center justify-center">
                <Loader2 size={20} className="animate-spin text-accent" />
              </div>
            ) : meetingNotes.length === 0 ? (
              <div className="bg-surface rounded-[14px] shadow-card p-8 flex flex-col items-center justify-center gap-2">
                <BookOpen size={20} className="text-text-muted/40" />
                <p className="text-text-muted text-[13px]">{t('projectDetail.noMeetings')}</p>
              </div>
            ) : (
              <div className="bg-surface rounded-[14px] shadow-card overflow-hidden">
                {meetingNotes.map((note, i) => {
                  const meetDate = new Date(note.meeting_date + 'T00:00:00')
                  return (
                    <button
                      key={note.id}
                      onClick={() => navigate(`/meetings/${note.id}`)}
                      className={`w-full flex items-center gap-4 px-5 py-3.5 hover:bg-input-bg/50 transition-colors text-left ${i < meetingNotes.length - 1 ? 'border-b border-border/50' : ''}`}
                    >
                      <div className="w-8 h-8 rounded-lg bg-accent-bg flex items-center justify-center shrink-0">
                        <BookOpen size={13} className="text-accent" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-text-primary text-[13px] font-semibold truncate">{note.title}</p>
                        {note.summary && <p className="text-text-muted text-[11px] truncate mt-0.5">{note.summary}</p>}
                      </div>
                      <div className="flex items-center gap-1 text-text-muted text-[11px] shrink-0">
                        <Calendar size={10} />
                        {meetDate.toLocaleDateString(lang === 'es' ? 'es-ES' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Notes Tab */}
        <TabsContent value="notes">
          <div className="bg-surface rounded-[14px] shadow-card p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">{t('projectDetail.projectNotes')}</p>
              {notesText !== null && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setNotesText(null)}
                    className="text-[12px] text-text-muted hover:text-text-secondary px-2 py-1 rounded-lg hover:bg-input-bg transition-colors"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    onClick={handleNotesSave}
                    disabled={notesSaving}
                    className="text-[12px] font-semibold text-white px-3 py-1.5 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                    style={{ background: 'linear-gradient(135deg, #305445 0%, #3e6b5a 100%)' }}
                  >
                    {notesSaving ? t('projectDetail.saving') : t('common.save')}
                  </button>
                </div>
              )}
            </div>

            {notesText !== null ? (
              <textarea
                className="w-full min-h-[180px] rounded-xl border border-border bg-input-bg px-4 py-3 text-[13px] text-text-primary leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-accent/30"
                placeholder={t('projectDetail.notesPlaceholder')}
                value={notesText}
                onChange={(e) => setNotesText(e.target.value)}
                autoFocus
              />
            ) : project.description ? (
              <div
                className="bg-input-bg/50 rounded-xl p-4 cursor-pointer hover:bg-input-bg transition-colors"
                onClick={() => setNotesText(project.description ?? '')}
              >
                <p className="text-text-secondary text-[13px] leading-relaxed whitespace-pre-wrap">{project.description}</p>
                <p className="text-text-muted text-[11px] mt-2">{t('projectDetail.clickToEdit')}</p>
              </div>
            ) : (
              <button
                onClick={() => setNotesText('')}
                className="flex items-center justify-center gap-2 h-24 rounded-xl border-2 border-dashed border-border text-text-muted text-[13px] hover:border-accent/40 hover:text-accent transition-colors"
              >
                {t('projectDetail.addNotesCta')}
              </button>
            )}
          </div>
        </TabsContent>

        {/* Communications Tab */}
        <TabsContent value="communications">
          <div className="flex flex-col gap-4">
            {/* Sync button */}
            {project.clients?.email && (
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                  {t('projectDetail.emailComms')}
                </p>
                <EmailSyncButton
                  projectId={id!}
                  clientEmail={project.clients.email}
                  onSynced={refetchComms}
                />
              </div>
            )}

            {/* Email composer */}
            {project.clients?.email && (
              <div ref={composerRef}>
                <EmailComposer
                  projectId={id!}
                  clientEmail={project.clients.email}
                  onSent={refetchComms}
                  invoices={invoices.map((inv) => ({
                    id: inv.id,
                    invoice_number: inv.invoice_number,
                    total: inv.total,
                    status: inv.status,
                  }))}
                  replyTo={replyingTo}
                  onClearReply={() => setReplyingTo(null)}
                />
              </div>
            )}

            {/* Communication feed */}
            <CommunicationFeed
              communications={communications}
              loading={commsLoading}
              onReply={(comm) => {
                setReplyingTo({
                  subject: comm.subject,
                  threadId: comm.gmail_thread_id ?? '',
                  fromEmail: comm.from_email,
                })
                composerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }}
            />
          </div>
        </TabsContent>

        {/* Contracts Tab */}
        <TabsContent value="contracts">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                {t('projectDetail.projectContracts')}
              </p>
              <button
                onClick={() => setContractFormOpen(true)}
                className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-white text-[12px] font-semibold hover:opacity-90 transition-all active:scale-[0.98]"
                style={{ background: 'linear-gradient(135deg, #305445 0%, #3e6b5a 100%)' }}
              >
                <Plus size={12} />
                {t('projectDetail.newContract')}
              </button>
            </div>

            {contractsLoading ? (
              <div className="bg-surface rounded-[14px] shadow-card p-8 flex items-center justify-center">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                  <p className="text-text-muted text-[12px]">{t('projectDetail.loadingContracts')}</p>
                </div>
              </div>
            ) : contracts.length === 0 ? (
              <div className="bg-surface rounded-[14px] shadow-card p-8 flex items-center justify-center">
                <p className="text-text-muted text-[13px]">{t('projectDetail.noContracts')}</p>
              </div>
            ) : (
              <div className="bg-surface rounded-[14px] shadow-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[500px]">
                    <thead>
                      <tr className="text-[10px] text-text-muted font-semibold uppercase tracking-wide border-b border-border">
                        <th className="text-left px-5 py-3">{t('projectDetail.colTitle')}</th>
                        <th className="text-center px-3 py-3">{t('projectDetail.colStatus')}</th>
                        <th className="text-left px-3 py-3">{t('projectDetail.colCreated')}</th>
                        <th className="text-right px-5 py-3">{t('projectDetail.colActions')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {contracts.map((c) => {
                        const statusStyles: Record<string, string> = {
                          draft: 'bg-status-completed-bg text-status-completed-text',
                          sent: 'bg-status-scheduled-bg text-status-scheduled-text',
                          signed: 'bg-status-active-bg text-status-active-text',
                          expired: 'bg-negative-bg text-negative',
                        }
                        return (
                          <tr key={c.id} className="border-b border-border/50 last:border-0 hover:bg-input-bg/50 transition-colors">
                            <td className="px-5 py-3 text-text-primary text-[12px] font-semibold">{c.title}</td>
                            <td className="px-3 py-3 text-center">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusStyles[c.status] || ''}`}>
                                {c.status.charAt(0).toUpperCase() + c.status.slice(1)}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-text-muted text-[12px]">{formatDate(c.created_at?.split('T')[0])}</td>
                            <td className="px-5 py-3 text-right">
                              <div className="inline-flex items-center gap-1">
                                <button
                                  onClick={() => {
                                    const doc = generateContractPDF(c, c.contract_signatures?.[0], lang)
                                    doc.save(`${c.title.replace(/\s+/g, '-')}.pdf`)
                                  }}
                                  className="p-1.5 rounded hover:bg-border transition-colors"
                                  title={t('projectDetail.downloadPdf')}
                                >
                                  <Download size={12} className="text-text-muted" />
                                </button>
                                {c.status === 'sent' && (
                                  <button
                                    onClick={async () => {
                                      await navigator.clipboard.writeText(`${window.location.origin}/sign/${c.sign_token}`)
                                      setCopiedContractId(c.id)
                                      setTimeout(() => setCopiedContractId(null), 3000)
                                    }}
                                    className="p-1.5 rounded hover:bg-border transition-colors"
                                    title={copiedContractId === c.id ? t('projectDetail.copied') : t('projectDetail.copySignLink')}
                                  >
                                    {copiedContractId === c.id ? (
                                      <Check size={12} className="text-status-active-text" />
                                    ) : (
                                      <Link2 size={12} className="text-accent" />
                                    )}
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <ContractForm
              open={contractFormOpen}
              onOpenChange={setContractFormOpen}
              clients={project?.clients ? [{ id: project.clients.id, name: project.clients.name }] : []}
              projects={project ? [{ id: project.id, name: project.name }] : []}
              onSave={async (data: ContractFormData) => {
                await createContract({
                  client_id: data.clientId,
                  project_id: data.projectId || id || null,
                  title: data.title,
                  content: data.content,
                  status: 'draft',
                })
              }}
            />
          </div>
        </TabsContent>

        {/* Invoices Tab */}
        <TabsContent value="invoices">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                {t('projectDetail.projectInvoices')}
              </p>
              <button
                onClick={() => setInvoiceBuilderOpen(true)}
                className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-white text-[12px] font-semibold hover:opacity-90 transition-all active:scale-[0.98]"
                style={{ background: 'linear-gradient(135deg, #305445 0%, #3e6b5a 100%)' }}
              >
                <Plus size={12} />
                {t('projectDetail.generateInvoice')}
              </button>
            </div>

            <InvoiceBuilder
              open={invoiceBuilderOpen}
              onOpenChange={setInvoiceBuilderOpen}
              projectId={id!}
              onCreated={() => invoicesRefetch()}
            />

            {invoicesLoading ? (
              <div className="bg-surface rounded-[14px] shadow-card p-8 flex items-center justify-center">
                <Loader2 size={20} className="animate-spin text-accent" />
              </div>
            ) : invoices.length === 0 ? (
              <div className="bg-surface rounded-[14px] shadow-card p-8 flex items-center justify-center">
                <p className="text-text-muted text-[13px]">{t('projectDetail.noInvoices')}</p>
              </div>
            ) : (
              <div className="bg-surface rounded-[14px] shadow-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[600px]">
                    <thead>
                      <tr className="text-[10px] text-text-muted font-semibold uppercase tracking-wide border-b border-border">
                        <th className="text-left px-5 py-3">{t('projectDetail.colInvoiceNum')}</th>
                        <th className="text-center px-3 py-3">{t('projectDetail.colStatus')}</th>
                        <th className="text-right px-3 py-3">{t('projectDetail.colAmount')}</th>
                        <th className="text-left px-3 py-3">{t('projectDetail.colIssued')}</th>
                        <th className="text-left px-3 py-3">{t('projectDetail.colDue')}</th>
                        <th className="text-right px-5 py-3">{t('projectDetail.colActions')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.map((invoice) => {
                        const invStatus = INVOICE_STATUS_CONFIG[invoice.status] ?? INVOICE_STATUS_CONFIG.draft
                        return (
                          <tr
                            key={invoice.id}
                            className="border-b border-border/50 last:border-0 hover:bg-input-bg/50 transition-colors"
                          >
                            <td className="px-5 py-3">
                              <button
                                onClick={() => handlePreviewPDF(invoice)}
                                className="text-accent text-[12px] font-semibold hover:underline"
                              >
                                {invoice.invoice_number}
                              </button>
                            </td>
                            <td className="px-3 py-3 text-center">
                              <span
                                className={`${invStatus.bg} ${invStatus.text} inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold`}
                              >
                                {t(invStatus.labelKey)}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-text-primary text-[12px] font-bold text-right">
                              ${invoice.total.toFixed(2)}
                            </td>
                            <td className="px-3 py-3 text-text-muted text-[12px]">
                              {formatDate(invoice.issued_date)}
                            </td>
                            <td className="px-3 py-3 text-text-muted text-[12px]">
                              {formatDate(invoice.due_date)}
                            </td>
                            <td className="px-5 py-3 text-right">
                              <div className="inline-flex items-center gap-1">
                                <button
                                  onClick={() => handleDownloadPDF(invoice)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-accent hover:bg-accent-bg transition-colors"
                                  title={t('projectDetail.downloadPdf')}
                                >
                                  <Download size={12} />
                                  {t('projectDetail.pdf')}
                                </button>
                                {(invoice.status === 'sent' || invoice.status === 'overdue') && (
                                  <button
                                    onClick={() => handleGetPayLink(invoice)}
                                    disabled={paymentLoading === invoice.id}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-white hover:opacity-90 transition-colors"
                                    style={{ background: 'linear-gradient(135deg, #305445 0%, #3e6b5a 100%)' }}
                                    title={copiedPayId === invoice.id ? t('projectDetail.linkCopied') : t('projectDetail.getPayLink')}
                                  >
                                    {paymentLoading === invoice.id ? (
                                      <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                                    ) : copiedPayId === invoice.id ? (
                                      <><Check size={12} /> {t('projectDetail.copiedLabel')}</>
                                    ) : (
                                      <><CreditCard size={12} /> {t('projectDetail.pay')}</>
                                    )}
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Invoice Preview Modal */}
      {previewUrl && previewInvoice && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={cleanupPreview}
        >
          <div
            className="bg-surface rounded-2xl shadow-lg flex flex-col w-full max-w-3xl"
            style={{ height: 'min(90vh, 900px)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
              <h3 className="text-text-primary text-[14px] font-bold">
                {previewInvoice.invoice_number}
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownloadPDF(previewInvoice)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-white transition-colors"
                  style={{ background: 'linear-gradient(135deg, #305445 0%, #3e6b5a 100%)' }}
                >
                  <Download size={12} />
                  {t('projectDetail.downloadPdf')}
                </button>
                <button
                  onClick={cleanupPreview}
                  className="p-1.5 rounded-lg hover:bg-input-bg transition-colors text-text-muted"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
            {/* PDF Viewer */}
            <div className="flex-1 min-h-0">
              <iframe
                src={previewUrl}
                className="w-full h-full rounded-b-2xl"
                title="Invoice Preview"
              />
            </div>
          </div>
        </div>
      )}

      <ProjectForm
        open={projectFormOpen}
        onOpenChange={setProjectFormOpen}
        project={project ? {
          id: project.id,
          clientId: project.client_id,
          name: project.name,
          description: project.description ?? undefined,
          status: project.status,
          type: project.type ?? undefined,
          billingType: project.billing_type ?? 'hourly',
          hourlyRate: project.hourly_rate ?? undefined,
          monthlyRate: project.monthly_rate ?? undefined,
          startDate: project.start_date ?? undefined,
          endDate: project.end_date ?? undefined,
        } : null}
        clients={clients.map((c) => ({ id: c.id, name: c.name }))}
        onSave={async (data: ProjectFormData) => {
          await updateProject(project.id, {
            client_id: data.clientId,
            name: data.name,
            description: data.description ?? null,
            status: data.status,
            type: data.type ?? null,
            billing_type: data.billingType,
            hourly_rate: data.billingType === 'hourly' ? (data.hourlyRate ?? null) : null,
            monthly_rate: data.billingType === 'monthly' ? (data.monthlyRate ?? null) : null,
            start_date: data.startDate ?? null,
            end_date: data.endDate ?? null,
          })
        }}
      />
    </div>
  )
}
