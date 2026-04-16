import { useState, useMemo, useRef, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Plus, Loader2, Download, Eye, X, Receipt, CreditCard, Check, FileCheck, Link2, Trash2 } from 'lucide-react'
import { useProject, useProjects } from '../hooks/useProjects'
import { useTimeEntries } from '../hooks/useTimeEntries'
import { useInvoices, type Invoice, type InvoiceItem } from '../hooks/useInvoices'
import { useExpenses, useExpenseCategories } from '../hooks/useExpenses'
import { useTasks } from '../hooks/useTasks'
import TaskForm from '../components/TaskForm'
import type { TaskFormData } from '../components/TaskForm'
import TaskList from '../components/TaskList'
import type { TaskRow } from '../components/TaskList'
import { useContracts } from '../hooks/useContracts'
import ContractForm from '../components/ContractForm'
import type { ContractFormData } from '../components/ContractForm'
import { generateContractPDF } from '../components/ContractPDF'
import type { Expense } from '../hooks/useExpenses'
import { supabase } from '../lib/supabase'
import { useCommunications } from '../hooks/useCommunications'
import TimeEntryList from '../components/TimeEntryList'
import InvoiceBuilder from '../components/InvoiceBuilder'
import ExpenseForm from '../components/ExpenseForm'
import type { ExpenseFormData } from '../components/ExpenseForm'
import ExpenseList from '../components/ExpenseList'
import type { ExpenseRow } from '../components/ExpenseList'
import EmailComposer from '../components/EmailComposer'
import type { ReplyTarget } from '../components/EmailComposer'
import CommunicationFeed from '../components/CommunicationFeed'
import EmailSyncButton from '../components/EmailSyncButton'
import { generateInvoicePDF } from '../components/InvoicePDF'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  active: { label: 'Active', bg: 'bg-status-active-bg', text: 'text-status-active-text' },
  completed: { label: 'Completed', bg: 'bg-status-completed-bg', text: 'text-status-completed-text' },
  on_hold: { label: 'On Hold', bg: 'bg-status-hold-bg', text: 'text-status-hold-text' },
  cancelled: { label: 'Cancelled', bg: 'bg-status-completed-bg', text: 'text-status-completed-text' },
}

const INVOICE_STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  draft: { label: 'Draft', bg: 'bg-status-completed-bg', text: 'text-status-completed-text' },
  sent: { label: 'Sent', bg: 'bg-status-scheduled-bg', text: 'text-status-scheduled-text' },
  paid: { label: 'Paid', bg: 'bg-status-active-bg', text: 'text-status-active-text' },
  overdue: { label: 'Overdue', bg: 'bg-negative-bg', text: 'text-negative' },
}

