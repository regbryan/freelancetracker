import { NavLink } from 'react-router-dom'
import { CheckSquare, GanttChartSquare, Clock } from 'lucide-react'
import { useRole } from '../hooks/useWorkspaceRole'

/**
 * Shared sub-nav for the consolidated "Work" surface.
 * Mounted at the top of /timeline, /tasks, and /time. Timeline comes first
 * because it is the planning home; collaborators never see the Timer.
 */
export default function WorkTabs() {
  const role = useRole()
  const tabs = [
    { to: '/timeline', label: 'Timeline', icon: GanttChartSquare },
    { to: '/tasks', label: 'List', icon: CheckSquare },
    ...(role === 'collaborator' ? [] : [{ to: '/time', label: 'Timer', icon: Clock }]),
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
              {isActive && <span className="absolute left-2 right-2 -bottom-px h-[2px] bg-accent rounded-full" />}
            </>
          )}
        </NavLink>
      ))}
    </div>
  )
}
