import { Menu, Globe, LogOut } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useI18n } from '../lib/i18n'
import { userStorage } from '../lib/userStorage'
import { useAuth } from '../hooks/useAuth'

const pageTitleRules: { match: (path: string) => boolean; key: string }[] = [
  { match: (p) => p === '/', key: 'nav.dashboard' },
  { match: (p) => p.startsWith('/clients'), key: 'nav.clients' },
  { match: (p) => p.startsWith('/projects'), key: 'nav.projects' },
  { match: (p) => p.startsWith('/tasks'), key: 'nav.tasks' },
  { match: (p) => p.startsWith('/timeline'), key: 'nav.timeline' },
  { match: (p) => p.startsWith('/time'), key: 'nav.timeTracker' },
  { match: (p) => p.startsWith('/expenses'), key: 'nav.expenses' },
  { match: (p) => p.startsWith('/contracts'), key: 'nav.contracts' },
  { match: (p) => p.startsWith('/invoices'), key: 'nav.invoices' },
  { match: (p) => p.startsWith('/meetings'), key: 'nav.meetings' },
  { match: (p) => p.startsWith('/emails'), key: 'nav.emails' },
  { match: (p) => p.startsWith('/calendar'), key: 'nav.calendar' },
  { match: (p) => p.startsWith('/settings'), key: 'nav.settings' },
]

function resolveTitleKey(pathname: string): string {
  return pageTitleRules.find((r) => r.match(pathname))?.key ?? 'nav.dashboard'
}

interface TopBarProps {
  onToggleSidebar: () => void
}

export default function TopBar({ onToggleSidebar }: TopBarProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const { t, lang, setLang } = useI18n()
  const { signOut } = useAuth()
  const title = t(resolveTitleKey(location.pathname))

  async function handleLogout() {
    await signOut()
    navigate('/login')
  }

  const profilePhoto = userStorage.get('freelancer_photo') || ''
  const profileData = (() => {
    try {
      const raw = userStorage.get('freelancer_profile')
      if (raw) return JSON.parse(raw)
    } catch { /* ignore */ }
    return { name: '' }
  })()
  const initials = profileData.name
    ? profileData.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
    : 'JD'

  const toggleLang = () => setLang(lang === 'en' ? 'es' : 'en')
  const toggleTitle = lang === 'en' ? t('topbar.switchToSpanish') : t('topbar.switchToEnglish')

  return (
    <header className="h-12 bg-bg flex items-center justify-between px-5 shrink-0 gap-4">
      <div className="flex items-center gap-2.5 shrink-0">
        <button
          onClick={onToggleSidebar}
          className="p-1 rounded-md hover:bg-input-bg transition-colors lg:hidden"
          aria-label={t('topbar.toggleSidebar')}
        >
          <Menu size={18} className="text-text-secondary" />
        </button>
        <h1 className="text-text-primary font-semibold text-[14px]">{title}</h1>
      </div>

      <div className="flex items-center gap-2 min-w-0">
        <button
          onClick={toggleLang}
          className="flex items-center gap-1 px-2 h-7 rounded-md text-[11px] font-semibold text-text-secondary hover:bg-input-bg transition-colors shrink-0"
          title={toggleTitle}
          aria-label={toggleTitle}
        >
          <Globe size={14} />
          <span className="uppercase">{lang}</span>
        </button>
        <button
          onClick={() => navigate('/settings')}
          className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-semibold shrink-0 cursor-pointer overflow-hidden hover:ring-2 hover:ring-accent/20 transition-all"
          style={!profilePhoto ? { background: 'var(--color-accent)' } : undefined}
          title={t('topbar.settings')}
        >
          {profilePhoto ? (
            <img src={profilePhoto} alt="Profile" className="w-full h-full object-cover" />
          ) : (
            initials
          )}
        </button>
        <button
          onClick={handleLogout}
          className="flex items-center justify-center w-7 h-7 rounded-md text-text-secondary hover:bg-input-bg hover:text-negative transition-colors shrink-0"
          title="Log out"
          aria-label="Log out"
        >
          <LogOut size={14} />
        </button>
      </div>
    </header>
  )
}