function formatDate(iso: string | null): string {
  if (!iso) return '--'
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { project, loading: projectLoading, error: projectError } = useProject(id)
  const { deleteProject } = useProjects()
  const {
    entries,
    loading: entriesLoading,
    createEntry,
    updateEntry,
    deleteEntry,
    refetch: refetchEntries,
  } = useTimeEntries(id)
  const invoiceFilters = useMemo(() => ({ projectId: id }), [id])
  const { invoices, loading: invoicesLoading, refetch: invoicesRefetch } = useInvoices(invoiceFilters)
  const { communications, loading: commsLoading, refetch: refetchComms } = useCommunications(id)
  const {
    expenses,
    loading: expensesLoading,
    createExpense,
    updateExpense,
    deleteExpense,
  } = useExpenses(id)
  const { categories: expenseCategories } = useExpenseCategories()
  const {
    tasks,
    loading: tasksLoading,
    createTask,
    updateTask,
    deleteTask,
  } = useTasks(id)
  const [taskFormOpen, setTaskFormOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<TaskRow | null>(null)

  const contractFilters = useMemo(() => ({ projectId: id }), [id])
  const { contracts, loading: contractsLoading, createContract } = useContracts(contractFilters)

  const [invoiceBuilderOpen, setInvoiceBuilderOpen] = useState(false)
  const [contractFormOpen, setContractFormOpen] = useState(false)
  const [copiedContractId, setCopiedContractId] = useState<string | null>(null)
  const [paymentLoading, setPaymentLoading] = useState<string | null>(null)
  const [copiedPayId, setCopiedPayId] = useState<string | null>(null)
  const [expenseFormOpen, setExpenseFormOpen] = useState(false)
  const [editingExpense, setEditingExpense] = useState<ExpenseRow | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null)
  const previewBlobRef = useRef<string | null>(null)
  const [replyingTo, setReplyingTo] = useState<ReplyTarget | null>(null)
  const composerRef = useRef<HTMLDivElement | null>(null)

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

  // Compute summary stats from entries
  const totalHours = entries.reduce((sum, e) => sum + e.hours, 0)
  const billableHours = entries.filter((e) => e.billable).reduce((sum, e) => sum + e.hours, 0)
  const rate = project?.hourly_rate ?? 0
  const isMonthlyProject = project?.billing_type === 'monthly'
  const unbilledEntries = entries.filter((e) => e.billable && !e.invoice_id)
  const unbilledHours = unbilledEntries.reduce((sum, e) => sum + e.hours, 0)
  // For monthly projects unbilled amount reflects only uninvoiced expenses (retainer is billed manually)
  const unbilledAmount = isMonthlyProject ? 0 : unbilledHours * rate

  // Expense stats
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0)
  const unbilledExpenses = expenses.filter((e) => !e.invoice_id)
  const unbilledExpenseAmount = unbilledExpenses.reduce((sum, e) => sum + e.amount, 0)

  // Map expenses to ExpenseRow format
  const mappedExpenses: ExpenseRow[] = expenses.map((e) => ({
    id: e.id,
    projectId: e.project_id,
    description: e.description,
    amount: e.amount,
    date: e.date,
    category: e.category,
    receiptUrl: e.receipt_url ?? undefined,
  }))

  const handleExpenseSave = useCallback(async (data: ExpenseFormData) => {
    if (editingExpense) {
      await updateExpense(editingExpense.id, {
        description: data.description,
        amount: data.amount,
        date: data.date,
        category: data.category,
        receipt_url: data.receiptUrl ?? null,
      })
      setEditingExpense(null)
    } else {
      await createExpense({
        project_id: data.projectId || id!,
        description: data.description,
        amount: data.amount,
        date: data.date,
        category: data.category,
        receipt_url: data.receiptUrl ?? null,
        invoice_id: null,
      })
    }
  }, [editingExpense, createExpense, updateExpense, id])

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
    const task = tasks.find((t) => t.id === taskId)
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

  function handleEditEntry(entry: {
    id: string
    projectId: string
    description: string
    hours: number
    date: string
    billable: boolean
  }) {
    // For now, simple prompt-based edit for description
    const newDesc = window.prompt('Edit description:', entry.description)
    if (newDesc !== null && newDesc !== entry.description) {
      updateEntry(entry.id, { description: newDesc }).then(() => refetchEntries())
    }
  }

  async function handleDeleteEntry(entryId: string) {
    const confirmed = window.confirm('Delete this time entry?')
    if (!confirmed) return
    await deleteEntry(entryId)
  }

  if (projectLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-text-muted">
        <Loader2 size={28} className="animate-spin text-accent" />
        <p className="text-[13px] font-medium">Loading project...</p>
      </div>
    )
  }

  if (projectError || !project) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-text-muted">
        <p className="text-[13px] font-medium text-negative">
          {projectError ?? 'Project not found'}
        </p>
        <button
          onClick={() => navigate('/projects')}
          className="text-accent text-[13px] hover:underline"
        >
          Back to Projects
        </button>
      </div>
    )
  }

  const status = STATUS_CONFIG[project.status] ?? STATUS_CONFIG.active

  // Map entries to the shape TimeEntryList expects
  const listEntries = entries.map((e) => ({
    id: e.id,
    projectId: e.project_id,
    description: e.description ?? '',
    hours: e.hours,
    date: e.date,
    billable: e.billable,
  }))

  return (
    <div className="flex flex-col gap-5">
      {/* Back button */}
      <button
        onClick={() => navigate('/projects')}
        className="flex items-center gap-1 text-accent text-[13px] font-medium hover:underline w-fit"
      >
        <ArrowLeft size={14} />
        Back to Projects
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
                {status.label}
              </span>
            </div>
          </div>

          <div className="flex items-start gap-3 shrink-0">
            {project.billing_type === 'monthly'
              ? project.monthly_rate != null && (
                <div className="text-right">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                    Monthly Rate
                  </p>
                  <p className="text-text-primary text-[16px] font-bold">
                    ${project.monthly_rate.toFixed(2)}/mo
                  </p>
                </div>
              )
              : project.hourly_rate != null && (
                <div className="text-right">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                    Hourly Rate
                  </p>
                  <p className="text-text-primary text-[16px] font-bold">
                    ${project.hourly_rate.toFixed(2)}/hr
                  </p>
                </div>
              )}
            <button
              onClick={async () => {
                if (!confirm(`Delete "${project.name}" and all associated data? This cannot be undone.`)) return
                try {
                  await deleteProject(project.id)
                  navigate('/projects')
                } catch (err) {
                  alert(`Failed to delete project: ${err instanceof Error ? err.message : 'Unknown error'}`)
                }
              }}
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border text-negative text-[12px] font-medium hover:bg-negative/10 transition-colors"
            >
              <Trash2 size={12} />
              Delete
            </button>
          </div>
        </div>

        {project.description && (
          <p className="text-text-secondary text-[13px] mt-3 pt-3 border-t border-border leading-relaxed">
            {project.description}
          </p>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="tasks">
        <TabsList className="w-full overflow-x-auto flex-nowrap justify-start">
          <TabsTrigger value="tasks" className="text-[11px] sm:text-[12px] shrink-0">
            Tasks
          </TabsTrigger>
          <TabsTrigger value="time" className="text-[11px] sm:text-[12px] shrink-0">
            Time
          </TabsTrigger>
          <TabsTrigger value="communications" className="text-[11px] sm:text-[12px] shrink-0">
            Comms
          </TabsTrigger>
          <TabsTrigger value="expenses" className="text-[11px] sm:text-[12px] shrink-0">
            Expenses
          </TabsTrigger>
          <TabsTrigger value="contracts" className="text-[11px] sm:text-[12px] shrink-0">
            Contracts
          </TabsTrigger>
          <TabsTrigger value="invoices" className="text-[11px] sm:text-[12px] shrink-0">
            Invoices
          </TabsTrigger>
        </TabsList>

        {/* Tasks Tab */}
        <TabsContent value="tasks">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                Project Tasks
              </p>
              <button
                onClick={() => {
                  setEditingTask(null)
                  setTaskFormOpen(true)
                }}
                className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-white text-[12px] font-semibold hover:opacity-90 transition-all active:scale-[0.98]"
                style={{ background: 'linear-gradient(135deg, #0058be 0%, #2170e4 100%)' }}
              >
                <Plus size={12} />
                Add Task
              </button>
            </div>

            <TaskList
              tasks={tasks.map((t) => ({
                id: t.id,
                title: t.title,
                description: t.description ?? undefined,
                status: t.status,
                priority: t.priority,
                dueDate: t.due_date ?? undefined,
              }))}
              loading={tasksLoading}
              onToggle={(taskId, currentStatus) => {
                const newStatus = currentStatus === 'done' ? 'todo' : 'done'
                updateTask(taskId, { status: newStatus })
              }}
              onEdit={(task) => {
                setEditingTask(task)
                setTaskFormOpen(true)
              }}
              onDelete={(taskId) => deleteTask(taskId)}
              onTimerSave={async (taskId, hours, description) => {
                await createEntry({
                  project_id: id!,
                  description,
                  hours,
                  date: new Date().toISOString().split('T')[0],
                  billable: true,
                  invoice_id: null,
                  task_id: taskId,
                })
              }}
              onLogTime={handleTaskLogTime}
            />

            <TaskForm
              open={taskFormOpen}
              onOpenChange={(open) => {
                setTaskFormOpen(open)
                if (!open) setEditingTask(null)
              }}
              task={editingTask}
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
                    project_id: id!,
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
        </TabsContent>

        {/* Time Tracking Tab */}
        <TabsContent value="time">
          <div className="flex flex-col gap-4">
            {/* Note */}
            <p className="text-[12px] text-text-muted">
              Time entries are logged from the Tasks tab — use the clock icon on any task to log hours.
            </p>

            {/* Summary stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-surface rounded-[14px] shadow-card p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                  Total Hours
                </p>
                <p className="text-text-primary text-[20px] font-bold mt-1">
                  {totalHours.toFixed(2)}
                </p>
              </div>
              <div className="bg-surface rounded-[14px] shadow-card p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                  Billable Hours
                </p>
                <p className="text-text-primary text-[20px] font-bold mt-1">
                  {billableHours.toFixed(2)}
                </p>
              </div>
              <div className="bg-surface rounded-[14px] shadow-card p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                  Unbilled Amount
                </p>
                <p className="text-accent text-[20px] font-bold mt-1">
                  ${unbilledAmount.toFixed(2)}
                </p>
              </div>
            </div>

            {/* Time entries list */}
            <TimeEntryList
              entries={listEntries}
              onEdit={handleEditEntry}
              onDelete={handleDeleteEntry}
              loading={entriesLoading}
            />
          </div>
        </TabsContent>

        {/* Communications Tab */}
        <TabsContent value="communications">
          <div className="flex flex-col gap-4">
            {/* Sync button */}
            {project.clients?.email && (
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                  Email Communications
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

        {/* Expenses Tab */}
        <TabsContent value="expenses">
          <div className="flex flex-col gap-4">
            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-surface rounded-[14px] shadow-card p-4">
                <p className="text-text-muted text-[10px] font-semibold uppercase tracking-wide">Total Expenses</p>
                <p className="text-text-primary text-[20px] font-bold mt-1">
                  ${totalExpenses.toFixed(2)}
                </p>
              </div>
              <div className="bg-surface rounded-[14px] shadow-card p-4">
                <p className="text-text-muted text-[10px] font-semibold uppercase tracking-wide">Unbilled</p>
                <p className="text-text-primary text-[20px] font-bold mt-1">
                  ${unbilledExpenseAmount.toFixed(2)}
                </p>
              </div>
              <div className="bg-surface rounded-[14px] shadow-card p-4">
                <p className="text-text-muted text-[10px] font-semibold uppercase tracking-wide">Count</p>
                <p className="text-text-primary text-[20px] font-bold mt-1">
                  {expenses.length}
                </p>
              </div>
            </div>

            {/* Add Expense Button */}
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                Project Expenses
              </p>
              <button
                onClick={() => {
                  setEditingExpense(null)
                  setExpenseFormOpen(true)
                }}
                className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-white text-[12px] font-semibold hover:opacity-90 transition-all active:scale-[0.98]"
                style={{ background: 'linear-gradient(135deg, #0058be 0%, #2170e4 100%)' }}
              >
                <Plus size={12} />
                Add Expense
              </button>
            </div>

            {/* Expense List */}
            <ExpenseList
              expenses={mappedExpenses}
              loading={expensesLoading}
              onEdit={(exp) => {
                setEditingExpense(exp)
                setExpenseFormOpen(true)
              }}
              onDelete={(expId) => deleteExpense(expId)}
            />

            {/* Expense Form Dialog */}
            <ExpenseForm
              open={expenseFormOpen}
              onOpenChange={(open) => {
                setExpenseFormOpen(open)
                if (!open) setEditingExpense(null)
              }}
              expense={editingExpense}
              projectId={id}
              categories={expenseCategories}
              onSave={handleExpenseSave}
            />
          </div>
        </TabsContent>

        {/* Contracts Tab */}
        <TabsContent value="contracts">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                Project Contracts
              </p>
              <button
                onClick={() => setContractFormOpen(true)}
                className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-white text-[12px] font-semibold hover:opacity-90 transition-all active:scale-[0.98]"
                style={{ background: 'linear-gradient(135deg, #0058be 0%, #2170e4 100%)' }}
              >
                <Plus size={12} />
                New Contract
              </button>
            </div>

            {contractsLoading ? (
              <div className="bg-surface rounded-[14px] shadow-card p-8 flex items-center justify-center">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                  <p className="text-text-muted text-[12px]">Loading contracts...</p>
                </div>
              </div>
            ) : contracts.length === 0 ? (
              <div className="bg-surface rounded-[14px] shadow-card p-8 flex items-center justify-center">
                <p className="text-text-muted text-[13px]">No contracts yet.</p>
              </div>
            ) : (
              <div className="bg-surface rounded-[14px] shadow-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[500px]">
                    <thead>
                      <tr className="text-[10px] text-text-muted font-semibold uppercase tracking-wide border-b border-border">
                        <th className="text-left px-5 py-3">Title</th>
                        <th className="text-center px-3 py-3">Status</th>
                        <th className="text-left px-3 py-3">Created</th>
                        <th className="text-right px-5 py-3">Actions</th>
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
                                    const doc = generateContractPDF(c, c.contract_signatures?.[0])
                                    doc.save(`${c.title.replace(/\s+/g, '-')}.pdf`)
                                  }}
                                  className="p-1.5 rounded hover:bg-border transition-colors"
                                  title="Download PDF"
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
                                    title={copiedContractId === c.id ? 'Copied!' : 'Copy signing link'}
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
                Project Invoices
              </p>
              <button
                onClick={() => setInvoiceBuilderOpen(true)}
                className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-white text-[12px] font-semibold hover:opacity-90 transition-all active:scale-[0.98]"
                style={{ background: 'linear-gradient(135deg, #0058be 0%, #2170e4 100%)' }}
              >
                <Plus size={12} />
                Generate Invoice
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
                <p className="text-text-muted text-[13px]">No invoices yet for this project.</p>
              </div>
            ) : (
              <div className="bg-surface rounded-[14px] shadow-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[600px]">
                    <thead>
                      <tr className="text-[10px] text-text-muted font-semibold uppercase tracking-wide border-b border-border">
                        <th className="text-left px-5 py-3">Invoice #</th>
                        <th className="text-center px-3 py-3">Status</th>
                        <th className="text-right px-3 py-3">Amount</th>
                        <th className="text-left px-3 py-3">Issued</th>
                        <th className="text-left px-3 py-3">Due</th>
                        <th className="text-right px-5 py-3">Actions</th>
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
                                {invStatus.label}
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
                                  title="Download PDF"
                                >
                                  <Download size={12} />
                                  PDF
                                </button>
                                {(invoice.status === 'sent' || invoice.status === 'overdue') && (
                                  <button
                                    onClick={() => handleGetPayLink(invoice)}
                                    disabled={paymentLoading === invoice.id}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-white hover:opacity-90 transition-colors"
                                    style={{ background: 'linear-gradient(135deg, #0058be 0%, #2170e4 100%)' }}
                                    title={copiedPayId === invoice.id ? 'Link copied!' : 'Get pay link'}
                                  >
                                    {paymentLoading === invoice.id ? (
                                      <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                                    ) : copiedPayId === invoice.id ? (
                                      <><Check size={12} /> Copied</>
                                    ) : (
                                      <><CreditCard size={12} /> Pay</>
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
                  style={{ background: 'linear-gradient(135deg, #0058be 0%, #2170e4 100%)' }}
                >
                  <Download size={12} />
                  Download PDF
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
    </div>
  )
}
