import { useEffect, useState } from 'react'
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

export interface Client {
  id: string
  name: string
  email: string
  company?: string
  phone?: string
  hourlyRate?: number
  notes?: string
  status?: 'active' | 'inactive'
}

export interface ClientFormData {
  name: string
  email: string
  company?: string
  phone?: string
  hourlyRate?: number
  notes?: string
  status: 'active' | 'inactive'
}

interface ClientFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  client?: Client | null
  onSave: (data: ClientFormData) => Promise<void>
}

export default function ClientForm({ open, onOpenChange, client, onSave }: ClientFormProps) {
  const { t } = useI18n()
  const isEdit = Boolean(client)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [company, setCompany] = useState('')
  const [phone, setPhone] = useState('')
  const [hourlyRate, setHourlyRate] = useState('')
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState<'active' | 'inactive'>('active')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setName(client?.name ?? '')
      setEmail(client?.email ?? '')
      setCompany(client?.company ?? '')
      setPhone(client?.phone ?? '')
      setHourlyRate(client?.hourlyRate != null ? String(client.hourlyRate) : '')
      setNotes(client?.notes ?? '')
      setStatus(client?.status ?? 'active')
    }
  }, [open, client])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await onSave({
        name,
        email,
        company: company || undefined,
        phone: phone || undefined,
        hourlyRate: hourlyRate ? Number(hourlyRate) : undefined,
        notes: notes || undefined,
        status,
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
          <DialogTitle>{isEdit ? t('clientForm.editTitle') : t('clientForm.addTitle')}</DialogTitle>
          <DialogDescription>
            {isEdit ? t('clientForm.editDesc') : t('clientForm.addDesc')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="client-name" className="text-[12px]">
              {t('clientForm.name')} <span className="text-negative">*</span>
            </Label>
            <Input
              id="client-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('clientForm.namePlaceholder')}
              required
            />
          </div>

          {/* Email */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="client-email" className="text-[12px]">
              {t('clientForm.email')} <span className="text-negative">*</span>
            </Label>
            <Input
              id="client-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('clientForm.emailPlaceholder')}
              required
            />
          </div>

          {/* Company & Phone — side by side */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="client-company" className="text-[12px]">
                {t('clientForm.company')}
              </Label>
              <Input
                id="client-company"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder={t('clientForm.companyPlaceholder')}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="client-phone" className="text-[12px]">
                {t('clientForm.phone')}
              </Label>
              <Input
                id="client-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={t('clientForm.phonePlaceholder')}
              />
            </div>
          </div>

          {/* Hourly Rate */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="client-rate" className="text-[12px]">
              {t('clientForm.hourlyRate')}
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-[13px]">
                $
              </span>
              <Input
                id="client-rate"
                type="number"
                min="0"
                step="0.01"
                value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value)}
                placeholder="0.00"
                className="pl-7"
              />
            </div>
          </div>

          {/* Status */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-[12px]">{t('clientForm.status')}</Label>
            <div className="flex gap-2">
              {(['active', 'inactive'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className={`flex-1 h-9 rounded-[10px] text-[12px] font-semibold border transition-colors ${
                    status === s
                      ? s === 'active'
                        ? 'bg-status-active-bg text-status-active-text border-status-active-text/30'
                        : 'bg-input-bg text-text-muted border-border'
                      : 'bg-transparent text-text-muted border-border hover:bg-input-bg'
                  }`}
                >
                  {s === 'active' ? t('clientForm.retained') : t('clientForm.inactive')}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="client-notes" className="text-[12px]">
              {t('clientForm.notes')}
            </Label>
            <textarea
              id="client-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('clientForm.notesPlaceholder')}
              rows={3}
              className="w-full rounded-[12px] border border-border bg-input-bg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 resize-none"
            />
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
            <Button type="submit" variant="gradient" disabled={saving}>
              {saving ? t('clientForm.saving') : isEdit ? t('clientForm.saveChanges') : t('clientForm.add')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
