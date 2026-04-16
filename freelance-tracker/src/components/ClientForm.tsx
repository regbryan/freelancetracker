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
          <DialogTitle>{isEdit ? 'Edit Client' : 'Add Client'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Update the client details below.'
              : 'Fill in the details to add a new client.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="client-name" className="text-[12px]">
              Name <span className="text-negative">*</span>
            </Label>
            <Input
              id="client-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Client name"
              required
            />
          </div>

          {/* Email */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="client-email" className="text-[12px]">
              Email <span className="text-negative">*</span>
            </Label>
            <Input
              id="client-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="client@example.com"
              required
            />
          </div>

          {/* Company & Phone — side by side */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="client-company" className="text-[12px]">
                Company
              </Label>
              <Input
                id="client-company"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Company name"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="client-phone" className="text-[12px]">
                Phone
              </Label>
              <Input
                id="client-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 (555) 000-0000"
              />
            </div>
          </div>

          {/* Hourly Rate */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="client-rate" className="text-[12px]">
              Default Hourly Rate
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
            <Label className="text-[12px]">Status</Label>
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
                  {s === 'active' ? 'Retained' : 'Inactive'}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="client-notes" className="text-[12px]">
              Notes
            </Label>
            <textarea
              id="client-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes..."
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
              Cancel
            </Button>
            <Button type="submit" variant="gradient" disabled={saving}>
              {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Client'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
