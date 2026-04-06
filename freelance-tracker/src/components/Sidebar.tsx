import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  Clock,
  BookOpen,
  Receipt,
  FileCheck,
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
  { to: '/meetings', label: 'Meeting Notes', icon: BookOpen },
  { to: '/expenses', label: 'Expenses', icon: Receipt },
  { to: '/contracts', label: 'Contracts', icon: FileCheck },
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
      <div className="flex items-center gap-2.5 px-5 h-14 shrink-0 border-b border-sidebar-border">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-accent">
          <FolderKanban size={14} className="text-white" />
        </div>
        <div className="min-w-0">
          <span className="text-text-primary font-bold text-[14px] tracking-[-0.3px]">
            FreelanceFlow
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-0.5 px-2.5 pt-3 flex-1 overflow-y-auto">
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
              className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] transition-all duration-150 ${
                isActive
                  ? 'text-accent font-semibold bg-accent-bg'
                  : 'text-text-nav font-medium hover:bg-input-bg hover:text-text-nav-active'
              }`}
            >
              <item.icon size={16} strokeWidth={isActive ? 2 : 1.5} />
              <span>{item.label}</span>
            </NavLink>
          )
        })}
      </nav>

      {/* Quick Create */}
      <div className="px-2.5 pb-4 pt-2 mt-auto border-t border-sidebar-border">
        <button
          onClick={() => { navigate('/projects?new=1'); onClose(); }}
          className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[12px] text-text-muted hover:text-accent hover:bg-accent-bg transition-all group"
        >
          <div className="w-5 h-5 rounded-md bg-accent/10 group-hover:bg-accent group-hover:text-white flex items-center justify-center transition-all">
            <Plus size={12} />
          </div>
          <span className="font-medium">New Project</span>
        </button>
      </div>
    </aside>
  )
}
