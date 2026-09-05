import { NavLink } from 'react-router-dom'
import { FileText, FileCheck, Receipt } from 'lucide-react'
import { isFeatureEnabled, type Feature } from '../lib/features'

/**
 * Shared sub-nav for the consolidated "Billing" surface.
 * Mounted at the top of /invoices, /contracts, and /expenses.
 * Tabs for switched-off features are filtered out.
 */
export default function BillingTabs() {
  const tabs = ([
    { to: '/invoices', label: 'Invoices', icon: FileText },
    { to: '/contracts', label: 'Contracts', icon: FileCheck, feature: 'contracts' as Feature },
    { to: '/expenses', label: 'Expenses', icon: Receipt, feature: 'expenses' as Feature },
  ] as { to: string; label: string; icon: typeof FileText; feature?: Feature }[])
    .filter((tab) => !tab.feature || isFeatureEnabled(tab.feature))

  // A sub-nav with a single destination is just noise — hide the whole strip.
  if (tabs.length < 2) return null

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
