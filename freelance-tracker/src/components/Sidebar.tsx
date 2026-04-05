import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  Clock,
  Receipt,
  FileText,
  Calendar,
  Settings,
  Plus,
} from 'lucide-react'

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/clients', label: 'Clients', icon: Users },
  { to: '/projects', label: 'Projects', icon: FolderKanban },
  { to: '/time', label: 'Time Tracker', icon: Clock },
  { to: '/expenses', label: 'Expenses', icon: Receipt },
  { to: '/invoices', label: 'Invoices', icon: FileText },
  { to: '/calendar', label: 'Calendar', icon: Calendar },
  { to: '/settings', label: 'Settings', icon: Settings },
]

interface SidebarProps {
  open: boolean
  onClose: () => void
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <aside
      className={`fixed left-0 top-0 h-screen w-[220px] bg-sidebar border-r border-sidebar-border flex flex-col z-30 transition-transform duration-200 ease-in-out
        ${open ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 h-16 shrink-0">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: 'linear-gradient(135deg, #0058be 0%, #2170e4 100%)' }}>
          <FolderKanban size={14} className="text-white" />
        </div>
        <div className="min-w-0">
          <span className="text-accent font-bold text-[14px] tracking-[-0.3px]">
            FreelanceFlow
          </span>
          <p className="text-text-muted text-[10px] leading-tight">Task Management</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-0.5 px-3 pt-4 flex-1">
        {navItems.map((item) => {
          const isActive = item.to === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(item.to)

          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={onClose}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] transition-all duration-150 ${
                isActive
                  ? 'text-accent font-bold border-l-[3px] border-accent bg-accent-bg-subtle/50'
                  : 'text-text-nav font-medium hover:bg-input-bg/60 hover:text-text-nav-active'
              }`}
            >
              <item.icon size={18} strokeWidth={isActive ? 2.2 : 1.6} />
              <span>{item.label}</span>
            </NavLink>
          )
        })}
      </nav>

      {/* New Project Button */}
      <div className="px-3 pb-5 mt-auto">
        <button
          onClick={() => { navigate('/projects?new=1'); onClose(); }}
          className="w-full flex items-center justify-center gap-2 h-10 rounded-lg text-white text-[13px] font-semibold hover:opacity-90 transition-all active:scale-[0.98]"
          style={{ background: 'linear-gradient(135deg, #0058be 0%, #2170e4 100%)' }}
        >
          <Plus size={16} />
          New Project
        </button>
      </div>
    </aside>
  )
}
