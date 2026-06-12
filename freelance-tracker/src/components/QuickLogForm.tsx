import { useMemo, useRef, useState } from 'react'
import { Plus, Check, ChevronDown } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/components/ui/select'
import { useI18n } from '../lib/i18n'
import {
  recentProjects,
  descriptionSuggestions,
  roundQuarterHour,
  type EntryLike,
  type ProjectRef,
} from '../lib/quickLog'

export interface QuickLogData {
  projectId: string
  description: string
  hours: number
  date: string
  billable: boolean
  taskId: string | null
}

interface QuickLogFormProps {
  projects: ProjectRef[]
  entries: EntryLike[]
  tasks?: { id: string; title: string }[]
  onSave: (data: QuickLogData) => Promise<void>
  /** Called after a successful save (the dialog uses this to close). */
  onSaved?: () => void
  autoFocus?: boolean
}

const MAX_CHIPS = 5

function isoDaysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export default function QuickLogForm({ projects, entries, tasks, onSave, onSaved, autoFocus }: QuickLogFormProps) {
  const { t } = useI18n()
  const [chosenProjectId, setChosenProjectId] = useState('')
  const [description, setDescription] = useState('')
  const [hours, setHours] = useState('')
  const [date, setDate] = useState(() => isoDaysAgo(0))
  const [billable, setBillable] = useState(true)
  const [taskId, setTaskId] = useState('')
  const [showMore, setShowMore] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [suggestOpen, setSuggestOpen] = useState(false)
  const [suggestIndex, setSuggestIndex] = useState(-1)
  const savedTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const chips = useMemo(() => recentProjects(entries, projects, MAX_CHIPS), [entries, projects])
  const overflow = useMemo(
    () => projects.filter((p) => !chips.some((c) => c.id === p.id)),
    [projects, chips],
  )
  // Default to the most recently logged-against project until the user picks one.
  const projectId = chosenProjectId || chips[0]?.id || ''

  const suggestions = useMemo(
    () => descriptionSuggestions(entries, projectId, description),
    [entries, projectId, description],
  )

  function applySuggestion(s: { description: string; hours: number }) {
    setDescription(s.description)
    setHours(String(s.hours))
    setSuggestOpen(false)
    setSuggestIndex(-1)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!projectId || !description || !hours) return
    setSaving(true)
    setError(null)
    try {
      await onSave({
        projectId,
        description,
        hours: roundQuarterHour(Number(hours)),
        date,
        billable,
        taskId: taskId || null,
      })
      setDescription('')
      setHours('')
      setTaskId('')
      setSuggestOpen(false)
      setSuggestIndex(-1)
      setSaved(true)
      if (savedTimeout.current) clearTimeout(savedTimeout.current)
      savedTimeout.current = setTimeout(() => setSaved(false), 2000)
      onSaved?.()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  if (projects.length === 0) {
    return (
      <div className="bg-surface rounded-[14px] shadow-card p-4 text-[12px] text-text-muted">
        {t('quickLog.noProjects')}{' '}
        <a href="/projects" className="text-accent font-semibold hover:underline">
          {t('quickLog.createProject')}
        </a>
      </div>
    )
  }

  const todayISO = isoDaysAgo(0)
  const yesterdayISO = isoDaysAgo(1)

  return (
    <form onSubmit={handleSubmit} className="bg-surface rounded-[14px] shadow-card p-4 flex flex-col gap-3">
      {/* Project chips */}
      <div role="radiogroup" aria-label={t('quickLog.project')} className="flex flex-wrap items-center gap-1.5">
        {chips.map((p) => {
          const active = p.id === projectId
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setChosenProjectId(p.id)}
              className={`px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all ${
                active
                  ? 'bg-accent text-white shadow-sm'
                  : 'bg-input-bg text-text-muted hover:text-text-primary hover:bg-border'
              }`}
            >
              {p.name}
            </button>
          )
        })}
        {overflow.length > 0 && (
          <Select value="" onValueChange={(v) => setChosenProjectId(v)}>
            <SelectTrigger
              aria-label={t('quickLog.moreProjects')}
              className="h-7 w-auto rounded-full border-0 bg-input-bg px-3 text-[11px] font-semibold text-text-muted"
            >
              <SelectValue placeholder={t('quickLog.moreProjects')} />
            </SelectTrigger>
            <SelectContent>
              {overflow.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Capture row */}
      <div className="flex flex-wrap items-end gap-3">
        {/* Description + suggestions */}
        <div className="relative flex flex-col gap-1 flex-1 min-w-[200px]">
          <label className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
            {t('quickLog.description')}
          </label>
          <Input
            value={description}
            onChange={(e) => {
              setDescription(e.target.value)
              setSuggestOpen(true)
              setSuggestIndex(-1)
            }}
            onFocus={() => setSuggestOpen(true)}
            onBlur={() => setTimeout(() => setSuggestOpen(false), 150)}
            onKeyDown={(e) => {
              if (!suggestOpen || suggestions.length === 0) return
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setSuggestIndex((i) => Math.min(i + 1, suggestions.length - 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setSuggestIndex((i) => Math.max(i - 1, -1))
              } else if (e.key === 'Enter' && suggestIndex >= 0) {
                e.preventDefault()
                applySuggestion(suggestions[suggestIndex])
              } else if (e.key === 'Escape') {
                setSuggestOpen(false)
                setSuggestIndex(-1)
              }
            }}
            placeholder={t('quickLog.descPh')}
            required
            autoFocus={autoFocus}
            className="h-9 text-[12px]"
            role="combobox"
            aria-expanded={suggestOpen && suggestions.length > 0}
            aria-autocomplete="list"
          />
          {suggestOpen && suggestions.length > 0 && (
            <ul
              role="listbox"
              aria-label={t('quickLog.suggestionsLabel')}
              className="absolute top-full left-0 right-0 mt-1 z-30 bg-surface border border-border rounded-[10px] shadow-card overflow-hidden"
            >
              {suggestions.map((s, i) => (
                <li key={s.description}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={i === suggestIndex}
                    onMouseEnter={() => setSuggestIndex(i)}
                    onMouseDown={(e) => e.preventDefault() /* keep input focus */}
                    onClick={() => applySuggestion(s)}
                    className={`w-full flex items-center justify-between px-3 py-2 text-left text-[12px] ${
                      i === suggestIndex ? 'bg-input-bg' : 'hover:bg-input-bg/60'
                    }`}
                  >
                    <span className="text-text-primary truncate">{s.description}</span>
                    <span className="text-text-muted shrink-0 ml-3">{s.hours}h</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Hours */}
        <div className="flex flex-col gap-1 w-[80px]">
          <label htmlFor="quicklog-hours" className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
            {t('quickLog.hours')}
          </label>
          <Input
            id="quicklog-hours"
            type="number"
            min="0.25"
            // step="any": free-form values are accepted and rounded to the
            // nearest quarter hour on submit (a 0.25 step would fail native
            // validation for inputs like 1.1 and silently block submission).
            step="any"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            placeholder="0.0"
            required
            className="h-9 text-[12px]"
          />
        </div>

        {/* Date: Today / Yesterday pills + picker */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
            {t('quickLog.date')}
          </label>
          <div className="flex items-center gap-1.5">
            {[
              { label: t('quickLog.today'), value: todayISO },
              { label: t('quickLog.yesterday'), value: yesterdayISO },
            ].map((pill) => (
              <button
                key={pill.value}
                type="button"
                onClick={() => setDate(pill.value)}
                className={`h-9 px-3 rounded-[10px] text-[11px] font-semibold transition-all ${
                  date === pill.value
                    ? 'bg-accent text-white shadow-sm'
                    : 'bg-input-bg text-text-muted hover:text-text-primary hover:bg-border'
                }`}
              >
                {pill.label}
              </button>
            ))}
            <Input
              type="date"
              aria-label={t('quickLog.date')}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-9 w-[130px] text-[12px]"
            />
          </div>
        </div>

        {/* Billable */}
        <div className="flex flex-col gap-1 items-center">
          <label className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
            {t('quickLog.billable')}
          </label>
          <button
            type="button"
            role="checkbox"
            aria-checked={billable}
            aria-label={t('quickLog.billable')}
            onClick={() => setBillable(!billable)}
            className={`h-9 w-9 rounded-[10px] border transition-colors flex items-center justify-center ${
              billable ? 'bg-accent border-accent text-white' : 'bg-input-bg border-border text-text-muted'
            }`}
          >
            <Check size={14} className={billable ? 'opacity-100' : 'opacity-30'} />
          </button>
        </div>

        {/* Submit */}
        <Button
          type="submit"
          variant="gradient"
          size="sm"
          disabled={saving || !projectId || !description || !hours}
          className="h-9"
        >
          <Plus size={14} />
          {saving ? t('quickLog.adding') : saved ? t('quickLog.added') : t('quickLog.add')}
        </Button>
      </div>

      {/* More options (task picker) */}
      {tasks && tasks.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowMore((v) => !v)}
            className="flex items-center gap-1 text-[11px] font-semibold text-text-muted hover:text-text-primary"
          >
            <ChevronDown size={12} className={`transition-transform ${showMore ? 'rotate-180' : ''}`} />
            {t('quickLog.moreOptions')}
          </button>
          {showMore && (
            <div className="mt-2 flex flex-col gap-1 max-w-[280px]">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                {t('quickLog.task')}
              </label>
              <Select
                value={taskId}
                onValueChange={(val) => {
                  setTaskId(val)
                  if (val) {
                    const task = tasks.find((tk) => tk.id === val)
                    if (task) setDescription(task.title)
                  }
                }}
              >
                <SelectTrigger className="h-9 text-[12px]">
                  <SelectValue placeholder={t('common.none')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">{t('common.none')}</SelectItem>
                  {tasks.map((tk) => (
                    <SelectItem key={tk.id} value={tk.id}>
                      {tk.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="text-negative text-[12px]">{t('quickLog.saveFailed', { error })}</p>
      )}
    </form>
  )
}
