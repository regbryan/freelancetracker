import type { ComponentProps } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, within, fireEvent } from '@testing-library/react'
import { I18nProvider } from '../lib/i18n'
import TimelineGantt, { type GanttProject, type GanttTask } from './TimelineGantt'
import { PX_PER_DAY, computeRange, diffDays } from '../lib/timelineMath'

const TODAY = '2026-09-01'

const projects: GanttProject[] = [
  { id: 'p1', name: 'ProSeries Marketing', status: 'active', start_date: '2026-09-01', end_date: '2026-10-31' },
  { id: 'p2', name: 'Undated Project', status: 'active', start_date: null, end_date: null },
]

const tasks: GanttTask[] = [
  { id: 't1', project_id: 'p1', title: 'Brand audit', status: 'in_progress', start_date: '2026-09-10', due_date: '2026-09-12' },
  { id: 't2', project_id: 'p1', title: 'Launch plan', status: 'todo', start_date: null, due_date: null },
  { id: 't3', project_id: 'p2', title: 'Kickoff', status: 'todo', start_date: null, due_date: '2026-09-20' },
]

type Props = Partial<ComponentProps<typeof TimelineGantt>>

function setup(over: Props = {}) {
  const onTaskDates = vi.fn().mockResolvedValue(undefined)
  const onTaskClick = vi.fn()
  const onScheduleTask = vi.fn().mockResolvedValue(undefined)
  render(
    <I18nProvider>
      <TimelineGantt
        projects={projects}
        tasks={tasks}
        zoom="month"
        editable={true}
        today={TODAY}
        onTaskDates={onTaskDates}
        onTaskClick={onTaskClick}
        onScheduleTask={onScheduleTask}
        {...over}
      />
    </I18nProvider>,
  )
  return { onTaskDates, onTaskClick, onScheduleTask }
}

describe('TimelineGantt render', () => {
  it('renders every project row, including undated ones', () => {
    setup()
    expect(screen.getByText('ProSeries Marketing')).toBeInTheDocument()
    expect(screen.getByText('Undated Project')).toBeInTheDocument()
  })

  it('renders one bar per dated task and positions it by day offset', () => {
    setup()
    const bar = screen.getByRole('button', { name: /Brand audit/ })
    const range = computeRange(['2026-09-01', '2026-10-31', '2026-09-10', '2026-09-12', '2026-09-20'], TODAY)
    const left = diffDays(range.start, '2026-09-10') * PX_PER_DAY.month
    expect(bar).toHaveStyle({ left: `${left}px`, width: `${3 * PX_PER_DAY.month}px` })
  })

  it('shows undated tasks in a Not scheduled tray instead of hiding them', () => {
    setup()
    const tray = screen.getByText('Not scheduled (1)').closest('[data-testid="tray"]') as HTMLElement
    expect(within(tray).getByRole('button', { name: 'Launch plan' })).toBeInTheDocument()
  })

  it('clicking a tray chip schedules the task at today for one week', async () => {
    const { onScheduleTask } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Launch plan' }))
    expect(onScheduleTask).toHaveBeenCalledWith('t2', { start_date: '2026-09-01', due_date: '2026-09-07' })
  })

  it('a task with only a due date renders as a one-day bar', () => {
    setup()
    const bar = screen.getByRole('button', { name: /Kickoff/ })
    expect(bar).toHaveStyle({ width: `${PX_PER_DAY.month}px` })
  })

  it('read-only mode renders no resize handles and ignores chip clicks', () => {
    const { onScheduleTask } = setup({ editable: false })
    expect(document.querySelectorAll('[data-edge]')).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: 'Launch plan' }))
    expect(onScheduleTask).not.toHaveBeenCalled()
  })

  it('week zoom draws day numbers and weekend shading', () => {
    setup({ zoom: 'week' })
    expect(document.querySelectorAll('[data-testid="weekend"]').length).toBeGreaterThan(0)
    expect(screen.getAllByText('1').length).toBeGreaterThan(0)
  })
})

