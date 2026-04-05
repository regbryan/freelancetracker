import { Bell, Search, Menu } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/clients': 'Clients Directory',
  '/projects': 'Active Projects',
  '/time': 'Time Tracker',
  '/expenses': 'Expenses',
  '/invoices': 'Invoice Center',
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

  // Load profile photo and name from localStorage
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
    <header className="h-14 bg-surface border-b border-border flex items-center justify-between px-6 shrink-0 gap-4">
      {/* Hamburger + Page title */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={onToggleSidebar}
          className="p-1.5 rounded-lg hover:bg-input-bg transition-colors lg:hidden"
          aria-label="Toggle sidebar"
        >
          <Menu size={20} className="text-text-secondary" />
        </button>
        <h1 className="text-text-primary font-semibold text-[15px]">{title}</h1>
      </div>

      {/* Search + Actions */}
      <div className="flex items-center gap-3 min-w-0">
        {/* Search Bar */}
        <div className="relative hidden md:block">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            placeholder="Search anything..."
            className="w-[240px] h-9 pl-9 pr-3 bg-input-bg rounded-lg text-[13px] text-text-secondary placeholder:text-text-muted border border-border outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/30 transition-all"
          />
        </div>

        {/* Notification Bell */}
        <button className="relative p-2 rounded-lg hover:bg-input-bg transition-colors shrink-0">
          <Bell size={18} className="text-text-muted" />
          <div className="absolute top-1.5 right-1.5 w-2 h-2 bg-accent rounded-full" />
        </button>

        {/* User Avatar */}
        <button
          onClick={() => navigate('/settings')}
          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-bold shrink-0 cursor-pointer overflow-hidden hover:ring-2 hover:ring-accent/30 transition-all"
          style={!profilePhoto ? { background: 'linear-gradient(135deg, #0058be 0%, #2170e4 100%)' } : undefined}
          title="Profile & Settings"
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
