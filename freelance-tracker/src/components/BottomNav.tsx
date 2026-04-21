import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  FolderKanban,
  Clock,
  FileText,
  Menu,
} from 'lucide-react'
import { useI18n } from '../lib/i18n'

const navItems = [
  { to: '/', labelKey: 'nav.home', icon: LayoutDashboard },
  { to: '/projects', labelKey: 'nav.projects', icon: FolderKanban },
  { to: '/time', labelKey: 'nav.time', icon: Clock },
  { to: '/invoices', labelKey: 'nav.invoices', icon: FileText },
  { to: '/more', labelKey: 'nav.more', icon: Menu },
]

interface BottomNavProps {
  onMoreClick: () => void
}

export default function BottomNav({ onMoreClick }: BottomNavProps) {
  const location = useLocation()
  const { t } = useI18n()

  const morePages = ['/clients', '/expenses', '/contracts', '/calendar', '/settings']
  const isMoreActive = morePages.some((p) => location.pathname.startsWith(p))

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-surface border-t border-border flex items-center justify-around h-14 z-40 lg:hidden safe-area-bottom">
      {navItems.map((item) => {
        if (item.to === '/more') {
          return (
            <button
              key="more"
              onClick={onMoreClick}
              className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors ${
                isMoreActive ? 'text-accent' : 'text-text-muted'
              }`}
            >
              <item.icon size={20} strokeWidth={isMoreActive ? 2 : 1.5} />
              <span className="text-[10px] font-medium">{t(item.labelKey)}</span>
            </button>
          )
        }

        const isActive = item.to === '/'
          ? location.pathname === '/'
          : location.pathname.startsWith(item.to)

        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors ${
              isActive ? 'text-accent' : 'text-text-muted'
            }`}
          >
            <item.icon size={20} strokeWidth={isActive ? 2 : 1.5} />
            <span className="text-[10px] font-medium">{t(item.labelKey)}</span>
          </NavLink>
        )
      })}
    </nav>
  )
}