describe('TimelineGantt drag', () => {
  const px = PX_PER_DAY.month

  function bar() {
    return screen.getByRole('button', { name: /Brand audit/ })
  }

  it('dragging a bar 3 days right saves both dates shifted by 3', async () => {
    const { onTaskDates } = setup()
    const el = bar()
    fireEvent.pointerDown(el, { clientX: 100, button: 0, pointerId: 1 })
    fireEvent.pointerMove(el, { clientX: 100 + 3 * px, pointerId: 1 })
    fireEvent.pointerUp(el, { clientX: 100 + 3 * px, pointerId: 1 })
    expect(onTaskDates).toHaveBeenCalledWith('t1', { start_date: '2026-09-13', due_date: '2026-09-15' })
  })

  it('dragging the end handle changes only the due date', () => {
    const { onTaskDates } = setup()
    const el = bar()
    const endHandle = el.querySelector('[data-edge="end"]')!
    fireEvent.pointerDown(endHandle, { clientX: 100, button: 0, pointerId: 1 })
    fireEvent.pointerMove(el, { clientX: 100 + 2 * px, pointerId: 1 })
    fireEvent.pointerUp(el, { clientX: 100 + 2 * px, pointerId: 1 })
    expect(onTaskDates).toHaveBeenCalledWith('t1', { start_date: '2026-09-10', due_date: '2026-09-14' })
  })

  it('dragging the start handle past the end clamps to a one-day bar', () => {
    const { onTaskDates } = setup()
    const el = bar()
    const startHandle = el.querySelector('[data-edge="start"]')!
    fireEvent.pointerDown(startHandle, { clientX: 100, button: 0, pointerId: 1 })
    fireEvent.pointerMove(el, { clientX: 100 + 10 * px, pointerId: 1 })
    fireEvent.pointerUp(el, { clientX: 100 + 10 * px, pointerId: 1 })
    expect(onTaskDates).toHaveBeenCalledWith('t1', { start_date: '2026-09-12', due_date: '2026-09-12' })
  })

  it('a movement under 3px is a click and opens the task instead of saving', () => {
    const { onTaskDates, onTaskClick } = setup()
    const el = bar()
    fireEvent.pointerDown(el, { clientX: 100, button: 0, pointerId: 1 })
    fireEvent.pointerMove(el, { clientX: 102, pointerId: 1 })
    fireEvent.pointerUp(el, { clientX: 102, pointerId: 1 })
    expect(onTaskDates).not.toHaveBeenCalled()
    expect(onTaskClick).toHaveBeenCalledWith('t1')
  })

  it('Escape during a drag cancels without saving and restores the position', () => {
    const { onTaskDates } = setup()
    const el = bar()
    const before = el.style.left
    fireEvent.pointerDown(el, { clientX: 100, button: 0, pointerId: 1 })
    fireEvent.pointerMove(el, { clientX: 100 + 5 * px, pointerId: 1 })
    fireEvent.keyDown(window, { key: 'Escape' })
    fireEvent.pointerUp(el, { clientX: 100 + 5 * px, pointerId: 1 })
    expect(onTaskDates).not.toHaveBeenCalled()
    expect(bar().style.left).toBe(before)
  })

  it('reverts to the original position when the save rejects', async () => {
    const onTaskDates = vi.fn().mockRejectedValue(new Error('RLS denied'))
    setup({ onTaskDates })
    const el = bar()
    const before = el.style.left
    fireEvent.pointerDown(el, { clientX: 100, button: 0, pointerId: 1 })
    fireEvent.pointerMove(el, { clientX: 100 + 3 * px, pointerId: 1 })
    fireEvent.pointerUp(el, { clientX: 100 + 3 * px, pointerId: 1 })
    expect(onTaskDates).toHaveBeenCalled()
    await screen.findByRole('button', { name: /Brand audit/ }) // flush microtasks
    await new Promise((r) => setTimeout(r, 0))
    expect(bar().style.left).toBe(before)
  })

  it('read-only mode never calls onTaskDates on drag', () => {
    const { onTaskDates } = setup({ editable: false })
    const el = bar()
    fireEvent.pointerDown(el, { clientX: 100, button: 0, pointerId: 1 })
    fireEvent.pointerMove(el, { clientX: 100 + 3 * px, pointerId: 1 })
    fireEvent.pointerUp(el, { clientX: 100 + 3 * px, pointerId: 1 })
    expect(onTaskDates).not.toHaveBeenCalled()
  })

  it('project bars only drag when canEditProjects is true', () => {
    const onProjectDates = vi.fn().mockResolvedValue(undefined)
    setup({ onProjectDates, canEditProjects: false })
    const el = screen.getByTitle(/ProSeries Marketing:/)
    fireEvent.pointerDown(el, { clientX: 100, button: 0, pointerId: 1 })
    fireEvent.pointerMove(el, { clientX: 100 + 3 * px, pointerId: 1 })
    fireEvent.pointerUp(el, { clientX: 100 + 3 * px, pointerId: 1 })
    expect(onProjectDates).not.toHaveBeenCalled()
  })

  it('project bars drag when canEditProjects is true', () => {
    const onProjectDates = vi.fn().mockResolvedValue(undefined)
    setup({ onProjectDates, canEditProjects: true })
    const el = screen.getByTitle(/ProSeries Marketing:/)
    fireEvent.pointerDown(el, { clientX: 100, button: 0, pointerId: 1 })
    fireEvent.pointerMove(el, { clientX: 100 + 3 * px, pointerId: 1 })
    fireEvent.pointerUp(el, { clientX: 100 + 3 * px, pointerId: 1 })
    expect(onProjectDates).toHaveBeenCalledWith('p1', { start_date: '2026-09-04', end_date: '2026-11-03' })
  })
})
