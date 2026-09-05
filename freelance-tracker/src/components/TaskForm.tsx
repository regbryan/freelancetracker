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
import { clampProgress } from '../lib/progress'

export type RecurrenceKind = 'none' | 'daily' | 'weekly' | 'monthly'

export interface TaskFormData {
  title: string
  description?: string
  status: 'todo' | 'in_progress' | 'done'
  priority: 'low' | 'medium' | 'high'
  startDate?: string
  dueDate?: string
  projectId?: string
  /** Present only when a `milestones` list was passed; null means "no milestone". */
  milestoneId?: string | null
  /** Percent complete, 0-100. Always sent; the field is always shown. */
  progress?: number
  /** Estimated hours, or null when the field is left empty. Always sent. */
  estimateHours?: number | null
  /** Present only when a `people` list was passed; '' means unassigned. */
  assignee?: string
  recurrence?: RecurrenceKind
  recurrenceEnd?: string
  /** 0 = Sunday … 6 = Saturday */
  recurrenceWeekday?: number
  /** 1 … 31 (clamped to last day of month if shorter) */
  recurrenceDayOfMonth?: number
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
    /** Current project — pre-populates the picker on edit so the user can move the task. */
    projectId?: string
    /** Current milestone — pre-selects the picker when a `milestones` list is passed. */
    milestoneId?: string | null
    progress?: number
    /** Current assignee — pre-selects the picker when a `people` list is passed. */
    assignee?: string
    estimateHours?: number | null
  } | null
  /** When provided, a project selector is shown so the user can pick or change project. */
  projects?: { id: string; name: string }[]
  /** When provided, a milestone selector is shown. The Timeline page passes the
   *  selected project's milestones; Tasks and ProjectDetail do not pass it at all. */
  milestones?: { id: string; name: string }[]
  /** When provided, the assignee becomes a picker of these plus "Unassigned".
   *  Without it the field is not shown at all and `assignee` is never sent, so a
   *  caller that knows nothing about people cannot blank out an existing one. */
  people?: { value: string; label: string }[]
  onSave: (data: TaskFormData) => Promise<void>
}

/** Hours are stored as NUMERIC(6,2) and never negative; nonsense becomes null. */
function clampEstimate(n: number): number | null {
  if (!Number.isFinite(n) || n < 0) return null
  return Math.round(n * 100) / 100
}

