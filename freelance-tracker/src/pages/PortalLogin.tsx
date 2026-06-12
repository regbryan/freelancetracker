import { useEffect, useState } from 'react'
import { Loader2, MailCheck } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useI18n } from '../lib/i18n'
import PortalLayout from '../components/PortalLayout'

const RESEND_COOLDOWN_S = 60

export default function PortalLogin() {
  const { t } = useI18n()
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (cooldown <= 0) return
    const id = setTimeout(() => setCooldown((s) => s - 1), 1000)
    return () => clearTimeout(id)
  }, [cooldown])

  async function sendLink() {
    setSending(true)
    setError(null)
    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/portal` },
      })
      if (otpError) throw otpError
      setSent(true)
      setCooldown(RESEND_COOLDOWN_S)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSending(false)
    }
  }

  return (
    <PortalLayout>
      <div className="max-w-sm mx-auto mt-[8vh] bg-surface rounded-[14px] shadow-card p-6">
        {sent ? (
          <div className="text-center">
            <MailCheck size={28} className="mx-auto text-accent mb-3" />
            <p className="text-text-primary text-[14px] font-semibold mb-1">{t('portal.linkSent')}</p>
            <p className="text-text-muted text-[12px] mb-4">{email}</p>
            <button
              onClick={sendLink}
              disabled={cooldown > 0 || sending}
              className="text-accent text-[12px] font-semibold hover:underline disabled:text-text-muted disabled:no-underline"
            >
              {cooldown > 0 ? t('portal.resendIn', { s: cooldown }) : t('portal.resend')}
            </button>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (email) sendLink()
            }}
          >
            <h1 className="text-text-primary text-[16px] font-bold mb-1">{t('portal.title')}</h1>
            <p className="text-text-muted text-[12px] mb-4">{t('portal.signInPrompt')}</p>
            <label htmlFor="portal-email" className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
              {t('portal.emailLabel')}
            </label>
            <input
              id="portal-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="mt-1 mb-4 w-full h-10 px-3 rounded-[10px] bg-input-bg border border-border text-[13px] text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <button
              type="submit"
              disabled={sending || !email}
              className="w-full h-10 rounded-[10px] bg-accent text-white text-[13px] font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {sending && <Loader2 size={14} className="animate-spin" />}
              {sending ? t('portal.sending') : t('portal.sendLink')}
            </button>
            {error && <p className="mt-3 text-negative text-[12px]">{t('portal.sendFailed', { error })}</p>}
          </form>
        )}
      </div>
    </PortalLayout>
  )
}
