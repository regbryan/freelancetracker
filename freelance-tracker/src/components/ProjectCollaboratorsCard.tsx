import { useId, useState, type FormEvent } from 'react'
import { Loader2, UserPlus, X, Users } from 'lucide-react'
import { useProjectMembers } from '../hooks/useProjectMembers'
import { useI18n } from '../lib/i18n'

interface Props {
  projectId: string
}

/** Owner-only card: who can add and edit tasks on this project. */
export default function ProjectCollaboratorsCard({ projectId }: Props) {
  const { t } = useI18n()
  const { members, loading, error: loadError, addMember, removeMember } = useProjectMembers(projectId)
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const errorId = useId()

  function mapError(err: unknown): string {
    console.error(err)
    const m = err instanceof Error ? err.message : ''
    if (m === 'duplicate') return t('collab.duplicate')
    if (m === 'invalid') return t('collab.invalidEmail')
    return t('collab.failed')
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      await addMember(email)
      setEmail('')
    } catch (err) {
      setError(mapError(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-surface rounded-[14px] shadow-card p-5 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Users size={14} className="text-accent" />
        <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">{t('collab.title')}</p>
      </div>
      <p className="text-text-muted text-[12px]">{t('collab.desc')}</p>

      {loading ? (
        <Loader2 size={16} className="animate-spin text-accent" />
      ) : loadError ? (
        <p className="text-negative text-[12px]" role="alert">{loadError}</p>
      ) : members.length === 0 ? (
        <p className="text-text-muted text-[12px]">{t('collab.empty')}</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {members.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-3 bg-input-bg/50 rounded-[10px] px-3 py-2">
              <span className="text-[12px] text-text-primary truncate">{m.email}</span>
              <button
                type="button"
                onClick={() => removeMember(m.id).then(() => setError(null)).catch((err) => setError(mapError(err)))}
                className="flex items-center gap-1 text-[11px] text-text-muted hover:text-negative transition-colors"
                aria-label={`${t('collab.remove')} ${m.email}`}
              >
                <X size={12} />
                {t('collab.remove')}
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={submit} noValidate className="flex items-center gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value)
            setError(null)
          }}
          placeholder={t('collab.emailPlaceholder')}
          aria-label={t('collab.emailLabel')}
          autoComplete="email"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          className="flex-1 h-9 rounded-lg border border-border bg-input-bg px-3 text-[12px] text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/30"
        />
        <button
          type="submit"
          disabled={saving || email.trim() === ''}
          className="flex items-center gap-1.5 h-9 px-3 rounded-lg text-white text-[12px] font-semibold disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg, #305445 0%, #3e6b5a 100%)' }}
        >
          <UserPlus size={12} />
          {t('collab.add')}
        </button>
      </form>
      {error && <p id={errorId} className="text-negative text-[11px]" role="alert">{error}</p>}
    </div>
  )
}
