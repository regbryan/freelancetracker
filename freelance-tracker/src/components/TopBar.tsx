import { Menu } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/clients': 'Clients',
  '/projects': 'Projects',
  '/time': 'Time Tracker',
  '/expenses': 'Expenses',
  '/contracts': 'Contracts',
  '/invoices': 'Invoices',
  '/calendar': 'Calendar',
  '/settings': 'Settings',
}

interface TopBarProps {
  onToggleSidebar: () => void
}

export default function TopBar({ onToggleSidebar }: TopBarProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const title = pageTitles[location.pathname] || 'Dashboard'

  const profilePhoto = localStorage.getItem('freelancer_photo') || ''
  const profileData = (() => {
    try {
      const raw = localStorage.getItem('freelancer_profile')
      if (raw) return JSON.parse(raw)
    } catch { /* ignore */ }
    return { name: '' }
  })()
  const initials = profileData.name
    ? profileData.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
    : 'JD'

  return (
    <header className="h-12 bg-surface border-b border-border flex items-center justify-between px-5 shrink-0 gap-4">
      <div className="flex items-center gap-2.5 shrink-0">
        <button
          onClick={onToggleSidebar}
          className="p-1 rounded-md hover:bg-input-bg transition-colors lg:hidden"
          aria-label="Toggle sidebar"
        >
          <Menu size={18} className="text-text-secondary" />
        </button>
        <h1 className="text-text-primary font-semibold text-[14px]">{title}</h1>
      </div>

      <div className="flex items-center gap-2 min-w-0">
        <button
          onClick={() => navigate('/settings')}
          className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-semibold shrink-0 cursor-pointer overflow-hidden hover:ring-2 hover:ring-accent/20 transition-all"
          style={!profilePhoto ? { background: 'var(--color-accent)' } : undefined}
          title="Settings"
        >
          {profilePhoto ? (
            <img src={profilePhoto} alt="Profile" className="w-full h-full object-cover" />
          ) : (
            initials
          )}
        </button>
      </div>
    </header>
  )
}