/** Radix rejects an empty SelectItem value, so "no milestone" needs a sentinel. */
const NO_MILESTONE = '__none__'
/** Same reason: "" is not a legal Radix item value, and unassigned is stored as "". */
const NO_ASSIGNEE = '__unassigned__'

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
  milestones,
  people,
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
  const [milestoneId, setMilestoneId] = useState<string>(NO_MILESTONE)
  const [progress, setProgress] = useState(0)
  const [estimateHours, setEstimateHours] = useState('')
  const [assignee, setAssignee] = useState<string>(NO_ASSIGNEE)
  const [recurrence, setRecurrence] = useState<RecurrenceKind>('none')
  const [recurrenceEnd, setRecurrenceEnd] = useState('')
  const [recurrenceWeekday, setRecurrenceWeekday] = useState<number>(1)
  const [recurrenceDayOfMonth, setRecurrenceDayOfMonth] = useState<number>(1)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setTitle(task?.title ?? '')
      setDescription(task?.description ?? '')
      setStatus((task?.status as TaskFormData['status']) ?? 'todo')
      setPriority((task?.priority as TaskFormData['priority']) ?? 'medium')
      setStartDate(task?.startDate ?? '')
      setDueDate(task?.dueDate ?? '')
      setProjectId(task?.projectId ?? '')
      setMilestoneId(task?.milestoneId ?? NO_MILESTONE)
      setProgress(clampProgress(task?.progress))
      setEstimateHours(
        task?.estimateHours === null || task?.estimateHours === undefined ? '' : String(task.estimateHours),
      )
      setAssignee(task?.assignee ? task.assignee : NO_ASSIGNEE)
      setRecurrence('none')
      setRecurrenceEnd('')
      const today = new Date()
      setRecurrenceWeekday(today.getDay())
      setRecurrenceDayOfMonth(today.getDate())
    }
  }, [open, task])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (projects && !projectId) return
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
        // Left out entirely when no milestone list was passed, so a caller that knows
        // nothing about milestones never sends milestone_id: null over an existing link.
        ...(milestones ? { milestoneId: milestoneId === NO_MILESTONE ? null : milestoneId } : {}),
        progress,
        // Blank is "nobody estimated this", which is not the same as zero hours.
        estimateHours: estimateHours.trim() === '' ? null : clampEstimate(Number(estimateHours)),
        // Same rule as the milestone: no picker shown, nothing sent.
        ...(people ? { assignee: assignee === NO_ASSIGNEE ? '' : assignee } : {}),
        recurrence: isEdit ? 'none' : recurrence,
        recurrenceEnd: !isEdit && recurrence !== 'none' ? (recurrenceEnd || undefined) : undefined,
        recurrenceWeekday: !isEdit && recurrence === 'weekly' ? recurrenceWeekday : undefined,
        recurrenceDayOfMonth: !isEdit && recurrence === 'monthly' ? recurrenceDayOfMonth : undefined,
      })
      onOpenChange(false)
    } catch {
      /* caller surfaces the message; keep the dialog open with the user's edits */
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
          {/* Project picker — visible on both create and edit so a task can be reassigned */}
          {projects && (
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

          {/* Milestone — only where the caller knows the project's milestones (Timeline) */}
          {milestones && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="task-milestone" className="text-[12px]">
                {t('taskForm.milestone')}
              </Label>
              <Select value={milestoneId} onValueChange={setMilestoneId}>
                <SelectTrigger id="task-milestone">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_MILESTONE}>{t('taskForm.noMilestone')}</SelectItem>
                  {milestones.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Assignee — only where the caller knows who is on the project (Timeline) */}
          {people && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="task-assignee" className="text-[12px]">
                {t('taskForm.assignee')}
              </Label>
              <Select value={assignee} onValueChange={setAssignee}>
                <SelectTrigger id="task-assignee">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_ASSIGNEE}>{t('taskForm.unassigned')}</SelectItem>
                  {people.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                  {/* Text typed before there was a picker stays selectable rather
                      than being silently reassigned by the next save. */}
                  {task?.assignee && !people.some((p) => p.value === task.assignee) && (
                    <SelectItem value={task.assignee}>{task.assignee}</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Percent complete */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="task-progress" className="text-[12px]">
              {t('taskForm.progress')}
            </Label>
            <div className="flex items-center gap-3">
              <input
                id="task-progress"
                type="range"
                min={0}
                max={100}
                step={5}
                value={progress}
                onChange={(e) => setProgress(clampProgress(Number(e.target.value)))}
                className="flex-1 accent-accent"
              />
              <Input
                aria-label={t('taskForm.progress')}
                type="number"
                min={0}
                max={100}
                step={5}
                value={progress}
                onChange={(e) => setProgress(clampProgress(Number(e.target.value)))}
                className="w-20"
              />
            </div>
          </div>

          {/* Estimated hours — read against the hours logged on the timeline */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="task-estimate" className="text-[12px]">
              {t('taskForm.estimateHours')}
            </Label>
            <Input
              id="task-estimate"
              type="number"
              min={0}
              step={0.25}
              value={estimateHours}
              onChange={(e) => setEstimateHours(e.target.value)}
              className="w-32"
            />
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

          {/* Recurrence — only when creating */}
          {!isEdit && (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="task-recurrence" className="text-[12px]">Repeats</Label>
                  <Select value={recurrence} onValueChange={(v) => setRecurrence(v as RecurrenceKind)}>
                    <SelectTrigger id="task-recurrence">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Does not repeat</SelectItem>
                      <SelectItem value="daily">Every day</SelectItem>
                      <SelectItem value="weekly">Every week</SelectItem>
                      <SelectItem value="monthly">Every month</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {recurrence !== 'none' && (
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="task-recurrence-end" className="text-[12px]">
                      Ends on <span className="text-negative">*</span>
                    </Label>
                    <Input
                      id="task-recurrence-end"
                      type="date"
                      value={recurrenceEnd}
                      min={dueDate || startDate || undefined}
                      onChange={(e) => setRecurrenceEnd(e.target.value)}
                      required
                    />
                  </div>
                )}
              </div>

              {recurrence === 'weekly' && (
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[12px]">On</Label>
                  <div className="flex gap-1">
                    {[
                      { v: 0, l: 'Sun' }, { v: 1, l: 'Mon' }, { v: 2, l: 'Tue' },
                      { v: 3, l: 'Wed' }, { v: 4, l: 'Thu' }, { v: 5, l: 'Fri' }, { v: 6, l: 'Sat' },
                    ].map(d => (
                      <button
                        key={d.v}
                        type="button"
                        onClick={() => setRecurrenceWeekday(d.v)}
                        className={`flex-1 h-8 rounded-[8px] text-[11px] font-semibold border transition-colors ${
                          recurrenceWeekday === d.v
                            ? 'bg-accent text-white border-accent'
                            : 'bg-input-bg text-text-secondary border-border hover:bg-accent/10'
                        }`}
                      >
                        {d.l}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {recurrence === 'monthly' && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="task-recurrence-dom" className="text-[12px]">Day of month</Label>
                  <Select
                    value={String(recurrenceDayOfMonth)}
                    onValueChange={(v) => setRecurrenceDayOfMonth(Number(v))}
                  >
                    <SelectTrigger id="task-recurrence-dom">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-[260px]">
                      {Array.from({ length: 31 }, (_, i) => i + 1).map(n => (
                        <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-[10px] text-text-muted">Shorter months clamp to the last day.</span>
                </div>
              )}
            </div>
          )}

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
            <Button type="submit" variant="gradient" disabled={saving || !title.trim() || (!!projects && !projectId) || (!isEdit && recurrence !== 'none' && !recurrenceEnd) || (!isEdit && recurrence === 'daily' && !(dueDate || startDate))}>
              {saving ? t('taskForm.saving') : isEdit ? t('taskForm.saveChanges') : t('taskForm.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
