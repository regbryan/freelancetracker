import { useState, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Pencil, Plus, Mail, Phone, DollarSign, Loader2, Trash2, BookOpen, Calendar } from 'lucide-react'
import { useClient, useClients } from '../hooks/useClients'
import { useProjects } from '../hooks/useProjects'
import { useInvoices } from '../hooks/useInvoices'
import { useMeetingNotes } from '../hooks/useMeetingNotes'
import ClientForm from '../components/ClientForm'
import type { ClientFormData } from '../components/ClientForm'
import ProjectForm from '../components/ProjectForm'
import type { ProjectFormData } from '../components/ProjectForm'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useI18n } from '../lib/i18n'

const STATUS_CONFIG: Record<string, { labelKey: string; bg: string; text: string }> = {
  active: { labelKey: 'clientDetail.statusActive', bg: 'bg-status-active-bg', text: 'text-status-active-text' },
  completed: { labelKey: 'clientDetail.statusCompleted', bg: 'bg-status-completed-bg', text: 'text-status-completed-text' },
  on_hold: { labelKey: 'clientDetail.statusOnHold', bg: 'bg-status-hold-bg', text: 'text-status-hold-text' },
  cancelled: { labelKey: 'clientDetail.statusCancelled', bg: 'bg-status-completed-bg', text: 'text-status-completed-text' },
}

