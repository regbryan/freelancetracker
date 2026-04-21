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

export interface TaskFormData {
  title: string
  description?: string
  status: 'todo' | 'in_progress' | 'done'
  priority: 'low' | 'medium' | 'high'
  startDate?: string
  dueDate?: string
  projectId?: string
}

interface TaskFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  task?: {
    id: string
    title: string
    description?: string
    status: string
    priority: string
    startDate?: string
    dueDate?: string
  } | null
  /** When provided, a project selector is shown (for creating tasks outside a project context). */
  projects?: { id: string; name: string }[]
  onSave: (data: TaskFormData) => Promise<void>
}

const STATUS_OPTIONS = [
  { value: 'todo', labelKey: 'taskForm.statusTodo' },
  { value: 'in_progress', labelKey: 'taskForm.statusInProgress' },
  { value: 'done', labelKey: 'taskForm.statusDone' },
] as const

const PRIORITY_OPTIONS = [
  { value: 'low', labelKey: 'taskForm.priorityLow' },
  { value: 'medium', labelKey: 'taskForm.priorityMedium' },
  { value: 'high', labelKey: 'taskForm.priorityHigh' },
] as const

export default function TaskForm({
  open,
  onOpenChange,
  task,
  projects,
  onSave,
}: TaskFormProps) {
  const { t } = useI18n()
  const isEdit = Boolean(task)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<TaskFormData['status']>('todo')
  const [priority, setPriority] = useState<TaskFormData['priority']>('medium')
  const [startDate, setStartDate] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [projectId, setProjectId] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setTitle(task?.title ?? '')
      setDescription(task?.description ?? '')
      setStatus((task?.status as TaskFormData['status']) ?? 'todo')
      setPriority((task?.priority as TaskFormData['priority']) ?? 'medium')
      setStartDate(task?.startDate ?? '')
      setDueDate(task?.dueDate ?? '')
      setProjectId('')
    }
  }, [open, task])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (projects && !isEdit && !projectId) return
    setSaving(true)
    try {
      await onSave({
        title,
        description: description || undefined,
        status,
        priority,
        startDate: startDate || undefined,
        dueDate: dueDate || undefined,
        projectId: projectId || undefined,
      })
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? t('taskForm.editTitle') : t('taskForm.addTitle')}</DialogTitle>
          <DialogDescription>
            {isEdit ? t('taskForm.editDesc') : t('taskForm.addDesc')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Project — only when creating from global tasks page */}
          {projects && !isEdit && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="task-project" className="text-[12px]">
                {t('taskForm.project')} <span className="text-negative">*</span>
              </Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger id="task-project">
                  <SelectValue placeholder={t('taskForm.selectProject')} />
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

          {/* Title */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="task-title" className="text-[12px]">
              {t('taskForm.title')} <span className="text-negative">*</span>
            </Label>
            <Input
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('taskForm.titlePh')}
              required
            />
          </div>

          {/* Status & Priority — side by side */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="task-status" className="text-[12px]">
                {t('taskForm.status')} <span className="text-negative">*</span>
              </Label>
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as TaskFormData['status'])}
              >
                <SelectTrigger id="task-status">
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

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="task-priority" className="text-[12px]">
                {t('taskForm.priority')} <span className="text-negative">*</span>
              </Label>
              <Select
                value={priority}
                onValueChange={(v) => setPriority(v as TaskFormData['priority'])}
              >
                <SelectTrigger id="task-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {t(opt.labelKey)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Date range */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="task-start" className="text-[12px]">{t('taskForm.startDate')}</Label>
              <Input
                id="task-start"
                type="date"
                value={startDate}
                max={dueDate || undefined}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="task-due" className="text-[12px]">{t('taskForm.endDate')}</Label>
              <Input
                id="task-due"
                type="date"
                value={dueDate}
                min={startDate || undefined}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="task-desc" className="text-[12px]">
              {t('taskForm.description')}
            </Label>
            <textarea
              id="task-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('taskForm.descPh')}
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
            <Button type="submit" variant="gradient" disabled={saving || !title.trim() || (!!projects && !isEdit && !projectId)}>
              {saving ? t('taskForm.saving') : isEdit ? t('taskForm.saveChanges') : t('taskForm.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
