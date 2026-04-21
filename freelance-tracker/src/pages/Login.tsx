import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useI18n } from '../lib/i18n'

export default function Login() {
  const { t } = useI18n()
  const { signIn, signUp } = useAuth()
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [signUpSuccess, setSignUpSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (isSignUp && password !== confirmPassword) {
      setError(t('login.passwordsDoNotMatch'))
      return
    }

    if (password.length < 6) {
      setError(t('login.passwordTooShort'))
      return
    }

    setLoading(true)
    try {
      if (isSignUp) {
        await signUp(email, password)
        setSignUpSuccess(true)
      } else {
        await signIn(email, password)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('login.authFailed'))
    } finally {
      setLoading(false)
    }
  }

  if (signUpSuccess) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-surface rounded-xl border border-border p-8 text-center">
          <img src="/bough-logo.png" alt="Bough" className="w-20 h-20 mx-auto mb-4 object-contain" />
          <h2 className="text-text-primary text-[18px] font-bold mb-2">{t('login.checkEmail')}</h2>
          <p className="text-text-muted text-[13px] leading-relaxed">
            {t('login.sentConfirmationPrefix')}
            <span className="font-semibold text-text-primary">{email}</span>
            {t('login.sentConfirmationSuffix')}
          </p>
          <button
            onClick={() => { setSignUpSuccess(false); setIsSignUp(false) }}
            className="mt-6 text-accent text-[13px] font-semibold hover:underline"
          >
            {t('login.backToSignIn')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center justify-center gap-1 mb-8">
          <img src="/bough-logo.png" alt="Bough" className="w-20 h-20 object-contain" />
          <span
            className="text-text-primary text-[28px] tracking-[-0.5px] leading-none"
            style={{ fontFamily: "'EB Garamond', Georgia, serif", fontWeight: 600 }}
          >
            Bough
          </span>
          <span className="text-text-muted text-[14px] italic tracking-[0.2px] mt-1" style={{ fontFamily: "'EB Garamond', Georgia, serif" }}>
            {t('login.tagline')}
          </span>
        </div>

        {/* Card */}
        <div className="bg-surface rounded-xl border border-border p-6">
          <h2 className="text-text-primary text-[16px] font-bold text-center mb-1">
            {isSignUp ? t('login.createAccount') : t('login.welcomeBack')}
          </h2>
          <p className="text-text-muted text-[12px] text-center mb-6">
            {isSignUp ? t('login.startManaging') : t('login.signInToContinue')}
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-text-muted">{t('login.email')}</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('login.emailPlaceholder')}
                className="h-10 px-3 rounded-lg border border-border bg-input-bg text-[13px] text-text-primary placeholder:text-text-muted outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/30 transition-all"
                autoComplete="email"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-text-muted">{t('login.password')}</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('login.passwordPlaceholder')}
                className="h-10 px-3 rounded-lg border border-border bg-input-bg text-[13px] text-text-primary placeholder:text-text-muted outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/30 transition-all"
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
                minLength={6}
              />
            </div>

            {isSignUp && (
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-semibold text-text-muted">{t('login.confirmPassword')}</label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={t('login.confirmPasswordPlaceholder')}
                  className="h-10 px-3 rounded-lg border border-border bg-input-bg text-[13px] text-text-primary placeholder:text-text-muted outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/30 transition-all"
                  autoComplete="new-password"
                  minLength={6}
                />
              </div>
            )}

            {error && (
              <p className="text-negative text-[12px] bg-negative-bg rounded-lg px-3 py-2">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="h-10 rounded-lg text-[13px] font-semibold text-white bg-accent hover:bg-accent-dark transition-colors disabled:opacity-50 flex items-center justify-center gap-2 mt-1"
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              {isSignUp ? t('login.createAccountBtn') : t('login.signIn')}
            </button>
          </form>

          <div className="mt-4 text-center">
            <button
              onClick={() => { setIsSignUp(!isSignUp); setError(null) }}
              className="text-accent text-[12px] font-medium hover:underline"
            >
              {isSignUp ? t('login.alreadyHave') : t('login.dontHave')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
