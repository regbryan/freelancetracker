import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  FolderKanban,
  Clock,
  FileText,
  Menu,
} from 'lucide-react'

const navItems = [
  { to: '/', label: 'Home', icon: LayoutDashboard },
  { to: '/projects', label: 'Projects', icon: FolderKanban },
  { to: '/time', label: 'Time', icon: Clock },
  { to: '/invoices', label: 'Invoices', icon: FileText },
  { to: '/more', label: 'More', icon: Menu },
]

interface BottomNavProps {
  onMoreClick: () => void
}

export default function BottomNav({ onMoreClick }: BottomNavProps) {
  const location = useLocation()

  // Pages that show in "More" — if we're on one, highlight More
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
              <span className="text-[10px] font-medium">{item.label}</span>
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
            <span className="text-[10px] font-medium">{item.label}</span>
          </NavLink>
        )
      })}
    </nav>
  )
}
