import { useState, useMemo, useEffect } from 'react'
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
import { useUnbilledExpenses, type Expense } from '@/hooks/useExpenses'
import { useProject } from '@/hooks/useProjects'
import { useInvoices, getNextInvoiceNumber, type InvoiceItemInsert } from '@/hooks/useInvoices'
import { useI18n } from '../lib/i18n'

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

export default function InvoiceBuilder({
  open,
  onOpenChange,
  projectId,
  onCreated,
}: InvoiceBuilderProps) {
  const { t, lang } = useI18n()
  const locale = lang === 'es' ? 'es-ES' : 'en-US'
  const { entries, loading: entriesLoading } = useUnbilledEntries(projectId)
  const { expenses: unbilledExpenses, loading: expensesLoading } = useUnbilledExpenses(projectId)
  const { project, loading: projectLoading } = useProject(projectId)
  const { createInvoice } = useInvoices()

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [selectedExpenseIds, setSelectedExpenseIds] = useState<Set<string>>(new Set())
  const [taxRate, setTaxRate] = useState('0')
  const [dueDate, setDueDate] = useState(todayPlusDays(30))
  const [notes, setNotes] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [initialized, setInitialized] = useState(false)
  // Monthly billing fields
  const [monthlyQty, setMonthlyQty] = useState('1')
  const [monthlyDesc, setMonthlyDesc] = useState('')

  // Suggest the next sequential invoice number when the dialog opens.
  // The user can override the value before generating.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    getNextInvoiceNumber()
      .then((next) => {
        if (!cancelled) setInvoiceNumber(next)
      })
      .catch((err) => {
        console.error('Failed to load next invoice number:', err)
        if (!cancelled) {
          // Fallback so the user can still create an invoice if the lookup fails.
          const year = new Date().getFullYear()
          setInvoiceNumber(`INV-${year}-001`)
        }
      })
    return () => {
      cancelled = true
    }
  }, [open])

  // Initialize all entries and expenses as selected once loaded
  if (!initialized && (entries.length > 0 || unbilledExpenses.length > 0)) {
    setSelectedIds(new Set(entries.map((e) => e.id)))
    setSelectedExpenseIds(new Set(unbilledExpenses.map((e) => e.id)))
    setInitialized(true)
  }

  // Reset state when dialog closes
  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setInitialized(false)
      setSelectedIds(new Set())
      setSelectedExpenseIds(new Set())
      setTaxRate('0')
      setDueDate(todayPlusDays(30))
      setNotes('')
      setInvoiceNumber('')
      setMonthlyQty('1')
      setMonthlyDesc('')
    }
    onOpenChange(nextOpen)
  }

  const isMonthly = project?.billing_type === 'monthly'

  const rate = project?.hourly_rate ?? 0
  const monthlyRate = project?.monthly_rate ?? 0

  const selectedEntries = useMemo(
    () => entries.filter((e) => selectedIds.has(e.id)),
    [entries, selectedIds]
  )

  const selectedExpenses = useMemo(
    () => unbilledExpenses.filter((e) => selectedExpenseIds.has(e.id)),
    [unbilledExpenses, selectedExpenseIds]
  )

  const timeSubtotal = useMemo(
    () => selectedEntries.reduce((sum, e) => sum + e.hours * rate, 0),
    [selectedEntries, rate]
  )

  const expenseSubtotal = useMemo(
    () => selectedExpenses.reduce((sum, e) => sum + e.amount, 0),
    [selectedExpenses]
  )

  // Monthly billing subtotal: qty × monthly_rate + expenses
  const monthlyRetainerSubtotal = (Number(monthlyQty) || 1) * monthlyRate
  const monthlySubtotal = monthlyRetainerSubtotal + expenseSubtotal

  const subtotal = isMonthly ? monthlySubtotal : timeSubtotal + expenseSubtotal

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

  function toggleExpense(id: string) {
    setSelectedExpenseIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAllExpenses() {
    if (selectedExpenseIds.size === unbilledExpenses.length) {
      setSelectedExpenseIds(new Set())
    } else {
      setSelectedExpenseIds(new Set(unbilledExpenses.map((e) => e.id)))
    }
  }

  async function handleGenerate() {
    if (!project) return
    if (!isMonthly && selectedEntries.length === 0 && selectedExpenses.length === 0) return

    setSubmitting(true)
    try {
      const trimmedNumber = invoiceNumber.trim()
      if (!trimmedNumber) {
        alert(t('invBuilder.enterNumber'))
        setSubmitting(false)
        return
      }
      const today = new Date()
      const issuedDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

      let items: InvoiceItemInsert[]

      if (isMonthly) {
        const qty = Number(monthlyQty) || 1
        const retainerDesc = monthlyDesc.trim() || t('invBuilder.retainerPh')
        const retainerItem: InvoiceItemInsert = {
          description: retainerDesc,
          quantity: qty,
          rate: monthlyRate,
          amount: qty * monthlyRate,
          time_entry_id: null,
          item_type: 'time' as const,
        }
        const expenseItems: InvoiceItemInsert[] = selectedExpenses.map((exp) => ({
          description: `${exp.category}: ${exp.description}`,
          quantity: 1,
          rate: exp.amount,
          amount: exp.amount,
          time_entry_id: null,
          item_type: 'expense' as const,
        }))
        items = [retainerItem, ...expenseItems]
      } else {
        const timeItems: InvoiceItemInsert[] = selectedEntries.map((entry) => ({
          description: entry.description || t('invBuilder.timeEntry'),
          quantity: entry.hours,
          rate,
          amount: entry.hours * rate,
          time_entry_id: entry.id,
          item_type: 'time' as const,
        }))
        const expenseItems: InvoiceItemInsert[] = selectedExpenses.map((exp) => ({
          description: `${exp.category}: ${exp.description}`,
          quantity: 1,
          rate: exp.amount,
          amount: exp.amount,
          time_entry_id: null,
          item_type: 'expense' as const,
        }))
        items = [...timeItems, ...expenseItems]
      }

      await createInvoice(
        {
          project_id: projectId,
          invoice_number: trimmedNumber,
          status: 'draft',
          subtotal,
          tax_rate: taxRateNum,
          total,
          notes: notes.trim() || null,
          due_date: dueDate,
          issued_date: issuedDate,
        },
        items,
        { expenseIds: selectedExpenses.map((e) => e.id) }
      )

      onCreated?.()
      handleOpenChange(false)
    } catch (err) {
      console.error('Failed to create invoice:', err)
    } finally {
      setSubmitting(false)
    }
  }

  const loading = entriesLoading || expensesLoading || projectLoading
  // For monthly projects, the retainer line always provides content — no time entries needed
  const hasItems = isMonthly || entries.length > 0 || unbilledExpenses.length > 0

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('invBuilder.title')}</DialogTitle>
          <DialogDescription>
            {isMonthly ? t('invBuilder.descMonthly') : t('invBuilder.descHourly')}
            {project ? (
              <span className="font-medium text-text-primary">{project.name}</span>
            ) : (
              t('invBuilder.thisProject')
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
          <div className="py-12 text-center text-text-muted text-sm">{t('invBuilder.loading')}</div>
        ) : !hasItems ? (
          <div className="py-12 text-center text-text-muted text-sm">
            {t('invBuilder.empty')}
          </div>
        ) : (
          <>
            {/* Monthly retainer config OR time-entry checklist */}
            {isMonthly ? (
              <div className="border border-border rounded-[12px] overflow-hidden">
                <div className="px-4 py-2.5 bg-input-bg text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                  {t('invBuilder.monthlyRetainer')}
                </div>
                <div className="divide-y divide-border">
                  <div className="flex items-end gap-3 px-4 py-3">
                    <div className="flex-1 flex flex-col gap-1">
                      <label className="text-[11px] text-text-muted">{t('invBuilder.description')}</label>
                      <input
                        type="text"
                        value={monthlyDesc}
                        onChange={(e) => setMonthlyDesc(e.target.value)}
                        placeholder={t('invBuilder.retainerPh')}
                        className="flex h-9 w-full rounded-[10px] border border-border bg-input-bg px-3 py-2 text-[12px] text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      />
                    </div>
                    <div className="w-20 flex flex-col gap-1">
                      <label className="text-[11px] text-text-muted">{t('invBuilder.months')}</label>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={monthlyQty}
                        onChange={(e) => setMonthlyQty(e.target.value)}
                        className="flex h-9 w-full rounded-[10px] border border-border bg-input-bg px-3 py-2 text-[12px] text-text-primary text-right focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      />
                    </div>
                    <div className="w-24 flex flex-col gap-1">
                      <label className="text-[11px] text-text-muted text-right">{t('invBuilder.ratePerMonth')}</label>
                      <p className="h-9 flex items-center justify-end text-sm text-text-muted pr-0.5">
                        ${monthlyRate.toFixed(2)}
                      </p>
                    </div>
                    <div className="w-24 flex flex-col gap-1">
                      <label className="text-[11px] text-text-muted text-right">{t('invBuilder.amount')}</label>
                      <p className="h-9 flex items-center justify-end text-sm font-semibold text-text-primary">
                        ${monthlyRetainerSubtotal.toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* Hourly: time-entry checklist */
              <div className="border border-border rounded-[12px] overflow-hidden">
                {/* Table header */}
                <div className="flex items-center gap-3 px-4 py-2.5 bg-input-bg text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                  <div className="w-6">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === entries.length}
                      onChange={toggleAll}
                      className="h-4 w-4 rounded border-border text-accent focus:ring-accent"
                      aria-label={t('invBuilder.selectAllEntries')}
                    />
                  </div>
                  <div className="flex-1">{t('invBuilder.description')}</div>
                  <div className="w-16 text-right">{t('invBuilder.hours')}</div>
                  <div className="w-20 text-right">{t('invBuilder.rate')}</div>
                  <div className="w-24 text-right">{t('invBuilder.amount')}</div>
                </div>

                {/* Rows */}
                <div className="divide-y divide-border">
                  {entries.length === 0 ? (
                    <p className="px-4 py-6 text-center text-[12px] text-text-muted">
                      {t('invBuilder.noUnbilled')}
                    </p>
                  ) : entries.map((entry: TimeEntry) => {
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
                            {entry.description || t('invBuilder.untitledEntry')}
                          </p>
                          <p className="text-[11px] text-text-muted">{formatEntryDate(entry.date, locale)}</p>
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
            )}

            {/* Unbilled Expenses */}
            {unbilledExpenses.length > 0 && (
              <div className="border border-border rounded-[12px] overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-2.5 bg-input-bg text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                  <div className="w-6">
                    <input
                      type="checkbox"
                      checked={selectedExpenseIds.size === unbilledExpenses.length}
                      onChange={toggleAllExpenses}
                      className="h-4 w-4 rounded border-border text-accent focus:ring-accent"
                      aria-label={t('invBuilder.selectAllExpenses')}
                    />
                  </div>
                  <div className="flex-1">{t('invBuilder.expense')}</div>
                  <div className="w-20 text-right">{t('invBuilder.category')}</div>
                  <div className="w-24 text-right">{t('invBuilder.amount')}</div>
                </div>

                <div className="divide-y divide-border">
                  {unbilledExpenses.map((exp: Expense) => {
                    const checked = selectedExpenseIds.has(exp.id)
                    return (
                      <label
                        key={exp.id}
                        className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
                          checked ? 'bg-surface' : 'bg-surface opacity-50'
                        } hover:bg-accent-bg-subtle`}
                      >
                        <div className="w-6">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleExpense(exp.id)}
                            className="h-4 w-4 rounded border-border text-accent focus:ring-accent"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-text-primary truncate">{exp.description}</p>
                          <p className="text-[11px] text-text-muted">{formatEntryDate(exp.date, locale)}</p>
                        </div>
                        <div className="w-20 text-right">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-semibold bg-status-completed-bg text-status-completed-text">
                            {exp.category}
                          </span>
                        </div>
                        <div className="w-24 text-right text-sm font-medium text-text-primary">
                          ${exp.amount.toFixed(2)}
                        </div>
                      </label>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Invoice settings */}
            <div className="grid grid-cols-2 gap-4 mt-2">
              <div className="col-span-2 flex flex-col gap-1.5">
                <Label htmlFor="invoice-number">{t('invBuilder.invoiceNumber')}</Label>
                <Input
                  id="invoice-number"
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  placeholder="INV-2026-001"
                />
                <p className="text-[10px] text-text-muted">
                  {t('invBuilder.autoSuggested', { year: new Date().getFullYear() })}
                </p>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="tax-rate">{t('invBuilder.taxRate')}</Label>
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
                <Label htmlFor="due-date">{t('invBuilder.dueDate')}</Label>
                <Input
                  id="due-date"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="notes">{t('invBuilder.notesOpt')}</Label>
              <textarea
                id="notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t('invBuilder.notesPh')}
                className="flex w-full rounded-[12px] border border-border bg-input-bg px-3 py-2 text-sm text-text-primary ring-offset-surface placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
              />
            </div>

            {/* Totals */}
            <div className="border-t border-border pt-4 space-y-1.5">
              <div className="flex justify-between text-sm text-text-secondary">
                <span>
                  {isMonthly
                    ? (selectedExpenses.length > 0
                        ? t(selectedExpenses.length === 1 ? 'invBuilder.subtotalRetainerExpenses' : 'invBuilder.subtotalRetainerExpensesPlural', { n: selectedExpenses.length })
                        : t('invBuilder.subtotalRetainer'))
                    : t(selectedEntries.length + selectedExpenses.length === 1 ? 'invBuilder.subtotalItems' : 'invBuilder.subtotalItemsPlural', { n: selectedEntries.length + selectedExpenses.length })}
                </span>
                <span className="font-medium text-text-primary">${subtotal.toFixed(2)}</span>
              </div>
              {taxRateNum > 0 && (
                <div className="flex justify-between text-sm text-text-secondary">
                  <span>{t('invBuilder.tax', { pct: taxRateNum })}</span>
                  <span>${taxAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold text-text-primary pt-1">
                <span>{t('invBuilder.total')}</span>
                <span className="text-accent">${total.toFixed(2)}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                {t('common.cancel')}
              </Button>
              <Button
                variant="gradient"
                onClick={handleGenerate}
                disabled={submitting || (!isMonthly && selectedEntries.length === 0 && selectedExpenses.length === 0)}
              >
                <FileText size={16} />
                {submitting ? t('invBuilder.creating') : t('invBuilder.generate')}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function formatEntryDate(dateStr: string, locale: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' })
}
