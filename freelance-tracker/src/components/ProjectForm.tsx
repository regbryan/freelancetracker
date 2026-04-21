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
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/components/ui/select'
import { useI18n } from '../lib/i18n'

export interface Project {
  id: string
  clientId: string
  name: string
  description?: string
  status: 'active' | 'completed' | 'on_hold' | 'cancelled'
  type?: string
  billingType?: 'hourly' | 'monthly'
  hourlyRate?: number
  monthlyRate?: number
  startDate?: string
  endDate?: string
}

export interface ProjectFormData {
  clientId: string
  name: string
  description?: string
  status: 'active' | 'completed' | 'on_hold' | 'cancelled'
  type?: string
  billingType: 'hourly' | 'monthly'
  hourlyRate?: number
  monthlyRate?: number
  startDate?: string
  endDate?: string
}

interface ProjectFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  project?: Project | null
  clients: { id: string; name: string }[]
  projectTypes?: string[]
  onSave: (data: ProjectFormData) => Promise<void>
}

const STATUS_OPTIONS = [
  { value: 'active', labelKey: 'projForm.statusActive' },
  { value: 'completed', labelKey: 'projForm.statusCompleted' },
  { value: 'on_hold', labelKey: 'projForm.statusOnHold' },
  { value: 'cancelled', labelKey: 'projForm.statusCancelled' },
] as const

export default function ProjectForm({
  open,
  onOpenChange,
  project,
  clients,
  projectTypes = [],
  onSave,
}: ProjectFormProps) {
  const { t } = useI18n()
  const isEdit = Boolean(project)

  const [clientId, setClientId] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<ProjectFormData['status']>('active')
  const [type, setType] = useState('')
  const [showTypeDropdown, setShowTypeDropdown] = useState(false)
  const [billingType, setBillingType] = useState<'hourly' | 'monthly'>('hourly')
  const [hourlyRate, setHourlyRate] = useState('')
  const [monthlyRate, setMonthlyRate] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [saving, setSaving] = useState(false)

  const filteredTypes = projectTypes.filter((pt) =>
    pt.toLowerCase().includes(type.toLowerCase()),
  )

  useEffect(() => {
    if (open) {
      setClientId(project?.clientId ?? '')
      setName(project?.name ?? '')
      setDescription(project?.description ?? '')
      setStatus(project?.status ?? 'active')
      setType(project?.type ?? '')
      setBillingType(project?.billingType ?? 'hourly')
      setHourlyRate(project?.hourlyRate != null ? String(project.hourlyRate) : '')
      setMonthlyRate(project?.monthlyRate != null ? String(project.monthlyRate) : '')
      setStartDate(project?.startDate ?? '')
      setEndDate(project?.endDate ?? '')
      setShowTypeDropdown(false)
    }
  }, [open, project])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await onSave({
        clientId,
        name,
        description: description || undefined,
        status,
        type: type.trim() || undefined,
        billingType,
        hourlyRate: billingType === 'hourly' && hourlyRate ? Number(hourlyRate) : undefined,
        monthlyRate: billingType === 'monthly' && monthlyRate ? Number(monthlyRate) : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
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
          <DialogTitle>{isEdit ? t('projForm.editTitle') : t('projForm.addTitle')}</DialogTitle>
          <DialogDescription>
            {isEdit ? t('projForm.editDesc') : t('projForm.addDesc')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Client */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="project-client" className="text-[12px]">
              {t('projForm.client')} <span className="text-negative">*</span>
            </Label>
            <Select value={clientId} onValueChange={setClientId} required>
              <SelectTrigger id="project-client">
                <SelectValue placeholder={t('projForm.selectClient')} />
              </SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Project Name */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="project-name" className="text-[12px]">
              {t('projForm.name')} <span className="text-negative">*</span>
            </Label>
            <Input
              id="project-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('projForm.namePh')}
              required
            />
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="project-desc" className="text-[12px]">
              {t('projForm.description')}
            </Label>
            <textarea
              id="project-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('projForm.descPh')}
              rows={3}
              className="w-full rounded-[12px] border border-border bg-input-bg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 resize-none"
            />
          </div>

          {/* Project Type — combobox */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="project-type" className="text-[12px]">
              {t('projForm.type')}
            </Label>
            <div className="relative">
              <Input
                id="project-type"
                value={type}
                onChange={(e) => {
                  setType(e.target.value)
                  setShowTypeDropdown(true)
                }}
                onFocus={() => setShowTypeDropdown(true)}
                onBlur={() => {
                  // Delay to allow click on dropdown item
                  setTimeout(() => setShowTypeDropdown(false), 150)
                }}
                placeholder={t('projForm.typePh')}
                autoComplete="off"
              />
              {showTypeDropdown && filteredTypes.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-surface border border-border rounded-lg shadow-card z-20 max-h-32 overflow-y-auto">
                  {filteredTypes.map((pt) => (
                    <button
                      key={pt}
                      type="button"
                      className="w-full text-left px-3 py-1.5 text-[12px] text-text-primary hover:bg-input-bg transition-colors"
                      onMouseDown={(e) => {
                        e.preventDefault()
                        setType(pt)
                        setShowTypeDropdown(false)
                      }}
                    >
                      {pt}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Status */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="project-status" className="text-[12px]">
              {t('projForm.status')} <span className="text-negative">*</span>
            </Label>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as ProjectFormData['status'])}
            >
              <SelectTrigger id="project-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {t(opt.labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date range */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="project-start" className="text-[12px]">{t('projForm.startDate')}</Label>
              <Input
                id="project-start"
                type="date"
                value={startDate}
                max={endDate || undefined}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="project-end" className="text-[12px]">{t('projForm.endDate')}</Label>
              <Input
                id="project-end"
                type="date"
                value={endDate}
                min={startDate || undefined}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          {/* Billing Type toggle + Rate */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-[12px]">{t('projForm.billingType')}</Label>
            <div className="flex gap-1 p-1 rounded-[10px] bg-input-bg border border-border w-full">
              {(['hourly', 'monthly'] as const).map((bt) => (
                <button
                  key={bt}
                  type="button"
                  onClick={() => setBillingType(bt)}
                  className={`flex-1 py-1.5 rounded-[8px] text-[12px] font-semibold transition-colors ${
                    billingType === bt
                      ? 'bg-accent text-white shadow-sm'
                      : 'text-text-muted hover:text-text-primary'
                  }`}
                >
                  {bt === 'hourly' ? t('projForm.hourly') : t('projForm.monthlyFlat')}
                </button>
              ))}
            </div>
          </div>

          {/* Rate field — label & step change based on billing type */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="project-rate" className="text-[12px]">
              {billingType === 'hourly' ? t('projForm.hourlyRate') : t('projForm.monthlyRate')}
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-[13px]">
                $
              </span>
              {billingType === 'hourly' ? (
                <Input
                  id="project-rate"
                  type="number"
                  min="0"
                  step="0.01"
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(e.target.value)}
                  placeholder="0.00"
                  className="pl-7"
                />
              ) : (
                <Input
                  id="project-rate"
                  type="number"
                  min="0"
                  step="1"
                  value={monthlyRate}
                  onChange={(e) => setMonthlyRate(e.target.value)}
                  placeholder="0.00"
                  className="pl-7"
                />
              )}
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted text-[11px]">
                {billingType === 'hourly' ? '/hr' : '/mo'}
              </span>
            </div>
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
            <Button type="submit" variant="gradient" disabled={saving || !clientId}>
              {saving ? t('projForm.saving') : isEdit ? t('projForm.saveChanges') : t('projForm.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
