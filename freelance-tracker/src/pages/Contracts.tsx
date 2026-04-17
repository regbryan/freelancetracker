import { useState, useCallback, useMemo } from 'react'
import { Plus, FileCheck, Download, Link2, Check, Eye, ChevronDown } from 'lucide-react'
import { useContracts } from '../hooks/useContracts'
import type { Contract } from '../hooks/useContracts'
import { useClients } from '../hooks/useClients'
import { useProjects } from '../hooks/useProjects'
import ContractForm from '../components/ContractForm'
import type { ContractFormData } from '../components/ContractForm'
import { generateContractPDF } from '../components/ContractPDF'

function formatDate(iso: string | null): string {
  if (!iso) return '--'
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function statusBadge(
  status: string,
  onClick?: () => void,
  hasNext?: boolean,
) {
  const styles: Record<string, string> = {
    draft: 'bg-status-completed-bg text-status-completed-text',
    sent: 'bg-status-scheduled-bg text-status-scheduled-text',
    signed: 'bg-status-active-bg text-status-active-text',
    expired: 'bg-negative-bg text-negative',
  }

  const label = status.charAt(0).toUpperCase() + status.slice(1)

  if (!hasNext) {
    return (
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap ${styles[status] || ''}`}
      >
        {label}
      </span>
    )
  }

  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        onClick?.()
      }}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap cursor-pointer hover:opacity-80 transition-opacity ${styles[status] || ''}`}
      title={`Click to advance to "sent"`}
    >
      {label}
      <ChevronDown size={10} />
    </button>
  )
}

export default function Contracts() {
  const { contracts, loading, error, createContract, updateContract, refetch } = useContracts()
  const { clients } = useClients()
  const { projects } = useProjects()

  const [formOpen, setFormOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'sent' | 'signed'>('all')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const filteredContracts = useMemo(() => {
    if (statusFilter === 'all') return contracts
    return contracts.filter((c) => c.status === statusFilter)
  }, [contracts, statusFilter])

  const handleSave = useCallback(async (data: ContractFormData) => {
    await createContract({
      client_id: data.clientId,
      project_id: data.projectId || null,
      title: data.title,
      content: data.content,
      status: 'draft',
    })
  }, [createContract])

  const handleStatusAdvance = useCallback(async (contract: Contract) => {
    if (contract.status !== 'draft') return
    setUpdatingId(contract.id)
    try {
      await updateContract(contract.id, { status: 'sent' })
    } catch {
      // Error surfaced by hook
    } finally {
      setUpdatingId(null)
    }
  }, [updateContract])

  const handleDownload = useCallback((contract: Contract) => {
    try {
      const sig = contract.contract_signatures?.[0]
      const doc = generateContractPDF(contract, sig)
      doc.save(`${contract.title.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`)
    } catch (err) {
      console.error('Failed to generate PDF:', err)
      alert(`Failed to download contract: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }, [])

  const handleCopySignLink = useCallback(async (contract: Contract) => {
    const url = `${window.location.origin}/sign/${contract.sign_token}`
    try {
      await navigator.clipboard.writeText(url)
      setCopiedId(contract.id)
      setTimeout(() => setCopiedId(null), 3000)
    } catch {
      alert('Failed to copy link to clipboard')
    }
  }, [])

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-accent text-[11px] font-semibold uppercase tracking-[1.5px]">Legal</p>
          <h2 className="text-text-primary text-[20px] font-bold tracking-[-0.3px] mt-1">Contracts</h2>
        </div>
        <button
          onClick={() => setFormOpen(true)}
          className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-white text-[12px] font-semibold hover:opacity-90 transition-all active:scale-[0.98]"
          style={{ background: 'linear-gradient(135deg, #305445 0%, #3e6b5a 100%)' }}
        >
          <Plus size={12} />
          New Contract
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-negative-bg rounded-[14px] p-4 text-negative text-[12px]">
          Failed to load contracts: {error}
          <button onClick={refetch} className="ml-3 underline font-semibold">Retry</button>
        </div>
      )}

      {/* Status Filter Tabs */}
      {!loading && contracts.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {(['all', 'draft', 'sent', 'signed'] as const).map((status) => {
            const labels: Record<string, string> = { all: 'All', draft: 'Draft', sent: 'Sent', signed: 'Signed' }
            const isActive = statusFilter === status
            return (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all ${
                  isActive
                    ? 'bg-accent text-white shadow-sm'
                    : 'bg-input-bg text-text-muted hover:text-text-primary hover:bg-border'
                }`}
              >
                {labels[status]}
              </button>
            )
          })}
        </div>
      )}

      {/* Loading state */}
      {loading ? (
        <div className="bg-surface rounded-[14px] shadow-card p-8 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            <p className="text-text-muted text-[12px]">Loading contracts...</p>
          </div>
        </div>
      ) : contracts.length === 0 ? (
        /* Empty state */
        <div className="bg-surface rounded-[14px] shadow-card p-8 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-center">
            <FileCheck size={32} className="text-text-muted" />
            <p className="text-text-muted text-[13px]">No contracts yet.</p>
            <p className="text-text-muted text-[11px]">
              Create your first contract to get started.
            </p>
          </div>
        </div>
      ) : filteredContracts.length === 0 ? (
        /* No filter results */
        <div className="bg-surface rounded-[14px] shadow-card p-8 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2 text-center">
            <p className="text-text-muted text-[13px] font-medium">No contracts with status "{statusFilter}".</p>
            <button
              onClick={() => setStatusFilter('all')}
              className="text-accent text-[12px] font-semibold hover:underline"
            >
              Show all contracts
            </button>
          </div>
        </div>
      ) : (
        /* Contract table */
        <div className="bg-surface rounded-[14px] shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="text-[10px] text-text-muted font-semibold uppercase tracking-wide border-b border-border">
                  <th className="text-left px-5 py-3">Title</th>
                  <th className="text-left px-3 py-3">Client</th>
                  <th className="text-left px-3 py-3">Project</th>
                  <th className="text-center px-3 py-3">Status</th>
                  <th className="text-left px-3 py-3">Created</th>
                  <th className="text-right px-5 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredContracts.map((contract) => {
                  const canAdvance = contract.status === 'draft'

                  return (
                    <tr
                      key={contract.id}
                      className="border-b border-border/50 last:border-0 hover:bg-input-bg/50 transition-colors"
                    >
                      <td className="px-5 py-3">
                        <span className="text-text-primary text-[12px] font-semibold">
                          {contract.title}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-text-primary text-[12px] font-medium">
                        {contract.clients?.name ?? '--'}
                      </td>
                      <td className="px-3 py-3 text-text-secondary text-[12px]">
                        {contract.projects?.name ?? '--'}
                      </td>
                      <td className="px-3 py-3 text-center">
                        {updatingId === contract.id ? (
                          <span className="inline-flex items-center gap-1 text-text-muted text-[10px]">
                            <div className="w-3 h-3 border border-accent border-t-transparent rounded-full animate-spin" />
                          </span>
                        ) : (
                          statusBadge(
                            contract.status,
                            () => handleStatusAdvance(contract),
                            canAdvance,
                          )
                        )}
                      </td>
                      <td className="px-3 py-3 text-text-muted text-[12px]">
                        {formatDate(contract.created_at)}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              alert('Contract preview coming soon')
                            }}
                            className="p-1.5 rounded hover:bg-border transition-colors"
                            aria-label="Preview contract"
                            title="Preview"
                          >
                            <Eye size={12} className="text-text-muted" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDownload(contract)
                            }}
                            className="p-1.5 rounded hover:bg-border transition-colors"
                            aria-label="Download contract"
                            title="Download"
                          >
                            <Download size={12} className="text-text-muted" />
                          </button>
                          {contract.status === 'sent' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleCopySignLink(contract)
                              }}
                              className="p-1.5 rounded hover:bg-border transition-colors"
                              aria-label="Copy signing link"
                              title={copiedId === contract.id ? 'Copied!' : 'Copy signing link'}
                            >
                              {copiedId === contract.id ? (
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

      {/* Contract Form Dialog */}
      <ContractForm
        open={formOpen}
        onOpenChange={setFormOpen}
        clients={clients.map((c) => ({ id: c.id, name: c.name, company: c.company }))}
        projects={projects.map((p) => ({ id: p.id, name: p.name }))}
        onSave={handleSave}
      />
    </div>
  )
}
