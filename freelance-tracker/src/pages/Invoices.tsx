import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { Plus, Download, ChevronDown, X, Eye, CreditCard, Link2, Check, Pencil } from 'lucide-react'
import { useInvoices } from '../hooks/useInvoices'
import type { Invoice, InvoiceItem } from '../hooks/useInvoices'
import { supabase } from '../lib/supabase'
import { generateInvoicePDF } from '../components/InvoicePDF'
import InvoiceEditDialog from '../components/InvoiceEditDialog'
import InvoiceInsight from '../components/InvoiceInsight'
import { useI18n } from '../lib/i18n'

const STATUS_FLOW: Record<string, Invoice['status'] | null> = {
  draft: 'sent',
  sent: 'paid',
  paid: null,
  overdue: 'paid',
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
  const { t, lang } = useI18n()
  const { invoices, loading, error, updateInvoiceStatus, refetch } = useInvoices()
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null)
  const [showNewInvoiceMsg, setShowNewInvoiceMsg] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'sent' | 'paid' | 'overdue'>('all')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null)
  const previewBlobRef = useRef<string | null>(null)

  function formatDate(iso: string | null): string {
    if (!iso) return '--'
    const d = new Date(iso + 'T00:00:00')
    return d.toLocaleDateString(lang === 'es' ? 'es-ES' : 'en-US', { month: 'short', day: 'numeric' })
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

    const labelMap: Record<string, string> = {
      draft: t('invoices.statusDraft'),
      sent: t('invoices.statusSent'),
      paid: t('invoices.statusPaid'),
      overdue: t('invoices.statusOverdue'),
    }
    const label = labelMap[status] ?? status

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
        title={t('invoices.advanceTo', { status: String(STATUS_FLOW[status] ?? '') })}
      >
        {label}
        <ChevronDown size={10} />
      </button>
    )
  }

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

  const buildPDF = useCallback(async (invoice: Invoice) => {
    const { data: items, error: itemsError } = await supabase
      .from('invoice_items')
      .select('*')
      .eq('invoice_id', invoice.id)

    if (itemsError) throw new Error(t('invoices.failedLoadItems', { error: itemsError.message }))

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('*, clients(id, name, email, company)')
      .eq('id', invoice.project_id)
      .single()

    if (projectError || !project) throw new Error(t('invoices.failedLoadProject'))

    const client = Array.isArray(project.clients) ? project.clients[0] : project.clients
    const clientInfo = {
      id: client?.id ?? '',
      name: client?.name ?? 'Client',
      email: client?.email,
      company: client?.company,
    }

    return generateInvoicePDF(invoice, (items as InvoiceItem[]) ?? [], project, clientInfo, lang)
  }, [t, lang])

  function cleanupPreview() {
    if (previewBlobRef.current) {
      URL.revokeObjectURL(previewBlobRef.current)
      previewBlobRef.current = null
    }
    setPreviewUrl(null)
    setPreviewInvoice(null)
  }

  const handleDownloadPDF = useCallback(async (invoice: Invoice) => {
    try {
      const doc = await buildPDF(invoice)
      doc.save(`${invoice.invoice_number}.pdf`)
    } catch (err) {
      console.error('Failed to generate PDF:', err)
      alert(t('invoices.failedDownload', { error: err instanceof Error ? err.message : t('invoices.unknownError') }))
    }
  }, [buildPDF, t])

  const handlePreviewPDF = useCallback(async (invoice: Invoice) => {
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
      alert(t('invoices.failedPreview', { error: err instanceof Error ? err.message : t('invoices.unknownError') }))
    }
  }, [buildPDF, t])

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

  const [paymentLoading, setPaymentLoading] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const handleGetPayLink = useCallback(async (invoice: Invoice) => {
    const apiUrl = import.meta.env.VITE_CALENDAR_API_URL || ''
    if (!apiUrl) {
      alert(t('invoices.paymentApiNotConfigured'))
      return
    }

    setPaymentLoading(invoice.id)
    try {
      const res = await fetch(`${apiUrl}/api/create-checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoice_number,
          amount: invoice.total,
          clientEmail: undefined,
          returnUrl: window.location.origin + '/invoices',
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || t('invoices.failedCreatePayLink', { error: '' }))

      // Copy payment URL to clipboard
      await navigator.clipboard.writeText(data.url)
      setCopiedId(invoice.id)
      setTimeout(() => setCopiedId(null), 3000)

      // Also update the invoice with the payment URL
      await supabase
        .from('invoices')
        .update({ payment_url: data.url })
        .eq('id', invoice.id)
    } catch (err) {
      alert(t('invoices.failedCreatePayLink', { error: err instanceof Error ? err.message : t('invoices.unknownError') }))
    } finally {
      setPaymentLoading(null)
    }
  }, [t])

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-accent text-[11px] font-semibold uppercase tracking-[1.5px]">{t('invoices.billing')}</p>
          <h2 className="text-text-primary text-[20px] font-bold tracking-[-0.3px] mt-1">{t('invoices.title')}</h2>
        </div>

        <div className="relative" ref={msgRef}>
          <button
            onClick={() => setShowNewInvoiceMsg((prev) => !prev)}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-white text-[12px] font-semibold hover:opacity-90 transition-all active:scale-[0.98]"
            style={{ background: 'linear-gradient(135deg, #305445 0%, #3e6b5a 100%)' }}
          >
            <Plus size={12} />
            {t('invoices.createInvoice')}
          </button>

          {showNewInvoiceMsg && (
            <div className="absolute right-0 top-full mt-2 w-64 bg-surface rounded-[10px] shadow-card p-3 z-10 border border-border">
              <p className="text-text-secondary text-[12px] leading-relaxed">
                {t('invoices.newInvoiceTip')} <span className="font-semibold text-accent">{t('invoices.projectDetailLabel')}</span>{t('invoices.newInvoiceTipSuffix')}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Collection Insight */}
      {!loading && <InvoiceInsight invoices={invoices} />}

      {/* Error state */}
      {error && (
        <div className="bg-negative-bg rounded-[14px] p-4 text-negative text-[12px]">
          {t('invoices.failedToLoad', { error: String(error) })}
          <button onClick={refetch} className="ml-3 underline font-semibold">
            {t('invoices.retry')}
          </button>
        </div>
      )}

      {/* Status Filter Tabs */}
      {!loading && invoices.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {(['all', 'draft', 'sent', 'paid', 'overdue'] as const).map((status) => {
            const labels: Record<string, string> = {
              all: t('invoices.filterAll'),
              draft: t('invoices.filterDraft'),
              sent: t('invoices.filterSent'),
              paid: t('invoices.filterPaid'),
              overdue: t('invoices.filterOverdue'),
            }
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
            <p className="text-text-muted text-[12px]">{t('invoices.loading')}</p>
          </div>
        </div>
      ) : invoices.length === 0 ? (
        /* Empty state */
        <div className="bg-surface rounded-[14px] shadow-card p-8 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2 text-center">
            <p className="text-text-muted text-[13px]">{t('invoices.noInvoices')}</p>
            <p className="text-text-muted text-[11px]">
              {t('invoices.createFirstProject')}
            </p>
          </div>
        </div>
      ) : filteredInvoices.length === 0 ? (
        /* No filter results */
        <div className="bg-surface rounded-[14px] shadow-card p-8 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2 text-center">
            <p className="text-text-muted text-[13px] font-medium">{t('invoices.noMatch', { status: statusFilter })}</p>
            <button
              onClick={() => setStatusFilter('all')}
              className="text-accent text-[12px] font-semibold hover:underline"
            >
              {t('invoices.showAll')}
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
                  <th className="text-left px-5 py-3">{t('invoices.colInvoiceNum')}</th>
                  <th className="text-left px-3 py-3">{t('invoices.colClient')}</th>
                  <th className="text-left px-3 py-3">{t('invoices.colProject')}</th>
                  <th className="text-right px-3 py-3">{t('invoices.colAmount')}</th>
                  <th className="text-center px-3 py-3">{t('invoices.colStatus')}</th>
                  <th className="text-left px-3 py-3">{t('invoices.colIssued')}</th>
                  <th className="text-left px-3 py-3">{t('invoices.colDue')}</th>
                  <th className="text-right px-5 py-3">{t('invoices.colActions')}</th>
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
                      <td className="px-5 py-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handlePreviewPDF(inv)
                          }}
                          className="text-accent text-[12px] font-semibold hover:underline"
                          title={t('invoices.previewInvoice')}
                        >
                          {inv.invoice_number}
                        </button>
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
                            onClick={(e) => {
                              e.stopPropagation()
                              handlePreviewPDF(inv)
                            }}
                            className="p-1.5 rounded hover:bg-border transition-colors"
                            aria-label={t('invoices.previewInvoice')}
                            title={t('invoices.previewTitle')}
                          >
                            <Eye size={12} className="text-text-muted" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDownloadPDF(inv)
                            }}
                            className="p-1.5 rounded hover:bg-border transition-colors"
                            aria-label={t('invoices.downloadInvoice')}
                            title={t('invoices.downloadTitle')}
                          >
                            <Download size={12} className="text-text-muted" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setEditingInvoice(inv)
                            }}
                            className="p-1.5 rounded hover:bg-border transition-colors"
                            aria-label={t('invoices.editInvoice')}
                            title={t('invoices.editTitle')}
                          >
                            <Pencil size={12} className="text-text-muted" />
                          </button>
                          {(inv.status === 'sent' || inv.status === 'overdue') && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleGetPayLink(inv)
                              }}
                              disabled={paymentLoading === inv.id}
                              className="p-1.5 rounded hover:bg-border transition-colors"
                              aria-label={t('invoices.getPaymentLink')}
                              title={copiedId === inv.id ? t('invoices.linkCopied') : t('invoices.getPayLink')}
                            >
                              {paymentLoading === inv.id ? (
                                <div className="w-3 h-3 border border-accent border-t-transparent rounded-full animate-spin" />
                              ) : copiedId === inv.id ? (
                                <Check size={12} className="text-status-active-text" />
                              ) : (
                                <CreditCard size={12} className="text-accent" />
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

      {/* Preview Modal */}
      {previewUrl && previewInvoice && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={cleanupPreview}
        >
          <div
            className="bg-surface rounded-[14px] shadow-card w-[90vw] max-w-3xl h-[85vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-border">
              <h3 className="text-text-primary text-[13px] font-semibold">
                {previewInvoice.invoice_number}
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownloadPDF(previewInvoice)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-accent hover:bg-accent-bg transition-colors"
                >
                  <Download size={12} />
                  {t('invoices.downloadTitle')}
                </button>
                <button
                  onClick={cleanupPreview}
                  className="p-1.5 rounded hover:bg-border transition-colors"
                  aria-label={t('invoices.closePreview')}
                >
                  <X size={14} className="text-text-muted" />
                </button>
              </div>
            </div>
            <div className="flex-1 min-h-0">
              <iframe
                src={previewUrl}
                className="w-full h-full border-0"
                title={t('invoices.previewLabel', { num: previewInvoice.invoice_number })}
              />
            </div>
          </div>
        </div>
      )}

      <InvoiceEditDialog
        open={editingInvoice !== null}
        onOpenChange={(open) => {
          if (!open) setEditingInvoice(null)
        }}
        invoice={editingInvoice}
        onSaved={refetch}
      />
    </div>
  )
}
