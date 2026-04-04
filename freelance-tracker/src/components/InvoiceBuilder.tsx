import { useState, useMemo } from 'react'
import { FileText } from 'lucide-react'
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
import { useUnbilledEntries, type TimeEntry } from '@/hooks/useTimeEntries'
import { useProject } from '@/hooks/useProjects'
import { useInvoices, type InvoiceItemInsert } from '@/hooks/useInvoices'

interface InvoiceBuilderProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  onCreated?: () => void
}

function todayPlusDays(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function generateInvoiceNumber(): string {
  const year = new Date().getFullYear()
  const seq = String(Math.floor(Math.random() * 900) + 100)
  return `INV-${year}-${seq}`
}

export default function InvoiceBuilder({
  open,
  onOpenChange,
  projectId,
  onCreated,
}: InvoiceBuilderProps) {
  const { entries, loading: entriesLoading } = useUnbilledEntries(projectId)
  const { project, loading: projectLoading } = useProject(projectId)
  const { createInvoice } = useInvoices()

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [taxRate, setTaxRate] = useState('0')
  const [dueDate, setDueDate] = useState(todayPlusDays(30))
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [initialized, setInitialized] = useState(false)

  // Initialize all entries as selected once loaded
  if (!initialized && entries.length > 0) {
    setSelectedIds(new Set(entries.map((e) => e.id)))
    setInitialized(true)
  }

  // Reset state when dialog closes
  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setInitialized(false)
      setSelectedIds(new Set())
      setTaxRate('0')
      setDueDate(todayPlusDays(30))
      setNotes('')
    }
    onOpenChange(nextOpen)
  }

  const rate = project?.hourly_rate ?? 0

  const selectedEntries = useMemo(
    () => entries.filter((e) => selectedIds.has(e.id)),
    [entries, selectedIds]
  )

  const subtotal = useMemo(
    () => selectedEntries.reduce((sum, e) => sum + e.hours * rate, 0),
    [selectedEntries, rate]
  )

  const taxRateNum = Number(taxRate) || 0
  const taxAmount = subtotal * (taxRateNum / 100)
  const total = subtotal + taxAmount

  function toggleEntry(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  function toggleAll() {
    if (selectedIds.size === entries.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(entries.map((e) => e.id)))
    }
  }

  async function handleGenerate() {
    if (selectedEntries.length === 0 || !project) return

    setSubmitting(true)
    try {
      const invoiceNumber = generateInvoiceNumber()
      const today = new Date()
      const issuedDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

      const items: InvoiceItemInsert[] = selectedEntries.map((entry) => ({
        description: entry.description || 'Time entry',
        quantity: entry.hours,
        rate,
        amount: entry.hours * rate,
        time_entry_id: entry.id,
        item_type: 'time' as const,
      }))

      await createInvoice(
        {
          project_id: projectId,
          invoice_number: invoiceNumber,
          status: 'draft',
          subtotal,
          tax_rate: taxRateNum,
          total,
          notes: notes.trim() || null,
          due_date: dueDate,
          issued_date: issuedDate,
        },
        items
      )

      onCreated?.()
      handleOpenChange(false)
    } catch (err) {
      console.error('Failed to create invoice:', err)
    } finally {
      setSubmitting(false)
    }
  }

  const loading = entriesLoading || projectLoading

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Invoice</DialogTitle>
          <DialogDescription>
            Select unbilled time entries for{' '}
            {project ? (
              <span className="font-medium text-text-primary">{project.name}</span>
            ) : (
              'this project'
            )}
            {project?.clients?.name && (
              <>
                {' '}
                &mdash; <span className="text-text-secondary">{project.clients.name}</span>
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-12 text-center text-text-muted text-sm">Loading entries...</div>
        ) : entries.length === 0 ? (
          <div className="py-12 text-center text-text-muted text-sm">
            No unbilled time entries found for this project.
          </div>
        ) : (
          <>
            {/* Entry checklist */}
            <div className="border border-border rounded-[12px] overflow-hidden">
              {/* Table header */}
              <div className="flex items-center gap-3 px-4 py-2.5 bg-input-bg text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                <div className="w-6">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === entries.length}
                    onChange={toggleAll}
                    className="h-4 w-4 rounded border-border text-accent focus:ring-accent"
                    aria-label="Select all entries"
                  />
                </div>
                <div className="flex-1">Description</div>
                <div className="w-16 text-right">Hours</div>
                <div className="w-20 text-right">Rate</div>
                <div className="w-24 text-right">Amount</div>
              </div>

              {/* Rows */}
              <div className="divide-y divide-border">
                {entries.map((entry: TimeEntry) => {
                  const checked = selectedIds.has(entry.id)
                  const amount = entry.hours * rate
                  return (
                    <label
                      key={entry.id}
                      className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
                        checked ? 'bg-surface' : 'bg-surface opacity-50'
                      } hover:bg-accent-bg-subtle`}
                    >
                      <div className="w-6">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleEntry(entry.id)}
                          className="h-4 w-4 rounded border-border text-accent focus:ring-accent"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-text-primary truncate">
                          {entry.description || 'Untitled entry'}
                        </p>
                        <p className="text-[11px] text-text-muted">{formatEntryDate(entry.date)}</p>
                      </div>
                      <div className="w-16 text-right text-sm text-text-secondary">
                        {entry.hours.toFixed(2)}
                      </div>
                      <div className="w-20 text-right text-sm text-text-muted">
                        ${rate.toFixed(2)}
                      </div>
                      <div className="w-24 text-right text-sm font-medium text-text-primary">
                        ${amount.toFixed(2)}
                      </div>
                    </label>
                  )
                })}
              </div>
            </div>

            {/* Invoice settings */}
            <div className="grid grid-cols-2 gap-4 mt-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="tax-rate">Tax Rate (%)</Label>
                <Input
                  id="tax-rate"
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={taxRate}
                  onChange={(e) => setTaxRate(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="due-date">Due Date</Label>
                <Input
                  id="due-date"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="notes">Notes (optional)</Label>
              <textarea
                id="notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Payment terms, additional notes..."
                className="flex w-full rounded-[12px] border border-border bg-input-bg px-3 py-2 text-sm text-text-primary ring-offset-surface placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
              />
            </div>

            {/* Totals */}
            <div className="border-t border-border pt-4 space-y-1.5">
              <div className="flex justify-between text-sm text-text-secondary">
                <span>
                  Subtotal ({selectedEntries.length} item
                  {selectedEntries.length !== 1 ? 's' : ''})
                </span>
                <span className="font-medium text-text-primary">${subtotal.toFixed(2)}</span>
              </div>
              {taxRateNum > 0 && (
                <div className="flex justify-between text-sm text-text-secondary">
                  <span>Tax ({taxRateNum}%)</span>
                  <span>${taxAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold text-text-primary pt-1">
                <span>Total</span>
                <span className="text-accent">${total.toFixed(2)}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button
                variant="gradient"
                onClick={handleGenerate}
                disabled={submitting || selectedEntries.length === 0}
              >
                <FileText size={16} />
                {submitting ? 'Creating...' : 'Generate Invoice'}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function formatEntryDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
