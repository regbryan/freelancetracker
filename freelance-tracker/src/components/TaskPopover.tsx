import { useEffect, useRef, useState } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { Trash2 } from 'lucide-react'
import { useI18n } from '../lib/i18n'
import { clampProgress, formatHours, statusForProgress, type TaskStatus } from '../lib/progress'
import type { TaskFields, TaskPriority } from './TimelineGantt'

/** The task as the popover reads it. A superset of what a Gantt bar carries. */
export interface PopoverTask {
  id: string
  title: string
  description?: string | null
  status: string
  priority?: string | null
  assignee?: string | null
  progress?: number | null
  estimate_hours?: number | null
  start_date: string | null
  due_date: string | null
  milestone_id?: string | null
}

/** Enough of a DOMRect to float a panel against. */
export interface AnchorRect {
  left: number
  top: number
  width: number
  height: number
}

export interface TaskPopoverProps {
  task: PopoverTask
  /** Where the bar (or the click) is on screen, in viewport coordinates. */
  anchorRect: AnchorRect
  people: { value: string; label: string }[]
  milestones: { id: string; name: string }[]
  /** Sum of the time entries booked against this task. Read-only here. */
  loggedHours: number
  /** A freshly created task opens with its placeholder title selected. */
  focusTitle?: boolean
  /** Writes one or more fields. Rejections are shown inline, not thrown on. */
  onSave: (id: string, fields: TaskFields) => Promise<void>
  onDelete: (id: string) => Promise<void>
  /** The full dialog, for the things that do not belong in a floating panel. */
  onOpenFull: (id: string) => void
  onClose: () => void
}

const FIELD =
  'w-full h-8 rounded-md border border-border bg-surface px-2 text-[12px] text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/30'
const LABEL = 'block text-[11px] text-text-secondary mb-1'

/** The editable copy the panel holds while the round trips land. */
function toDraft(task: PopoverTask) {
  return {
    title: task.title,
    description: task.description ?? '',
    status: (task.status === 'done' ? 'done' : task.status === 'in_progress' ? 'in_progress' : 'todo') as TaskStatus,
    priority: (task.priority === 'high' ? 'high' : task.priority === 'low' ? 'low' : 'medium') as TaskPriority,
    assignee: task.assignee ?? '',
    progress: clampProgress(task.progress),
    estimate: task.estimate_hours === null || task.estimate_hours === undefined ? '' : String(task.estimate_hours),
    startDate: task.start_date ?? '',
    dueDate: task.due_date ?? '',
    milestoneId: task.milestone_id ?? '',
  }
}

/**
 * The editor for one bar, floated against that bar instead of covering the chart
 * with a modal (revision d: "I want to click the square and make my modifications
 * there"). Every control writes on change, or on blur where a keystroke is not an
 * edit yet; there is no Save. A rejected write says so on one line inside the
 * panel and leaves the value where the user put it, so nothing is lost silently.
 */
