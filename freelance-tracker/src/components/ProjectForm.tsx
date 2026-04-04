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

export interface Project {
  id: string
  clientId: string
  name: string
  description?: string
  status: 'active' | 'completed' | 'on_hold' | 'cancelled'
  hourlyRate?: number
}

export interface ProjectFormData {
  clientId: string
  name: string
  description?: string
  status: 'active' | 'completed' | 'on_hold' | 'cancelled'
  hourlyRate?: number
}

interface ProjectFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  project?: Project | null
  clients: { id: string; name: string }[]
  onSave: (data: ProjectFormData) => Promise<void>
}

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'cancelled', label: 'Cancelled' },
] as const

export default function ProjectForm({
  open,
  onOpenChange,
  project,
  clients,
  onSave,
}: ProjectFormProps) {
  const isEdit = Boolean(project)

  const [clientId, setClientId] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<ProjectFormData['status']>('active')
  const [hourlyRate, setHourlyRate] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setClientId(project?.clientId ?? '')
      setName(project?.name ?? '')
      setDescription(project?.description ?? '')
      setStatus(project?.status ?? 'active')
      setHourlyRate(project?.hourlyRate != null ? String(project.hourlyRate) : '')
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
        hourlyRate: hourlyRate ? Number(hourlyRate) : undefined,
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
          <DialogTitle>{isEdit ? 'Edit Project' : 'Add Project'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Update the project details below.'
              : 'Fill in the details to create a new project.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Client */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="project-client" className="text-[12px]">
              Client <span className="text-negative">*</span>
            </Label>
            <Select value={clientId} onValueChange={setClientId} required>
              <SelectTrigger id="project-client">
                <SelectValue placeholder="Select a client" />
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
              Project Name <span className="text-negative">*</span>
            </Label>
            <Input
              id="project-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Brand Identity Redesign"
              required
            />
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="project-desc" className="text-[12px]">
              Description
            </Label>
            <textarea
              id="project-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief project description..."
              rows={3}
              className="w-full rounded-[12px] border border-border bg-input-bg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 resize-none"
            />
          </div>

          {/* Status & Hourly Rate — side by side */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="project-status" className="text-[12px]">
                Status <span className="text-negative">*</span>
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
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="project-rate" className="text-[12px]">
                Hourly Rate
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-[13px]">
                  $
                </span>
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
              </div>
            </div>
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
            <Button type="submit" variant="gradient" disabled={saving || !clientId}>
              {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Project'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
