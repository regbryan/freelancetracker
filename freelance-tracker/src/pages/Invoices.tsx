import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { Plus, Download, ChevronDown } from 'lucide-react'
import { useInvoices } from '../hooks/useInvoices'
import type { Invoice } from '../hooks/useInvoices'

const STATUS_FLOW: Record<string, Invoice['status'] | null> = {
  draft: 'sent',
  sent: 'paid',
  paid: null,
  overdue: 'paid',
}

function statusBadge(
  status: string,
  onClick?: () => void,
  hasNext?: boolean,
) {
  const styles: Record<string, string> = {
    paid: 'bg-status-active-bg text-status-active-text',
    sent: 'bg-status-scheduled-bg text-status-scheduled-text',
    draft: 'bg-status-completed-bg text-status-completed-text',
    overdue: 'bg-negative-bg text-negative',
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
      title={`Click to advance to "${STATUS_FLOW[status]}"`}
    >
      {label}
      <ChevronDown size={10} />
    </button>
  )
}

function formatDate(iso: string | null): string {
  if (!iso) return '--'
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)
}

export default function Invoices() {
  const { invoices, loading, error, updateInvoiceStatus, refetch } = useInvoices()
  const [showNewInvoiceMsg, setShowNewInvoiceMsg] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'sent' | 'paid' | 'overdue'>('all')

  const filteredInvoices = useMemo(() => {
    if (statusFilter === 'all') return invoices
    return invoices.filter((inv) => inv.status === statusFilter)
  }, [invoices, statusFilter])
  const msgRef = useRef<HTMLDivElement>(null)

  // Close the "new invoice" message when clicking outside
  useEffect(() => {
    if (!showNewInvoiceMsg) return

    function handleClickOutside(e: MouseEvent) {
      if (msgRef.current && !msgRef.current.contains(e.target as Node)) {
        setShowNewInvoiceMsg(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showNewInvoiceMsg])

  const handleStatusAdvance = useCallback(
    async (invoice: Invoice) => {
      const nextStatus = STATUS_FLOW[invoice.status]
      if (!nextStatus) return

      setUpdatingId(invoice.id)
      try {
        await updateInvoiceStatus(invoice.id, nextStatus)
      } catch {
        // Error is surfaced by the hook
      } finally {
        setUpdatingId(null)
      }
    },
    [updateInvoiceStatus],
  )

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-accent text-[11px] font-semibold uppercase tracking-[1.5px]">Billing</p>
          <h2 className="text-text-primary text-[20px] font-bold tracking-[-0.3px] mt-1">Invoices</h2>
        </div>

        <div className="relative" ref={msgRef}>
          <button
            onClick={() => setShowNewInvoiceMsg((prev) => !prev)}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-white text-[12px] font-semibold hover:opacity-90 transition-all active:scale-[0.98]"
            style={{ background: 'linear-gradient(135deg, #0058be 0%, #2170e4 100%)' }}
          >
            <Plus size={12} />
            New Invoice
          </button>

          {showNewInvoiceMsg && (
            <div className="absolute right-0 top-full mt-2 w-64 bg-surface rounded-[10px] shadow-card p-3 z-10 border border-border">
              <p className="text-text-secondary text-[12px] leading-relaxed">
                Create invoices from the <span className="font-semibold text-accent">Project Detail</span> page,
                where you can select specific time entries to bill.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-negative-bg rounded-[14px] p-4 text-negative text-[12px]">
          Failed to load invoices: {error}
          <button onClick={refetch} className="ml-3 underline font-semibold">
            Retry
          </button>
        </div>
      )}

      {/* Status Filter Tabs */}
      {!loading && invoices.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {(['all', 'draft', 'sent', 'paid', 'overdue'] as const).map((status) => {
            const labels: Record<string, string> = { all: 'All', draft: 'Draft', sent: 'Sent', paid: 'Paid', overdue: 'Overdue' }
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
            <p className="text-text-muted text-[12px]">Loading invoices...</p>
          </div>
        </div>
      ) : invoices.length === 0 ? (
        /* Empty state */
        <div className="bg-surface rounded-[14px] shadow-card p-8 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2 text-center">
            <p className="text-text-muted text-[13px]">No invoices yet.</p>
            <p className="text-text-muted text-[11px]">
              Create your first invoice from a Project Detail page.
            </p>
          </div>
        </div>
      ) : filteredInvoices.length === 0 ? (
        /* No filter results */
        <div className="bg-surface rounded-[14px] shadow-card p-8 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2 text-center">
            <p className="text-text-muted text-[13px] font-medium">No invoices with status "{statusFilter}".</p>
            <button
              onClick={() => setStatusFilter('all')}
              className="text-accent text-[12px] font-semibold hover:underline"
            >
              Show all invoices
            </button>
          </div>
        </div>
      ) : (
        /* Invoice table */
        <div className="bg-surface rounded-[14px] shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="text-[10px] text-text-muted font-semibold uppercase tracking-wide border-b border-border">
                  <th className="text-left px-5 py-3">Invoice #</th>
                  <th className="text-left px-3 py-3">Client</th>
                  <th className="text-left px-3 py-3">Project</th>
                  <th className="text-right px-3 py-3">Amount</th>
                  <th className="text-center px-3 py-3">Status</th>
                  <th className="text-left px-3 py-3">Issued</th>
                  <th className="text-left px-3 py-3">Due</th>
                  <th className="text-right px-5 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map((inv) => {
                  const isSelected = selectedId === inv.id
                  const nextStatus = STATUS_FLOW[inv.status]

                  return (
                    <tr
                      key={inv.id}
                      onClick={() => setSelectedId(isSelected ? null : inv.id)}
                      className={`border-b border-border/50 last:border-0 hover:bg-input-bg/50 transition-colors cursor-pointer ${
                        isSelected ? 'bg-accent/5 ring-1 ring-inset ring-accent/20' : ''
                      }`}
                    >
                      <td className="px-5 py-3 text-accent text-[12px] font-semibold">
                        {inv.invoice_number}
                      </td>
                      <td className="px-3 py-3 text-text-primary text-[12px] font-medium">
                        {inv.projects?.clients?.name ?? '--'}
                      </td>
                      <td className="px-3 py-3 text-text-secondary text-[12px]">
                        {inv.projects?.name ?? '--'}
                      </td>
                      <td className="px-3 py-3 text-text-primary text-[12px] font-bold text-right">
                        {formatCurrency(inv.total)}
                      </td>
                      <td className="px-3 py-3 text-center">
                        {updatingId === inv.id ? (
                          <span className="inline-flex items-center gap-1 text-text-muted text-[10px]">
                            <div className="w-3 h-3 border border-accent border-t-transparent rounded-full animate-spin" />
                          </span>
                        ) : (
                          statusBadge(
                            inv.status,
                            () => handleStatusAdvance(inv),
                            !!nextStatus,
                          )
                        )}
                      </td>
                      <td className="px-3 py-3 text-text-muted text-[12px]">
                        {formatDate(inv.issued_date)}
                      </td>
                      <td className="px-3 py-3 text-text-muted text-[12px]">
                        {formatDate(inv.due_date)}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={(e) => e.stopPropagation()}
                            className="p-1.5 rounded hover:bg-border transition-colors"
                            aria-label="Download invoice"
                          >
                            <Download size={12} className="text-text-muted" />
                          </button>
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
  )
}
