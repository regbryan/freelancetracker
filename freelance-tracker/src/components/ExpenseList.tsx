export interface ExpenseRow {
  id: string
  projectId: string
  description: string
  amount: number
  date: string
  category: string
  receiptUrl?: string
}

interface ExpenseListProps {
  expenses: ExpenseRow[]
  loading?: boolean
  showProject?: boolean
  projectNameMap?: Map<string, string>
  onEdit: (expense: ExpenseRow) => void
  onDelete: (id: string) => void
}

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export default function ExpenseList({
  expenses,
  loading,
  showProject,
  projectNameMap,
  onEdit,
  onDelete,
}: ExpenseListProps) {
  if (loading) {
    return (
      <div className="bg-surface rounded-[14px] shadow-card p-8 flex items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          <p className="text-text-muted text-[12px]">Loading expenses...</p>
        </div>
      </div>
    )
  }

  if (expenses.length === 0) {
    return (
      <div className="bg-surface rounded-[14px] shadow-card p-8 flex items-center justify-center">
        <p className="text-text-muted text-[13px]">No expenses yet.</p>
      </div>
    )
  }

  return (
    <div className="bg-surface rounded-[14px] shadow-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[500px]">
          <thead>
            <tr className="text-[10px] text-text-muted font-semibold uppercase tracking-wide border-b border-border">
              <th className="text-left px-5 py-3">Date</th>
              {showProject && <th className="text-left px-3 py-3">Project</th>}
              <th className="text-left px-3 py-3">Description</th>
              <th className="text-left px-3 py-3">Category</th>
              <th className="text-right px-3 py-3">Amount</th>
              <th className="text-right px-5 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((exp) => (
              <tr
                key={exp.id}
                className="border-b border-border/50 last:border-0 hover:bg-input-bg/50 transition-colors"
              >
                <td className="px-5 py-3 text-text-muted text-[12px]">
                  {formatDate(exp.date)}
                </td>
                {showProject && (
                  <td className="px-3 py-3 text-accent text-[12px] font-semibold">
                    {projectNameMap?.get(exp.projectId) ?? 'Unknown'}
                  </td>
                )}
                <td className="px-3 py-3 text-text-secondary text-[12px]">
                  {exp.description}
                </td>
                <td className="px-3 py-3">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-status-completed-bg text-status-completed-text">
                    {exp.category}
                  </span>
                </td>
                <td className="px-3 py-3 text-text-primary text-[12px] font-bold text-right">
                  {formatCurrency(exp.amount)}
                </td>
                <td className="px-5 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => onEdit(exp)}
                      className="p-1.5 rounded hover:bg-border transition-colors"
                      aria-label="Edit expense"
                    >
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-accent"
                      >
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => onDelete(exp.id)}
                      className="p-1.5 rounded hover:bg-border transition-colors"
                      aria-label="Delete expense"
                    >
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-negative"
                      >
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
