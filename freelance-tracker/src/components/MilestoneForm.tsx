import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { useI18n } from '../lib/i18n'

export interface MilestoneFormData {
  name: string
  startDate?: string
  endDate?: string
}

/** The dialog's copy of a milestone, snapshotted by the caller like TaskForm's `task`. */
export interface MilestoneFormMilestone {
  id: string
  name: string
  startDate?: string
  endDate?: string
}

interface MilestoneFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Absent (or null) is the create case; present switches the dialog to edit. */
  milestone?: MilestoneFormMilestone | null
  onSave: (data: MilestoneFormData) => Promise<void>
  /** Only offered in edit mode. The dialog asks for confirmation before calling it. */
  onDelete?: (id: string) => Promise<void>
}

export default function MilestoneForm({ open, onOpenChange, milestone, onSave, onDelete }: MilestoneFormProps) {
  const { t } = useI18n()
  const isEdit = Boolean(milestone)

  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setName(milestone?.name ?? '')
      setStartDate(milestone?.startDate ?? '')
      setEndDate(milestone?.endDate ?? '')
    }
  }, [open, milestone])

  // A milestone may legitimately have one date or neither; only a pair in the wrong
  // order is wrong, and it is said inline rather than on submit.
  const dateOrderError = Boolean(startDate && endDate && startDate > endDate)
  const canSave = Boolean(name.trim()) && !dateOrderError && !saving

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSave) return
    setSaving(true)
    try {
      await onSave({
        name: name.trim(),
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      })
      onOpenChange(false)
    } catch {
      /* caller surfaces the message; keep the dialog open with the user's edits */
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!milestone || !onDelete) return
    // Tasks survive a deleted milestone (the FK is ON DELETE SET NULL), so say so
    // rather than implying the work goes with it.
    if (!window.confirm(t('milestoneForm.confirmDelete', { name: milestone.name }))) return
    setSaving(true)
    try {
      await onDelete(milestone.id)
      onOpenChange(false)
    } catch {
      /* same as save: the page shows the error, the dialog stays open */
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Three labelled fields need no prose; the explicit undefined keeps Radix from
          warning about a description that would only repeat the title. */}
      <DialogContent className="max-w-md" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{isEdit ? t('milestoneForm.editTitle') : t('milestoneForm.newTitle')}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="milestone-name" className="text-[12px]">
              {t('milestoneForm.name')} <span className="text-negative">*</span>
            </Label>
            <Input id="milestone-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="milestone-start" className="text-[12px]">
                {t('milestoneForm.start')}
              </Label>
              <Input
                id="milestone-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="milestone-end" className="text-[12px]">
                {t('milestoneForm.end')}
              </Label>
              <Input id="milestone-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>

          {dateOrderError && (
            <p role="alert" className="text-[12px] text-negative">
              {t('milestoneForm.dateOrder')}
            </p>
          )}

          <DialogFooter className="pt-2">
            {isEdit && onDelete && (
              <Button
                type="button"
                variant="outline"
                onClick={handleDelete}
                disabled={saving}
                className="sm:mr-auto text-negative"
              >
                {t('milestoneForm.delete')}
              </Button>
            )}
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" variant="gradient" disabled={!canSave}>
              {saving ? t('taskForm.saving') : t('common.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
