import { NavLink } from 'react-router-dom'
import { FileText, FileCheck, Receipt } from 'lucide-react'

/**
 * Shared sub-nav for the consolidated "Billing" surface.
 * Mounted at the top of /invoices, /contracts, and /expenses.
 */
export default function BillingTabs() {
  const tabs = [
    { to: '/invoices', label: 'Invoices', icon: FileText },
    { to: '/contracts', label: 'Contracts', icon: FileCheck },
    { to: '/expenses', label: 'Expenses', icon: Receipt },
  ]
  return (
    <div className="flex items-center gap-1 border-b border-border -mb-px">
      {tabs.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end
          className={({ isActive }) =>
            `relative flex items-center gap-1.5 px-3 py-2 text-[12px] font-semibold transition-colors ${
              isActive ? 'text-accent' : 'text-text-muted hover:text-text-primary'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <t.icon size={13} strokeWidth={isActive ? 2 : 1.5} />
              {t.label}
              {isActive && (
                <span className="absolute left-2 right-2 -bottom-px h-[2px] bg-accent rounded-full" />
              )}
            </>
          )}
        </NavLink>
      ))}
    </div>
  )
}
