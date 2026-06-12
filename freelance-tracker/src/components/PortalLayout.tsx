import type { ReactNode } from 'react'
import { LogOut } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useI18n } from '../lib/i18n'

interface Props {
  clientName?: string
  children: ReactNode
}

/** Minimal chrome for the client portal: logo, client name, language, sign out. */
export default function PortalLayout({ clientName, children }: Props) {
  const { t, lang, setLang } = useI18n()
  const { user, signOut } = useAuth()

  return (
    <div className="min-h-screen bg-bg">
      <header className="bg-surface border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/bough-logo.png" alt="Bough" className="w-8 h-8 object-contain" />
            <div>
              <p className="text-text-primary text-[14px] font-bold leading-tight">Bough</p>
              <p className="text-text-muted text-[10px] uppercase tracking-[1.5px]">{t('portal.title')}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {clientName && (
              <span className="hidden sm:inline text-text-secondary text-[12px] font-semibold">{clientName}</span>
            )}
            <button
              onClick={() => setLang(lang === 'en' ? 'es' : 'en')}
              className="px-2 py-1 rounded-[8px] bg-input-bg text-text-muted text-[11px] font-semibold hover:text-text-primary transition-colors"
            >
              {lang === 'en' ? 'ES' : 'EN'}
            </button>
            {user && (
              <button
                onClick={() => signOut()}
                className="flex items-center gap-1.5 px-2 py-1 rounded-[8px] text-text-muted text-[11px] font-semibold hover:text-text-primary hover:bg-input-bg transition-colors"
              >
                <LogOut size={12} />
                {t('portal.signOut')}
              </button>
            )}
          </div>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-4 py-6">{children}</main>
    </div>
  )
}
