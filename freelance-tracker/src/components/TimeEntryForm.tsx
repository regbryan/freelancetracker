import { useState } from 'react'
import { Plus } from 'lucide-react'
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

export interface TimeEntryFormData {
  projectId: string
  description: string
  hours: number
  date: string
  billable: boolean
  taskId?: string | null
}

interface TimeEntryFormProps {
  projectId?: string
  projects?: { id: string; name: string }[]
  tasks?: { id: string; title: string }[]
  onSave: (data: TimeEntryFormData) => Promise<void>
}

function todayISO(): string {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export default function TimeEntryForm({ projectId, projects, tasks, onSave }: TimeEntryFormProps) {
  const { t } = useI18n()
  const [selectedProjectId, setSelectedProjectId] = useState(projectId ?? '')
  const [selectedTaskId, setSelectedTaskId] = useState<string>('')
  const [description, setDescription] = useState('')
  const [hours, setHours] = useState('')
  const [date, setDate] = useState(todayISO)
  const [billable, setBillable] = useState(true)
  const [saving, setSaving] = useState(false)

  const resolvedProjectId = projectId ?? selectedProjectId

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!resolvedProjectId || !description || !hours) return
    setSaving(true)
    try {
      // Round up to nearest 0.25 hour (15 min) increment
      const rawHours = Number(hours)
      const roundedHours = Math.ceil(rawHours * 4) / 4
      await onSave({
        projectId: resolvedProjectId,
        description,
        hours: roundedHours,
        date,
        billable,
        taskId: selectedTaskId || null,
      })
      // Reset form after successful save
      setDescription('')
      setHours('')
      setDate(todayISO())
      setBillable(true)
      setSelectedTaskId('')
      if (!projectId) setSelectedProjectId('')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-surface rounded-[14px] shadow-card p-4"
    >
      <div className="flex flex-wrap items-end gap-3">
        {/* Project Select — only when no fixed projectId */}
        {!projectId && projects && (
          <div className="flex flex-col gap-1 min-w-[160px]">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
              {t('tForm.project')}
            </label>
            <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
              <SelectTrigger className="h-9 text-[12px]">
                <SelectValue placeholder={t('tForm.selectProject')} />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Task selector */}
        {tasks && tasks.length > 0 && (
          <div className="flex flex-col gap-1 min-w-[160px]">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
              {t('tForm.taskOpt')}
            </label>
            <Select
              value={selectedTaskId}
              onValueChange={(val) => {
                setSelectedTaskId(val)
                if (val) {
                  const task = tasks.find((tk) => tk.id === val)
                  if (task) setDescription(task.title)
                }
              }}
            >
              <SelectTrigger className="h-9 text-[12px]">
                <SelectValue placeholder={t('tForm.none')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">{t('tForm.none')}</SelectItem>
                {tasks.map((tk) => (
                  <SelectItem key={tk.id} value={tk.id}>
                    {tk.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Description */}
        <div className="flex flex-col gap-1 flex-1 min-w-[180px]">
          <label className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
            {t('tForm.description')}
          </label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('tForm.descPh')}
            required
            className="h-9 text-[12px]"
          />
        </div>

        {/* Hours */}
        <div className="flex flex-col gap-1 w-[80px]">
          <label className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
            {t('tForm.hours')}
          </label>
          <Input
            type="number"
            min="0.25"
            step="0.25"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            placeholder="0.0"
            required
            className="h-9 text-[12px]"
          />
        </div>

        {/* Date */}
        <div className="flex flex-col gap-1 w-[140px]">
          <label className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
            {t('tForm.date')}
          </label>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-9 text-[12px]"
          />
        </div>

        {/* Billable Toggle */}
        <div className="flex flex-col gap-1 items-center w-[60px]">
          <label className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
            {t('tForm.billable')}
          </label>
          <button
            type="button"
            role="checkbox"
            aria-checked={billable}
            onClick={() => setBillable(!billable)}
            className={`h-9 w-9 rounded-[10px] border transition-colors flex items-center justify-center ${
              billable
                ? 'bg-accent border-accent text-white'
                : 'bg-input-bg border-border text-text-muted'
            }`}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              className={billable ? 'opacity-100' : 'opacity-30'}
            >
              <path
                d="M11.5 3.5L5.5 10L2.5 7"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        {/* Submit */}
        <Button
          type="submit"
          variant="gradient"
          size="sm"
          disabled={saving || !resolvedProjectId || !description || !hours}
          className="h-9"
        >
          <Plus size={14} />
          {saving ? t('tForm.adding') : t('tForm.add')}
        </Button>
      </div>
    </form>
  )
}
