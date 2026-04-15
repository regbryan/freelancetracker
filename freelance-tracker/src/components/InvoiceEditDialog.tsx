import { useState, useEffect, useMemo } from 'react'
import { Save } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useInvoices, type Invoice } from '@/hooks/useInvoices'

interface InvoiceEditDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  invoice: Invoice | null
  onSaved?: () => void
}

const STATUS_OPTIONS: Invoice['status'][] = ['draft', 'sent', 'paid', 'overdue']

export default function InvoiceEditDialog({
  open,
  onOpenChange,
  invoice,
  onSaved,
}: InvoiceEditDialogProps) {
  const { updateInvoice } = useInvoices()

  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [status, setStatus] = useState<Invoice['status']>('draft')
  const [taxRate, setTaxRate] = useState('0')
  const [issuedDate, setIssuedDate] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Hydrate form whenever a different invoice is opened.
  useEffect(() => {
    if (!open || !invoice) return
    setInvoiceNumber(invoice.invoice_number ?? '')
    setStatus(invoice.status)
    setTaxRate(String(invoice.tax_rate ?? 0))
    setIssuedDate(invoice.issued_date ?? '')
    setDueDate(invoice.due_date ?? '')
    setNotes(invoice.notes ?? '')
    setError(null)
  }, [open, invoice])

  const subtotal = invoice?.subtotal ?? 0
  const taxRateNum = Number(taxRate) || 0
  const computedTotal = useMemo(
    () => subtotal + subtotal * (taxRateNum / 100),
    [subtotal, taxRateNum]
  )

  async function handleSave() {
    if (!invoice) return
    const trimmedNumber = invoiceNumber.trim()
    if (!trimmedNumber) {
      setError('Invoice number is required.')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      await updateInvoice(invoice.id, {
        invoice_number: trimmedNumber,
        status,
        tax_rate: taxRateNum,
        total: computedTotal,
        issued_date: issuedDate || null,
        due_date: dueDate || null,
        notes: notes.trim() || null,
      })
      onSaved?.()
      onOpenChange(false)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update invoice'
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Invoice</DialogTitle>
          <DialogDescription>
            Update invoice header fields. Line items can be changed by deleting and recreating
            the invoice.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-invoice-number">Invoice Number</Label>
            <Input
              id="edit-invoice-number"
              type="text"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              placeholder="INV-2026-001"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-status">Status</Label>
            <select
              id="edit-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as Invoice['status'])}
              className="flex h-10 w-full rounded-[12px] border border-border bg-input-bg px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-issued-date">Issued Date</Label>
              <Input
                id="edit-issued-date"
                type="date"
                value={issuedDate}
                onChange={(e) => setIssuedDate(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-due-date">Due Date</Label>
              <Input
                id="edit-due-date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-tax-rate">Tax Rate (%)</Label>
            <Input
              id="edit-tax-rate"
              type="number"
              min="0"
              max="100"
              step="0.5"
              value={taxRate}
              onChange={(e) => setTaxRate(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-notes">Notes</Label>
            <textarea
              id="edit-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Payment terms, additional notes..."
              className="flex w-full rounded-[12px] border border-border bg-input-bg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent resize-none"
            />
          </div>

          {/* Totals preview */}
          <div className="border-t border-border pt-3 space-y-1 text-sm">
            <div className="flex justify-between text-text-secondary">
              <span>Subtotal</span>
              <span className="text-text-primary font-medium">${subtotal.toFixed(2)}</span>
            </div>
            {taxRateNum > 0 && (
              <div className="flex justify-between text-text-secondary">
                <span>Tax ({taxRateNum}%)</span>
                <span>${(subtotal * (taxRateNum / 100)).toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-bold text-text-primary pt-1">
              <span>Total</span>
              <span className="text-accent">${computedTotal.toFixed(2)}</span>
            </div>
          </div>

          {error && (
            <p className="text-[12px] text-negative bg-negative-bg rounded-md px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button variant="gradient" onClick={handleSave} disabled={submitting}>
              <Save size={16} />
              {submitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
