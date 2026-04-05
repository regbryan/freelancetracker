import { useState, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Pencil, Plus, Mail, Phone, DollarSign, Loader2 } from 'lucide-react'
import { useClient, useClients } from '../hooks/useClients'
import { useProjects } from '../hooks/useProjects'
import { useInvoices } from '../hooks/useInvoices'
import ClientForm from '../components/ClientForm'
import type { ClientFormData } from '../components/ClientForm'
import ProjectForm from '../components/ProjectForm'
import type { ProjectFormData } from '../components/ProjectForm'
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

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { client, loading: clientLoading, error: clientError, refetch: refetchClient } = useClient(id)
  const { clients } = useClients()
  const { projects, loading: projectsLoading, createProject } = useProjects(
    useMemo(() => ({ clientId: id }), [id])
  )
  const invoiceFilters = useMemo(() => ({ clientId: id }), [id])
  const { invoices, loading: invoicesLoading } = useInvoices(invoiceFilters)

  const [clientFormOpen, setClientFormOpen] = useState(false)
  const [projectFormOpen, setProjectFormOpen] = useState(false)

  const { updateClient } = useClients()

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
        <p className="text-[13px] font-medium">Loading client...</p>
      </div>
    )
  }

  if (clientError || !client) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-text-muted">
        <p className="text-[13px] font-medium text-negative">
          {clientError ?? 'Client not found'}
        </p>
        <button
          onClick={() => navigate('/clients')}
          className="text-accent text-[13px] hover:underline"
        >
          Back to Clients
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
        Back to Clients
      </button>

      {/* Client info header */}
      <div className="bg-surface rounded-[14px] shadow-card p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3.5">
            {/* Avatar */}
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center text-white text-[16px] font-bold shrink-0"
              style={{ background: 'linear-gradient(135deg, #0058be 0%, #2170e4 100%)' }}
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

          <button
            onClick={() => setClientFormOpen(true)}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border text-text-secondary text-[12px] font-medium hover:bg-input-bg transition-colors"
          >
            <Pencil size={12} />
            Edit
          </button>
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
          <TabsTrigger value="projects" className="text-[12px]">
            Projects
          </TabsTrigger>
          <TabsTrigger value="invoices" className="text-[12px]">
            Invoices
          </TabsTrigger>
        </TabsList>

        {/* Projects Tab */}
        <TabsContent value="projects">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                Client Projects
              </p>
              <button
                onClick={() => setProjectFormOpen(true)}
                className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-white text-[12px] font-semibold hover:opacity-90 transition-all active:scale-[0.98]"
                style={{ background: 'linear-gradient(135deg, #0058be 0%, #2170e4 100%)' }}
              >
                <Plus size={12} />
                Add Project
              </button>
            </div>

            {projectsLoading ? (
              <div className="bg-surface rounded-[14px] shadow-card p-8 flex items-center justify-center">
                <Loader2 size={20} className="animate-spin text-accent" />
              </div>
            ) : projects.length === 0 ? (
              <div className="bg-surface rounded-[14px] shadow-card p-8 flex items-center justify-center">
                <p className="text-text-muted text-[13px]">No projects yet for this client.</p>
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
                          {status.label}
                        </span>
                      </div>
                      {project.hourly_rate != null && (
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

        {/* Invoices Tab */}
        <TabsContent value="invoices">
          <div className="flex flex-col gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
              Client Invoices
            </p>

            {invoicesLoading ? (
              <div className="bg-surface rounded-[14px] shadow-card p-8 flex items-center justify-center">
                <Loader2 size={20} className="animate-spin text-accent" />
              </div>
            ) : invoices.length === 0 ? (
              <div className="bg-surface rounded-[14px] shadow-card p-8 flex items-center justify-center">
                <p className="text-text-muted text-[13px]">No invoices yet for this client.</p>
              </div>
            ) : (
              <div className="bg-surface rounded-[14px] shadow-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[600px]">
                    <thead>
                      <tr className="text-[10px] text-text-muted font-semibold uppercase tracking-wide border-b border-border">
                        <th className="text-left px-5 py-3">Invoice #</th>
                        <th className="text-left px-3 py-3">Project</th>
                        <th className="text-right px-3 py-3">Amount</th>
                        <th className="text-center px-3 py-3">Status</th>
                        <th className="text-left px-3 py-3">Issued</th>
                        <th className="text-left px-5 py-3">Due</th>
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
                                {invStatus.label}
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
