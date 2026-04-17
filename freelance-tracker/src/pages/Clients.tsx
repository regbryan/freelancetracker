import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Mail, Phone, MoreVertical, Users, Loader2, Search, X, Trash2 } from 'lucide-react'
import { useClients } from '../hooks/useClients'
import type { Client } from '../hooks/useClients'
import ClientForm from '../components/ClientForm'
import type { ClientFormData } from '../components/ClientForm'
import { Button } from '../components/ui/button'

type StatusFilter = 'all' | 'active' | 'inactive'

export default function Clients() {
  const navigate = useNavigate()
  const { clients, loading, error, createClient, updateClient, deleteClient } = useClients()

  const [formOpen, setFormOpen] = useState(false)
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)

  const filteredClients = useMemo(() => {
    let result = clients
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.email && c.email.toLowerCase().includes(q)) ||
          (c.company && c.company.toLowerCase().includes(q)),
      )
    }
    if (statusFilter !== 'all') {
      const mapped = statusFilter === 'active' ? 'active' : 'inactive'
      result = result.filter((c) => c.status === mapped)
    }
    return result
  }, [clients, searchQuery, statusFilter])

  const totalReceivables = useMemo(() => {
    // Placeholder — could be derived from invoices
    return clients.length * 0
  }, [clients])

  function handleAddClick() {
    setEditingClient(null)
    setFormOpen(true)
  }

  function handleEditClick(e: React.MouseEvent, client: Client) {
    e.stopPropagation()
    setEditingClient(client)
    setFormOpen(true)
  }

  async function handleDeleteClick(e: React.MouseEvent, client: Client) {
    e.stopPropagation()
    const confirmed = window.confirm(
      `Are you sure you want to delete "${client.name}"? This action cannot be undone.`
    )
    if (!confirmed) return
    try {
      await deleteClient(client.id)
      if (selectedClient?.id === client.id) setSelectedClient(null)
    } catch (err) {
      alert(`Failed to delete "${client.name}": ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  async function handleSave(data: ClientFormData) {
    const payload = {
      name: data.name,
      email: data.email || null,
      company: data.company ?? null,
      phone: data.phone ?? null,
      hourly_rate: data.hourlyRate ?? null,
      notes: data.notes ?? null,
      status: data.status,
    }

    if (editingClient) {
      await updateClient(editingClient.id, payload)
    } else {
      await createClient(payload)
    }
  }

  function toFormClient(client: Client) {
    return {
      id: client.id,
      name: client.name,
      email: client.email ?? '',
      company: client.company ?? undefined,
      phone: client.phone ?? undefined,
      hourlyRate: client.hourly_rate ?? undefined,
      notes: client.notes ?? undefined,
      status: client.status,
    }
  }

  function getInitials(name: string) {
    return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
  }

  const statusColors: Record<string, { bg: string; text: string; label: string }> = {
    active: { bg: 'var(--color-status-active-bg)', text: 'var(--color-status-active-text)', label: 'Active' },
    inactive: { bg: 'var(--color-input-bg)', text: 'var(--color-text-muted)', label: 'Inactive' },
    paused: { bg: 'var(--color-status-hold-bg)', text: 'var(--color-status-hold-text)', label: 'Paused' },
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-text-muted">
        <Loader2 size={28} className="animate-spin text-accent" />
        <p className="text-[13px] font-medium">Loading clients...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-text-muted">
        <p className="text-[13px] font-medium text-negative">Failed to load clients</p>
        <p className="text-[11px]">{error}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Hero Banner */}
      <div
        className="rounded-[16px] text-white relative overflow-hidden"
        style={{
          backgroundColor: '#0a1223',
          backgroundImage: 'url(/clients-hero.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center 40%',
          minHeight: '180px',
        }}
      >
        {/* Dark gradient overlay for text legibility */}
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(90deg, rgba(10,18,35,0.82) 0%, rgba(10,18,35,0.55) 60%, rgba(10,18,35,0.25) 100%)' }}
        />

        {/* Text content */}
        <div className="relative z-10 px-8 py-8 max-w-lg">
          <p className="text-white/70 text-[11px] font-semibold uppercase tracking-[1.5px] mb-2">Clients Directory</p>
          <h2 className="text-[22px] font-bold leading-tight tracking-[-0.3px] italic">
            "Curation is the bridge between project and partnership."
          </h2>
          <p className="text-white/60 text-[12px] mt-2">
            Your client retention is up 14% this quarter through intentional engagement.
          </p>
        </div>
      </div>

      {/* Active Partners Header */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-text-primary text-[16px] font-bold">Active Partners</h3>
          <p className="text-text-muted text-[11px] mt-0.5">Managing {clients.length} accounts</p>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="text-text-muted text-[10px] font-semibold uppercase tracking-wide">Total Receivables</p>
            <p className="text-text-primary text-[22px] font-bold tracking-[-0.5px]">
              ${totalReceivables.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      </div>

      {/* Controls Row */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1">
          {(['all', 'active', 'inactive'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all ${
                statusFilter === f
                  ? 'text-white shadow-sm'
                  : 'bg-input-bg text-text-muted hover:text-text-primary hover:bg-border'
              }`}
              style={statusFilter === f ? { background: 'linear-gradient(135deg, #0058be 0%, #2170e4 100%)' } : undefined}
            >
              {f === 'all' ? 'All' : f === 'active' ? 'Retained' : 'Inactive'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {clients.length > 0 && (
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                placeholder="Search clients..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 w-48 pl-8 pr-3 bg-input-bg rounded-lg text-[11px] text-text-secondary placeholder:text-text-muted border border-border outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/30 transition-all"
              />
            </div>
          )}
          <Button size="sm" onClick={handleAddClick}>
            <Plus size={12} />
            Add Client
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex gap-4">
        {/* Client Table */}
        <div className={`bg-surface rounded-[14px] shadow-card overflow-hidden flex-1 min-w-0 ${selectedClient ? '' : 'w-full'}`}>
          {filteredClients.length === 0 && clients.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-text-muted">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #0058be20 0%, #2170e420 100%)' }}
              >
                <Users size={20} className="text-accent" />
              </div>
              <p className="text-[13px] font-medium">No clients yet</p>
              <p className="text-[11px]">Add your first client to get started.</p>
              <Button size="sm" className="mt-2" onClick={handleAddClick}>
                <Plus size={12} />
                Add Client
              </Button>
            </div>
          ) : filteredClients.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-text-muted">
              <Search size={20} className="text-text-muted/50" />
              <p className="text-[13px] font-medium">No clients match "{searchQuery}"</p>
              <button
                onClick={() => { setSearchQuery(''); setStatusFilter('all'); }}
                className="text-accent text-[12px] font-semibold hover:underline"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-5 py-3 text-[10px] font-semibold text-text-muted uppercase tracking-wider">Client Name</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-text-muted uppercase tracking-wider hidden md:table-cell">Organization</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-text-muted uppercase tracking-wider hidden sm:table-cell">Status</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-text-muted uppercase tracking-wider hidden lg:table-cell">Rate</th>
                  <th className="w-10 px-2 py-3" />
                </tr>
              </thead>
              <tbody>
                {filteredClients.map((client) => {
                  const status = statusColors[client.status] ?? statusColors.active
                  const isSelected = selectedClient?.id === client.id
                  return (
                    <tr
                      key={client.id}
                      onClick={() => setSelectedClient(isSelected ? null : client)}
                      className={`border-b border-border/50 cursor-pointer transition-colors hover:bg-accent-bg-subtle/50 ${
                        isSelected ? 'bg-accent-bg-subtle/70' : ''
                      }`}
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-bold shrink-0"
                            style={{ background: 'linear-gradient(135deg, #0058be 0%, #2170e4 100%)' }}
                          >
                            {getInitials(client.name)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-text-primary text-[13px] font-semibold truncate">{client.name}</p>
                            {client.email && (
                              <p className="text-text-muted text-[11px] truncate">{client.email}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 hidden md:table-cell">
                        <p className="text-text-secondary text-[12px]">{client.company || '—'}</p>
                      </td>
                      <td className="px-4 py-3.5 hidden sm:table-cell">
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                          style={{ background: status.bg, color: status.text }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: status.text }} />
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 hidden lg:table-cell">
                        <p className="text-text-secondary text-[12px] font-medium">
                          {client.hourly_rate != null ? `$${client.hourly_rate}` : '—'}
                        </p>
                      </td>
                      <td className="px-2 py-3.5">
                        <div className="flex items-center gap-0.5">
                          <button
                            onClick={(e) => handleEditClick(e, client)}
                            className="p-1 rounded hover:bg-input-bg transition-colors"
                            aria-label="Edit client"
                          >
                            <MoreVertical size={14} className="text-text-muted" />
                          </button>
                          <button
                            onClick={(e) => handleDeleteClick(e, client)}
                            className="p-1 rounded hover:bg-negative/10 transition-colors"
                            aria-label="Delete client"
                          >
                            <Trash2 size={13} className="text-negative" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Client Detail Sidebar */}
        {selectedClient && (
          <div className="w-[280px] shrink-0 hidden lg:block">
            <div className="bg-surface rounded-[14px] shadow-card p-5 sticky top-5">
              {/* Close */}
              <div className="flex justify-end mb-2">
                <button
                  onClick={() => setSelectedClient(null)}
                  className="p-1 rounded hover:bg-input-bg transition-colors"
                >
                  <X size={14} className="text-text-muted" />
                </button>
              </div>

              {/* Avatar + Name */}
              <div className="flex flex-col items-center text-center mb-5">
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center text-white text-[18px] font-bold mb-3"
                  style={{ background: 'linear-gradient(135deg, #0058be 0%, #2170e4 100%)' }}
                >
                  {getInitials(selectedClient.name)}
                </div>
                <h3 className="text-text-primary text-[15px] font-bold">{selectedClient.name}</h3>
                {selectedClient.company && (
                  <p className="text-text-muted text-[12px] mt-0.5">{selectedClient.company}</p>
                )}
              </div>

              {/* Contact Info */}
              <div className="flex flex-col gap-2.5 mb-5">
                {selectedClient.email && (
                  <div className="flex items-center gap-2 text-[12px]">
                    <Mail size={13} className="text-text-muted shrink-0" />
                    <span className="text-text-secondary truncate">{selectedClient.email}</span>
                  </div>
                )}
                {selectedClient.phone && (
                  <div className="flex items-center gap-2 text-[12px]">
                    <Phone size={13} className="text-text-muted shrink-0" />
                    <span className="text-text-secondary">{selectedClient.phone}</span>
                  </div>
                )}
              </div>

              {/* Rate */}
              {selectedClient.hourly_rate != null && (
                <div className="bg-input-bg/60 rounded-xl p-3 mb-4">
                  <p className="text-text-muted text-[10px] font-semibold uppercase tracking-wide">Hourly Rate</p>
                  <p className="text-text-primary text-[18px] font-bold mt-0.5">${selectedClient.hourly_rate}</p>
                </div>
              )}

              {/* Notes */}
              {selectedClient.notes && (
                <div className="mb-4">
                  <p className="text-text-muted text-[10px] font-semibold uppercase tracking-wide mb-1">Notes</p>
                  <p className="text-text-secondary text-[12px] leading-relaxed">{selectedClient.notes}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-col gap-2">
                <Button
                  size="sm"
                  className="w-full"
                  onClick={() => navigate(`/clients/${selectedClient.id}`)}
                >
                  Open Dashboard →
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={(e) => handleEditClick(e, selectedClient)}
                >
                  Edit Client
                </Button>
                <button
                  type="button"
                  onClick={(e) => handleDeleteClick(e, selectedClient)}
                  className="flex items-center justify-center gap-1.5 h-8 w-full rounded-lg border border-border text-negative text-[12px] font-medium hover:bg-negative/10 transition-colors"
                >
                  <Trash2 size={12} />
                  Delete Client
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit dialog */}
      <ClientForm
        open={formOpen}
        onOpenChange={setFormOpen}
        client={editingClient ? toFormClient(editingClient) : null}
        onSave={handleSave}
      />
    </div>
  )
}
