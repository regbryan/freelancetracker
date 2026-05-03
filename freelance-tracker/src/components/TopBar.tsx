import { useEffect, useRef, useState } from 'react'
import { Menu, Globe, LogOut, Settings as SettingsIcon, Search } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useI18n } from '../lib/i18n'
import { userStorage } from '../lib/userStorage'
import { useAuth } from '../hooks/useAuth'

const pageTitleRules: { match: (path: string) => boolean; title: (t: (k: string) => string) => string }[] = [
  { match: (p) => p === '/', title: (t) => t('nav.dashboard') },
  { match: (p) => p.startsWith('/clients'), title: (t) => t('nav.clients') },
  { match: (p) => p.startsWith('/projects'), title: (t) => t('nav.projects') },
  { match: (p) => p.startsWith('/tasks') || p.startsWith('/timeline') || p.startsWith('/time'), title: () => 'Work' },
  { match: (p) => p.startsWith('/invoices') || p.startsWith('/contracts') || p.startsWith('/expenses'), title: () => 'Billing' },
  { match: (p) => p.startsWith('/meetings'), title: (t) => t('nav.meetings') },
  { match: (p) => p.startsWith('/emails'), title: (t) => t('nav.emails') },
  { match: (p) => p.startsWith('/calendar'), title: (t) => t('nav.calendar') },
  { match: (p) => p.startsWith('/settings'), title: (t) => t('nav.settings') },
]

interface TopBarProps {
  onToggleSidebar: () => void
  onOpenSearch: () => void
}

export default function TopBar({ onToggleSidebar, onOpenSearch }: TopBarProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const { t, lang, setLang } = useI18n()
  const { signOut } = useAuth()
  const title = (pageTitleRules.find((r) => r.match(location.pathname)) ?? pageTitleRules[0]).title(t)

  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

  // Close avatar menu on outside click / escape
  useEffect(() => {
    if (!menuOpen) return
    function onDown(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  async function handleLogout() {
    setMenuOpen(false)
    if (!window.confirm('Are you sure you want to log out?')) return
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
        {/* Search trigger — opens command palette */}
        <button
          onClick={onOpenSearch}
          className="hidden sm:flex items-center gap-2 h-7 px-2.5 rounded-md text-[12px] text-text-muted bg-input-bg hover:bg-input-bg/70 transition-colors shrink-0 border border-border"
          title="Search (⌘K)"
        >
          <Search size={13} />
          <span>Search…</span>
          <kbd className="ml-2 font-mono text-[10px] px-1 rounded border border-border bg-bg">⌘K</kbd>
        </button>
        <button
          onClick={onOpenSearch}
          className="sm:hidden p-1.5 rounded-md hover:bg-input-bg transition-colors text-text-secondary"
          aria-label="Search"
        >
          <Search size={16} />
        </button>

        {/* Avatar with dropdown menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-semibold shrink-0 cursor-pointer overflow-hidden hover:ring-2 hover:ring-accent/30 transition-all"
            style={!profilePhoto ? { background: 'var(--color-accent)' } : undefined}
            title="Account menu"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            {profilePhoto ? (
              <img src={profilePhoto} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              initials
            )}
          </button>

          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-full mt-1.5 w-56 bg-surface border border-border rounded-xl shadow-card z-40 py-1 overflow-hidden"
            >
              {profileData.name && (
                <div className="px-3 py-2 border-b border-border/60">
                  <p className="text-[12px] font-semibold text-text-primary truncate">{profileData.name}</p>
                </div>
              )}
              <button
                onClick={() => { setMenuOpen(false); navigate('/settings') }}
                role="menuitem"
                className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-text-secondary hover:bg-input-bg hover:text-text-primary transition-colors"
              >
                <SettingsIcon size={13} />
                {t('nav.settings')}
              </button>
              <button
                onClick={() => { toggleLang() }}
                role="menuitem"
                className="w-full flex items-center justify-between gap-2.5 px-3 py-2 text-[12px] text-text-secondary hover:bg-input-bg hover:text-text-primary transition-colors"
              >
                <span className="flex items-center gap-2.5">
                  <Globe size={13} />
                  Language
                </span>
                <span className="text-[10px] uppercase font-semibold text-text-muted">{lang}</span>
              </button>
              <div className="border-t border-border/60 my-1" />
              <button
                onClick={handleLogout}
                role="menuitem"
                className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-text-secondary hover:bg-negative/10 hover:text-negative transition-colors"
              >
                <LogOut size={13} />
                Log out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
