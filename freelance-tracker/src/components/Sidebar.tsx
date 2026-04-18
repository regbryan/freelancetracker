import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  CheckSquare,
  BookOpen,
  Receipt,
  FileCheck,
  FileText,
  Calendar,
  GanttChartSquare,
  Settings,
  Plus,
  Mail,
} from 'lucide-react'

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/clients', label: 'Clients', icon: Users },
  { to: '/projects', label: 'Projects', icon: FolderKanban },
  { to: '/tasks', label: 'Tasks', icon: CheckSquare },
  { to: '/timeline', label: 'Timeline', icon: GanttChartSquare },
  { to: '/meetings', label: 'Meeting Notes', icon: BookOpen },
  { to: '/calendar', label: 'Calendar', icon: Calendar },
  { to: '/emails', label: 'Email Search', icon: Mail },
  { to: '/expenses', label: 'Expenses', icon: Receipt },
  { to: '/contracts', label: 'Contracts', icon: FileCheck },
  { to: '/invoices', label: 'Invoices', icon: FileText },
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
      className={`fixed left-0 top-0 h-screen w-[220px] border-r border-sidebar-border flex flex-col z-30 transition-transform duration-200 ease-in-out
        ${open ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}
      style={{ background: 'linear-gradient(to right, #15263a 0%, #0f1c2a 100%)' }}
    >
      {/* Logo */}
      <div
        className="flex items-center gap-2 px-5 h-16 shrink-0 border-b border-sidebar-border"
        style={{ background: '#EFEAE0' }}
      >
        <img src="/bough-logo.png" alt="Bough" className="w-10 h-10 shrink-0 object-contain" />
        <div className="min-w-0 flex flex-col leading-tight">
          <span
            className="text-[20px] tracking-[-0.3px]"
            style={{ fontFamily: "'EB Garamond', Georgia, serif", fontWeight: 600, color: '#1a3529' }}
          >
            Bough
          </span>
          <span className="text-[13px] italic tracking-[0.2px]" style={{ fontFamily: "'EB Garamond', Georgia, serif", color: '#5a6b60' }}>
            Grow what you build.
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
                  ? 'text-white font-semibold'
                  : 'text-text-nav font-medium hover:bg-white/10 hover:text-white'
              }`}
              style={isActive ? { background: 'linear-gradient(135deg, #305445 0%, #3e6b5a 100%)' } : undefined}
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
          className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[12px] text-text-nav hover:text-white hover:bg-white/10 transition-all group"
        >
          <div className="w-5 h-5 rounded-md bg-white/10 group-hover:bg-accent group-hover:text-white flex items-center justify-center transition-all">
            <Plus size={12} />
          </div>
          <span className="font-medium">New Project</span>
        </button>
      </div>
    </aside>
  )
}
