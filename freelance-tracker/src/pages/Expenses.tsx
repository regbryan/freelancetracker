import { useState, useCallback, useMemo } from 'react'
import { Plus } from 'lucide-react'
import { useExpenses, useExpenseCategories } from '../hooks/useExpenses'
import { useProjects } from '../hooks/useProjects'
import ExpenseForm from '../components/ExpenseForm'
import type { ExpenseFormData } from '../components/ExpenseForm'
import ExpenseList from '../components/ExpenseList'
import type { ExpenseRow } from '../components/ExpenseList'
import { useI18n } from '../lib/i18n'

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)
}

export default function Expenses() {
  const { t } = useI18n()
  const { expenses, loading, error, createExpense, updateExpense, deleteExpense, refetch } = useExpenses()
  const { projects } = useProjects()
  const { categories } = useExpenseCategories()

  const [formOpen, setFormOpen] = useState(false)
  const [editingExpense, setEditingExpense] = useState<ExpenseRow | null>(null)
  const [dateRange, setDateRange] = useState<'7' | '30' | 'all'>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')

  const projectNameMap = new Map(projects.map((p) => [p.id, p.name]))
  const projectList = projects.map((p) => ({ id: p.id, name: p.name }))

  // Map to display format
  const mappedExpenses: ExpenseRow[] = expenses.map((e) => ({
    id: e.id,
    projectId: e.project_id,
    description: e.description,
    amount: e.amount,
    date: e.date,
    category: e.category,
    receiptUrl: e.receipt_url ?? undefined,
  }))

  // Apply filters
  const filteredExpenses = useMemo(() => {
    let filtered = mappedExpenses

    if (dateRange !== 'all') {
      const now = new Date()
      const daysAgo = parseInt(dateRange, 10)
      const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo)
      filtered = filtered.filter((e) => new Date(e.date + 'T00:00:00') >= cutoff)
    }

    if (categoryFilter !== 'all') {
      filtered = filtered.filter((e) => e.category === categoryFilter)
    }

    return filtered
  }, [mappedExpenses, dateRange, categoryFilter])

  // Stats
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0)
  const thisMonthExpenses = useMemo(() => {
    const now = new Date()
    return expenses
      .filter((e) => {
        const d = new Date(e.date + 'T00:00:00')
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
      })
      .reduce((sum, e) => sum + e.amount, 0)
  }, [expenses])
  const unbilledExpenses = expenses.filter((e) => !e.invoice_id).reduce((sum, e) => sum + e.amount, 0)

  // Unique categories from data
  const activeCategories = useMemo(() => {
    const cats = new Set<string>()
    for (const e of expenses) cats.add(e.category)
    return Array.from(cats).sort()
  }, [expenses])

  const handleSave = useCallback(async (data: ExpenseFormData) => {
    if (editingExpense) {
      await updateExpense(editingExpense.id, {
        project_id: data.projectId,
        description: data.description,
        amount: data.amount,
        date: data.date,
        category: data.category,
        receipt_url: data.receiptUrl ?? null,
      })
      setEditingExpense(null)
    } else {
      await createExpense({
        project_id: data.projectId,
        description: data.description,
        amount: data.amount,
        date: data.date,
        category: data.category,
        receipt_url: data.receiptUrl ?? null,
        invoice_id: null,
      })
    }
  }, [editingExpense, createExpense, updateExpense])

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-accent text-[11px] font-semibold uppercase tracking-[1.5px]">{t('expenses.tracking')}</p>
          <h2 className="text-text-primary text-[20px] font-bold tracking-[-0.3px] mt-1">{t('expenses.title')}</h2>
        </div>
        <button
          onClick={() => {
            setEditingExpense(null)
            setFormOpen(true)
          }}
          className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-white text-[12px] font-semibold hover:opacity-90 transition-all active:scale-[0.98]"
          style={{ background: 'linear-gradient(135deg, #305445 0%, #3e6b5a 100%)' }}
        >
          <Plus size={12} />
          {t('expenses.addExpense')}
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-negative-bg rounded-[14px] p-4 text-negative text-[12px]">
          {t('expenses.failedToLoad', { error: String(error) })}
          <button onClick={refetch} className="ml-3 underline font-semibold">{t('expenses.retry')}</button>
        </div>
      )}

      {/* Stats */}
      {!loading && expenses.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-surface rounded-[14px] shadow-card p-4">
            <p className="text-text-muted text-[10px] font-semibold uppercase tracking-wide">{t('expenses.totalExpenses')}</p>
            <p className="text-text-primary text-[20px] font-bold mt-1">{formatCurrency(totalExpenses)}</p>
          </div>
          <div className="bg-surface rounded-[14px] shadow-card p-4">
            <p className="text-text-muted text-[10px] font-semibold uppercase tracking-wide">{t('expenses.thisMonth')}</p>
            <p className="text-text-primary text-[20px] font-bold mt-1">{formatCurrency(thisMonthExpenses)}</p>
          </div>
          <div className="bg-surface rounded-[14px] shadow-card p-4">
            <p className="text-text-muted text-[10px] font-semibold uppercase tracking-wide">{t('expenses.unbilled')}</p>
            <p className="text-text-primary text-[20px] font-bold mt-1">{formatCurrency(unbilledExpenses)}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      {!loading && expenses.length > 0 && (
        <div className="flex items-center gap-4 flex-wrap">
          {/* Date range */}
          <div className="flex items-center gap-1.5">
            {(['7', '30', 'all'] as const).map((value) => {
              const label = value === '7' ? t('expenses.last7') : value === '30' ? t('expenses.last30') : t('expenses.allTime')
              const isActive = dateRange === value
              return (
                <button
                  key={value}
                  onClick={() => setDateRange(value)}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all ${
                    isActive
                      ? 'bg-accent text-white shadow-sm'
                      : 'bg-input-bg text-text-muted hover:text-text-primary hover:bg-border'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>

          {/* Category filter */}
          {activeCategories.length > 1 && (
            <>
              <div className="w-px h-5 bg-border" />
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  onClick={() => setCategoryFilter('all')}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all ${
                    categoryFilter === 'all'
                      ? 'bg-accent text-white shadow-sm'
                      : 'bg-input-bg text-text-muted hover:text-text-primary hover:bg-border'
                  }`}
                >
                  {t('expenses.allCategories')}
                </button>
                {activeCategories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCategoryFilter(cat)}
                    className={`px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all ${
                      categoryFilter === cat
                        ? 'bg-accent text-white shadow-sm'
                        : 'bg-input-bg text-text-muted hover:text-text-primary hover:bg-border'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Expense List */}
      <ExpenseList
        expenses={filteredExpenses}
        loading={loading}
        showProject
        projectNameMap={projectNameMap}
        onEdit={(exp) => {
          setEditingExpense(exp)
          setFormOpen(true)
        }}
        onDelete={(id) => deleteExpense(id)}
      />

      {/* Expense Form Dialog */}
      <ExpenseForm
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open)
          if (!open) setEditingExpense(null)
        }}
        expense={editingExpense}
        projects={projectList}
        categories={categories}
        onSave={handleSave}
      />
    </div>
  )
}