const INVOICE_STATUS_CONFIG: Record<string, { labelKey: string; bg: string; text: string }> = {
  draft: { labelKey: 'clientDetail.invStatusDraft', bg: 'bg-status-completed-bg', text: 'text-status-completed-text' },
  sent: { labelKey: 'clientDetail.invStatusSent', bg: 'bg-status-scheduled-bg', text: 'text-status-scheduled-text' },
  paid: { labelKey: 'clientDetail.invStatusPaid', bg: 'bg-status-active-bg', text: 'text-status-active-text' },
  overdue: { labelKey: 'clientDetail.invStatusOverdue', bg: 'bg-negative-bg', text: 'text-negative' },
}

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t, lang } = useI18n()

  const formatDate = (iso: string | null): string => {
    if (!iso) return '--'
    const d = new Date(iso + 'T00:00:00')
    return d.toLocaleDateString(lang === 'es' ? 'es-ES' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const { client, loading: clientLoading, error: clientError, refetch: refetchClient } = useClient(id)
  const { clients } = useClients()
  const { projects, loading: projectsLoading, createProject } = useProjects(
    useMemo(() => ({ clientId: id }), [id])
  )
  const invoiceFilters = useMemo(() => ({ clientId: id }), [id])
  const { invoices, loading: invoicesLoading } = useInvoices(invoiceFilters)
  const meetingFilters = useMemo(() => ({ clientId: id }), [id])
  const { meetingNotes, loading: meetingsLoading } = useMeetingNotes(meetingFilters)

  const [clientFormOpen, setClientFormOpen] = useState(false)
  const [projectFormOpen, setProjectFormOpen] = useState(false)
  const [notesText, setNotesText] = useState<string | null>(null)
  const [notesSaving, setNotesSaving] = useState(false)

  const { updateClient, deleteClient } = useClients()

  async function handleDeleteClient() {
    if (!client) return
    if (!confirm(t('clientDetail.confirmDelete', { name: client.name }))) return
    try {
      await deleteClient(client.id)
      navigate('/clients')
    } catch (err) {
      alert(t('clientDetail.failedDelete', { error: err instanceof Error ? err.message : t('clientDetail.unknownError') }))
    }
  }

  async function handleNotesSave() {
    if (!client || notesText === null) return
    setNotesSaving(true)
    try {
      await updateClient(client.id, { notes: notesText || null })
      refetchClient()
    } finally {
      setNotesSaving(false)
    }
  }

  async function handleClientSave(data: ClientFormData) {
    if (!client) return
    await updateClient(client.id, {
      name: data.name,
      email: data.email || null,
      company: data.company ?? null,
      phone: data.phone ?? null,
      hourly_rate: data.hourlyRate ?? null,
      notes: data.notes ?? null,
    })
    refetchClient()
  }

  const projectTypes = useMemo(() => {
    const types = new Set<string>()
    for (const p of projects) {
      if (p.type) types.add(p.type)
    }
    return Array.from(types).sort()
  }, [projects])

  async function handleProjectSave(data: ProjectFormData) {
    await createProject({
      client_id: data.clientId,
      name: data.name,
      description: data.description ?? null,
      status: data.status,
      type: data.type ?? null,
      hourly_rate: data.hourlyRate ?? null,
    })
  }

  function toFormClient() {
    if (!client) return null
    return {
      id: client.id,
      name: client.name,
      email: client.email ?? '',
      company: client.company ?? undefined,
      phone: client.phone ?? undefined,
      hourlyRate: client.hourly_rate ?? undefined,
      notes: client.notes ?? undefined,
    }
  }

  if (clientLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-text-muted">
        <Loader2 size={28} className="animate-spin text-accent" />
        <p className="text-[13px] font-medium">{t('clientDetail.loading')}</p>
      </div>
    )
  }

  if (clientError || !client) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-text-muted">
        <p className="text-[13px] font-medium text-negative">
          {clientError ?? t('clientDetail.notFound')}
        </p>
        <button
          onClick={() => navigate('/clients')}
          className="text-accent text-[13px] hover:underline"
        >
          {t('clientDetail.back')}
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Back button */}
      <button
        onClick={() => navigate('/clients')}
        className="flex items-center gap-1 text-accent text-[13px] font-medium hover:underline w-fit"
      >
        <ArrowLeft size={14} />
        {t('clientDetail.back')}
      </button>

      {/* Client info header */}
      <div className="bg-surface rounded-[14px] shadow-card p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3.5">
            {/* Avatar */}
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center text-white text-[16px] font-bold shrink-0"
              style={{ background: 'linear-gradient(135deg, #305445 0%, #3e6b5a 100%)' }}
            >
              {client.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-text-primary text-[20px] font-bold tracking-[-0.3px]">
                {client.name}
              </h2>
              {client.company && (
                <p className="text-text-secondary text-[13px]">{client.company}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setClientFormOpen(true)}
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border text-text-secondary text-[12px] font-medium hover:bg-input-bg transition-colors"
            >
              <Pencil size={12} />
              {t('common.edit')}
            </button>
            <button
              onClick={handleDeleteClient}
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border text-negative text-[12px] font-medium hover:bg-negative/10 transition-colors"
            >
              <Trash2 size={12} />
              {t('common.delete')}
            </button>
          </div>
        </div>

        {/* Contact details row */}
        <div className="flex flex-wrap items-center gap-5 mt-4 pt-4 border-t border-border">
          {client.email && (
            <div className="flex items-center gap-1.5 text-text-muted text-[12px]">
              <Mail size={12} />
              <span>{client.email}</span>
            </div>
          )}
          {client.phone && (
            <div className="flex items-center gap-1.5 text-text-muted text-[12px]">
              <Phone size={12} />
              <span>{client.phone}</span>
            </div>
          )}
          {client.hourly_rate != null && (
            <div className="flex items-center gap-1.5 text-text-muted text-[12px]">
              <DollarSign size={12} />
              <span>${client.hourly_rate.toFixed(2)}/hr</span>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="projects">
        <TabsList>
          <TabsTrigger value="projects" className="text-[12px]">{t('clientDetail.tabProjects')}</TabsTrigger>
          <TabsTrigger value="meetings" className="text-[12px]">{t('clientDetail.tabMeetings')}</TabsTrigger>
          <TabsTrigger value="notes" className="text-[12px]">{t('clientDetail.tabNotes')}</TabsTrigger>
          <TabsTrigger value="invoices" className="text-[12px]">{t('clientDetail.tabInvoices')}</TabsTrigger>
        </TabsList>

        {/* Projects Tab */}
        <TabsContent value="projects">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                {t('clientDetail.clientProjects')}
              </p>
              <button
                onClick={() => setProjectFormOpen(true)}
                className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-white text-[12px] font-semibold hover:opacity-90 transition-all active:scale-[0.98]"
                style={{ background: 'linear-gradient(135deg, #305445 0%, #3e6b5a 100%)' }}
              >
                <Plus size={12} />
                {t('clientDetail.addProject')}
              </button>
            </div>

            {projectsLoading ? (
              <div className="bg-surface rounded-[14px] shadow-card p-8 flex items-center justify-center">
                <Loader2 size={20} className="animate-spin text-accent" />
              </div>
            ) : projects.length === 0 ? (
              <div className="bg-surface rounded-[14px] shadow-card p-8 flex items-center justify-center">
                <p className="text-text-muted text-[13px]">{t('clientDetail.noProjects')}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {projects.map((project) => {
                  const status = STATUS_CONFIG[project.status] ?? STATUS_CONFIG.active
                  return (
                    <Link
                      key={project.id}
                      to={`/projects/${project.id}`}
                      className="bg-surface rounded-[14px] shadow-card p-4 hover:shadow-card-hover transition-shadow block"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="text-text-primary text-[13px] font-bold truncate">
                          {project.name}
                        </h4>
                        <span
                          className={`${status.bg} ${status.text} text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ml-2`}
                        >
                          {t(status.labelKey)}
                        </span>
                      </div>
                      {project.billing_type === 'monthly'
                        ? project.monthly_rate != null && (
                          <p className="text-text-muted text-[11px]">
                            ${project.monthly_rate.toFixed(2)}/mo
                          </p>
                        )
                        : project.hourly_rate != null && (
                          <p className="text-text-muted text-[11px]">
                            ${project.hourly_rate.toFixed(2)}/hr
                          </p>
                        )}
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Meetings Tab */}
        <TabsContent value="meetings">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">{t('clientDetail.meetingNotes')}</p>
              <button
                onClick={() => navigate('/meetings')}
                className="text-accent text-[11px] font-semibold hover:underline"
              >
                {t('common.viewAll')}
              </button>
            </div>

            {meetingsLoading ? (
              <div className="bg-surface rounded-[14px] shadow-card p-8 flex items-center justify-center">
                <Loader2 size={20} className="animate-spin text-accent" />
              </div>
            ) : meetingNotes.length === 0 ? (
              <div className="bg-surface rounded-[14px] shadow-card p-8 flex flex-col items-center justify-center gap-2">
                <BookOpen size={20} className="text-text-muted/40" />
                <p className="text-text-muted text-[13px]">{t('clientDetail.noMeetings')}</p>
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
                        {note.summary && (
                          <p className="text-text-muted text-[11px] truncate mt-0.5">{note.summary}</p>
                        )}
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
              <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">{t('clientDetail.clientNotes')}</p>
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
                    {notesSaving ? t('clientDetail.saving') : t('common.save')}
                  </button>
                </div>
              )}
            </div>

            {notesText !== null ? (
              <textarea
                className="w-full min-h-[180px] rounded-xl border border-border bg-input-bg px-4 py-3 text-[13px] text-text-primary leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-accent/30"
                placeholder={t('clientDetail.notesPlaceholder')}
                value={notesText}
                onChange={(e) => setNotesText(e.target.value)}
                autoFocus
              />
            ) : client.notes ? (
              <div
                className="bg-input-bg/50 rounded-xl p-4 cursor-pointer hover:bg-input-bg transition-colors"
                onClick={() => setNotesText(client.notes ?? '')}
              >
                <p className="text-text-secondary text-[13px] leading-relaxed whitespace-pre-wrap">{client.notes}</p>
                <p className="text-text-muted text-[11px] mt-2">{t('clientDetail.clickToEdit')}</p>
              </div>
            ) : (
              <button
                onClick={() => setNotesText('')}
                className="flex items-center justify-center gap-2 h-24 rounded-xl border-2 border-dashed border-border text-text-muted text-[13px] hover:border-accent/40 hover:text-accent transition-colors"
              >
                {t('clientDetail.addNotesCta')}
              </button>
            )}
          </div>
        </TabsContent>

        {/* Invoices Tab */}
        <TabsContent value="invoices">
          <div className="flex flex-col gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
              {t('clientDetail.clientInvoices')}
            </p>

            {invoicesLoading ? (
              <div className="bg-surface rounded-[14px] shadow-card p-8 flex items-center justify-center">
                <Loader2 size={20} className="animate-spin text-accent" />
              </div>
            ) : invoices.length === 0 ? (
              <div className="bg-surface rounded-[14px] shadow-card p-8 flex items-center justify-center">
                <p className="text-text-muted text-[13px]">{t('clientDetail.noInvoices')}</p>
              </div>
            ) : (
              <div className="bg-surface rounded-[14px] shadow-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[600px]">
                    <thead>
                      <tr className="text-[10px] text-text-muted font-semibold uppercase tracking-wide border-b border-border">
                        <th className="text-left px-5 py-3">{t('clientDetail.colInvoiceNum')}</th>
                        <th className="text-left px-3 py-3">{t('clientDetail.colProject')}</th>
                        <th className="text-right px-3 py-3">{t('clientDetail.colAmount')}</th>
                        <th className="text-center px-3 py-3">{t('clientDetail.colStatus')}</th>
                        <th className="text-left px-3 py-3">{t('clientDetail.colIssued')}</th>
                        <th className="text-left px-5 py-3">{t('clientDetail.colDue')}</th>
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
                            <td className="px-5 py-3 text-text-primary text-[12px] font-semibold">
                              {invoice.invoice_number}
                            </td>
                            <td className="px-3 py-3 text-text-secondary text-[12px]">
                              {invoice.projects?.name ?? '--'}
                            </td>
                            <td className="px-3 py-3 text-text-primary text-[12px] font-bold text-right">
                              ${invoice.total.toFixed(2)}
                            </td>
                            <td className="px-3 py-3 text-center">
                              <span
                                className={`${invStatus.bg} ${invStatus.text} inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold`}
                              >
                                {t(invStatus.labelKey)}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-text-muted text-[12px]">
                              {formatDate(invoice.issued_date)}
                            </td>
                            <td className="px-5 py-3 text-text-muted text-[12px]">
                              {formatDate(invoice.due_date)}
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

      {/* Edit Client Dialog */}
      <ClientForm
        open={clientFormOpen}
        onOpenChange={setClientFormOpen}
        client={toFormClient()}
        onSave={handleClientSave}
      />

      {/* Add Project Dialog */}
      <ProjectForm
        open={projectFormOpen}
        onOpenChange={setProjectFormOpen}
        clients={clients.map((c) => ({ id: c.id, name: c.name }))}
        projectTypes={projectTypes}
        project={id ? { id: '', clientId: id, name: '', status: 'active' } : undefined}
        onSave={handleProjectSave}
      />
    </div>
  )
}