export default function TaskPopover({
  task,
  anchorRect,
  people,
  milestones,
  loggedHours,
  focusTitle = false,
  onSave,
  onDelete,
  onOpenFull,
  onClose,
}: TaskPopoverProps) {
  const { t } = useI18n()
  const titleRef = useRef<HTMLInputElement>(null)

  // Seeded per task: a save that comes back through props must not overwrite the
  // half-typed title next to it, but opening a different bar starts fresh.
  const [seedId, setSeedId] = useState(task.id)
  const [draft, setDraft] = useState(() => toDraft(task))
  if (seedId !== task.id) {
    setSeedId(task.id)
    setDraft(toDraft(task))
  }

  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!focusTitle) return
    titleRef.current?.focus()
    titleRef.current?.select()
  }, [focusTitle, task.id])

  function save(fields: TaskFields) {
    setError(null)
    void Promise.resolve(onSave(task.id, fields)).catch((err: unknown) => {
      setError(err instanceof Error ? err.message : String(err))
    })
  }

  function setProgress(raw: number) {
    const value = clampProgress(raw)
    setDraft((d) => ({ ...d, progress: value, status: statusForProgress(d.status, value) }))
    // Progress and status move together: finishing the bar finishes the task, and
    // pulling a finished one back reopens it.
    save({ progress: value, status: statusForProgress(draft.status, value) })
  }

  function setStatus(status: TaskStatus) {
    // The caller keeps progress in step with a status set to done; the panel only
    // has to stop showing 40% next to the word "Done" while that lands.
    setDraft((d) => ({ ...d, status, progress: status === 'done' ? 100 : d.progress }))
    save({ status })
  }

  function commitTitle() {
    const value = draft.title.trim()
    if (value === '' || value === task.title) return
    save({ title: value })
  }

  function commitEstimate() {
    const raw = draft.estimate.trim()
    const next = raw === '' ? null : Number(raw)
    if (next !== null && (!Number.isFinite(next) || next < 0)) return
    const current = task.estimate_hours ?? null
    if (next === current) return
    save({ estimate_hours: next })
  }

  function commitDescription() {
    const value = draft.description
    if (value === (task.description ?? '')) return
    save({ description: value === '' ? null : value })
  }

  async function remove() {
    if (!window.confirm(t('timeline.deleteTaskConfirm', { title: task.title }))) return
    try {
      await onDelete(task.id)
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <Popover.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      {/* An invisible stand-in for the bar: the chart scrolls inside an overflow
          container, so the panel is portaled out of it and pointed at these
          coordinates instead of being nested where it would be clipped. */}
      <Popover.Anchor asChild>
        <span
          aria-hidden="true"
          style={{
            position: 'fixed',
            left: anchorRect.left,
            top: anchorRect.top,
            width: Math.max(anchorRect.width, 1),
            height: Math.max(anchorRect.height, 1),
            pointerEvents: 'none',
          }}
        />
      </Popover.Anchor>
      <Popover.Portal>
        <Popover.Content
          data-testid="task-popover"
          role="dialog"
          aria-label={task.title}
          side="bottom"
          align="start"
          sideOffset={8}
          collisionPadding={12}
          onOpenAutoFocus={(e) => {
            if (!focusTitle) return
            e.preventDefault()
            titleRef.current?.focus()
            titleRef.current?.select()
          }}
          // Never taller than the gap Radix measured between the bar and the edge
          // of the window, so the panel is always whole: it scrolls itself rather
          // than running off the top of the screen.
          style={{ maxHeight: 'var(--radix-popper-available-height)' }}
          className="z-50 w-[360px] bg-surface border border-border rounded-md shadow-card flex flex-col"
        >
          {/* Only the fields scroll. Delete and the way out to the full editor are
              pinned, so a panel squeezed against the edge of the window never hides
              them behind a scrollbar nobody thinks to use. */}
          <div className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col gap-2.5">
          <div>
            <label className={LABEL} htmlFor="tp-title">
              {t('taskForm.title')}
            </label>
            <input
              id="tp-title"
              ref={titleRef}
              className={FIELD}
              value={draft.title}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
              onBlur={commitTitle}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={LABEL} htmlFor="tp-status">
                {t('taskForm.status')}
              </label>
              <select
                id="tp-status"
                className={FIELD}
                value={draft.status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
              >
                <option value="todo">{t('taskForm.statusTodo')}</option>
                <option value="in_progress">{t('taskForm.statusInProgress')}</option>
                <option value="done">{t('taskForm.statusDone')}</option>
              </select>
            </div>
            <div>
              <label className={LABEL} htmlFor="tp-priority">
                {t('taskForm.priority')}
              </label>
              <select
                id="tp-priority"
                className={FIELD}
                value={draft.priority}
                onChange={(e) => {
                  const priority = e.target.value as TaskPriority
                  setDraft((d) => ({ ...d, priority }))
                  save({ priority })
                }}
              >
                <option value="low">{t('taskForm.priorityLow')}</option>
                <option value="medium">{t('taskForm.priorityMedium')}</option>
                <option value="high">{t('taskForm.priorityHigh')}</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="min-w-0">
              <label className={LABEL} htmlFor="tp-assignee">
                {t('taskForm.assignee')}
              </label>
              <select
                id="tp-assignee"
                className={FIELD}
                value={draft.assignee}
                onChange={(e) => {
                  const assignee = e.target.value
                  setDraft((d) => ({ ...d, assignee }))
                  save({ assignee })
                }}
              >
                <option value="">{t('taskForm.unassigned')}</option>
                {people.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
                {/* Text somebody typed before there was a picker stays selectable
                    rather than silently reassigning the task on the next save. */}
                {draft.assignee !== '' && !people.some((p) => p.value === draft.assignee) && (
                  <option value={draft.assignee}>{draft.assignee}</option>
                )}
              </select>
            </div>
            <div className="min-w-0">
              <label className={LABEL} htmlFor="tp-milestone">
                {t('taskForm.milestone')}
              </label>
              <select
                id="tp-milestone"
                className={FIELD}
                value={draft.milestoneId}
                onChange={(e) => {
                  const milestoneId = e.target.value
                  setDraft((d) => ({ ...d, milestoneId }))
                  save({ milestone_id: milestoneId === '' ? null : milestoneId })
                }}
              >
                <option value="">{t('taskForm.noMilestone')}</option>
                {milestones.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={LABEL} htmlFor="tp-progress">
              {t('timeline.progress')}
            </label>
            <div className="flex items-center gap-2">
              <input
                id="tp-progress"
                type="range"
                min={0}
                max={100}
                step={5}
                value={draft.progress}
                className="flex-1 accent-accent"
                onChange={(e) => setProgress(Number(e.target.value))}
              />
              <input
                aria-label={t('timeline.progressPercent')}
                type="number"
                min={0}
                max={100}
                step={5}
                value={draft.progress}
                className={`${FIELD} w-16`}
                onChange={(e) => setProgress(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={LABEL} htmlFor="tp-estimate">
                {t('timeline.estimateHours')}
              </label>
              <input
                id="tp-estimate"
                type="number"
                min={0}
                step={0.25}
                className={FIELD}
                value={draft.estimate}
                onChange={(e) => setDraft((d) => ({ ...d, estimate: e.target.value }))}
                onBlur={commitEstimate}
              />
            </div>
            <div>
              <span className={LABEL} id="tp-logged-label">
                {t('timeline.loggedHours')}
              </span>
              {/* Read-only: hours are logged in the time tracker, never typed here. */}
              <output
                aria-labelledby="tp-logged-label"
                className="flex items-center h-8 px-2 text-[12px] text-text-primary tabular-nums"
              >
                {formatHours(loggedHours)}
              </output>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={LABEL} htmlFor="tp-start">
                {t('taskForm.startDate')}
              </label>
              <input
                id="tp-start"
                type="date"
                className={FIELD}
                value={draft.startDate}
                onChange={(e) => {
                  const startDate = e.target.value
                  setDraft((d) => ({ ...d, startDate }))
                  save({ start_date: startDate || null })
                }}
              />
            </div>
            <div>
              <label className={LABEL} htmlFor="tp-due">
                {t('taskForm.endDate')}
              </label>
              <input
                id="tp-due"
                type="date"
                className={FIELD}
                value={draft.dueDate}
                onChange={(e) => {
                  const dueDate = e.target.value
                  setDraft((d) => ({ ...d, dueDate }))
                  save({ due_date: dueDate || null })
                }}
              />
            </div>
          </div>

          <div>
            <label className={LABEL} htmlFor="tp-description">
              {t('taskForm.description')}
            </label>
            <textarea
              id="tp-description"
              rows={2}
              className="w-full rounded-md border border-border bg-surface px-2 py-1.5 text-[12px] text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/30 resize-none"
              placeholder={t('taskForm.descPh')}
              value={draft.description}
              onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
              onBlur={commitDescription}
            />
          </div>

          </div>

          {error && (
            <p role="alert" className="px-4 pb-1 text-[11px] text-negative">
              {error}
            </p>
          )}

          <div className="shrink-0 flex items-center justify-between px-3 py-2 border-t border-border">
            <button
              type="button"
              onClick={remove}
              className="inline-flex items-center gap-1 h-7 px-2 rounded-md text-[12px] text-negative hover:bg-negative/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
            >
              <Trash2 size={12} aria-hidden="true" />
              {t('timeline.deleteTask')}
            </button>
            <button
              type="button"
              onClick={() => onOpenFull(task.id)}
              className="h-7 px-2 rounded-md text-[12px] text-accent hover:bg-accent/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
            >
              {t('timeline.openFullEditor')}
            </button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
