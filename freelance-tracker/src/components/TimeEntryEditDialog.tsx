import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { useI18n } from '../lib/i18n'

interface TimeEntryEditData {
  id: string
  description: string
  hours: number
  date: string
  billable: boolean
}

interface TimeEntryEditDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  entry: TimeEntryEditData | null
  onSave: (id: string, data: { description: string; hours: number; date: string; billable: boolean }) => Promise<void>
}

export default function TimeEntryEditDialog({
  open,
  onOpenChange,
  entry,
  onSave,
}: TimeEntryEditDialogProps) {
  const { t } = useI18n()
  const [description, setDescription] = useState('')
  const [hours, setHours] = useState('')
  const [date, setDate] = useState('')
  const [billable, setBillable] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open && entry) {
      setDescription(entry.description)
      setHours(String(entry.hours))
      setDate(entry.date)
      setBillable(entry.billable)
    }
  }, [open, entry])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!entry || !description || !hours) return

    setSaving(true)
    try {
      // Round up to nearest 0.25 hour (15 min) increment
      const rawHours = Number(hours)
      const roundedHours = Math.ceil(rawHours * 4) / 4

      await onSave(entry.id, {
        description,
        hours: roundedHours,
        date,
        billable,
      })
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('tEdit.title')}</DialogTitle>
          <DialogDescription>
            {t('tEdit.desc')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-description" className="text-[12px]">
              {t('tEdit.description')} <span className="text-negative">*</span>
            </Label>
            <Input
              id="edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('tEdit.descPh')}
              required
            />
          </div>

          {/* Hours & Date side by side */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-hours" className="text-[12px]">
                {t('tEdit.hours')} <span className="text-negative">*</span>
              </Label>
              <Input
                id="edit-hours"
                type="number"
                min="0.25"
                step="0.25"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                placeholder={t('tEdit.hoursPh')}
                required
              />
              <p className="text-text-muted text-[10px]">{t('tEdit.rounded')}</p>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-date" className="text-[12px]">
                {t('tEdit.date')}
              </Label>
              <Input
                id="edit-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>

          {/* Billable Toggle */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              role="checkbox"
              aria-checked={billable}
              onClick={() => setBillable(!billable)}
              className={`h-8 w-8 rounded-[8px] border transition-colors flex items-center justify-center ${
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
            <Label className="text-[12px] cursor-pointer" onClick={() => setBillable(!billable)}>
              {t('tEdit.billable')}
            </Label>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit" variant="gradient" disabled={saving || !description || !hours}>
              {saving ? t('tEdit.saving') : t('tEdit.saveChanges')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
