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
  const ui = (next: Props = {}) => (
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
        {...next}
      />
    </I18nProvider>
  )
  const { rerender } = render(ui())
  return {
    onTaskDates,
    onTaskClick,
    onScheduleTask,
    /** Re-render with changed props, as a refetch or a colleague's edit would. */
    rerender: (next: Props = {}) => rerender(ui(next)),
  }
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
    setup({ editable: false })
    expect(document.querySelectorAll('[data-edge]')).toHaveLength(0)
    // The chip is not a disabled button, it is not a button at all.
    expect(screen.queryByRole('button', { name: 'Launch plan' })).toBeNull()
    expect(screen.getByText('Launch plan')).toBeInTheDocument()
  })

  it('week zoom draws day numbers and weekend shading', () => {
    setup({ zoom: 'week' })
    const weekends = document.querySelectorAll('[data-testid="weekend"]')
    expect(weekends.length).toBeGreaterThan(0)
    // bg-input-bg is white on a white surface, i.e. invisible shading.
    expect(weekends[0]).toHaveClass('bg-bg/70')
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
    fireEvent.pointerMove(el, { clientX: 100 + 3 * px, pointerId: 1, buttons: 1 })
    fireEvent.pointerUp(el, { clientX: 100 + 3 * px, pointerId: 1 })
    expect(onTaskDates).toHaveBeenCalledWith('t1', { start_date: '2026-09-13', due_date: '2026-09-15' })
  })

  it('dragging the end handle changes only the due date', () => {
    const { onTaskDates } = setup()
    const el = bar()
    const endHandle = el.querySelector('[data-edge="end"]')!
    fireEvent.pointerDown(endHandle, { clientX: 100, button: 0, pointerId: 1 })
    fireEvent.pointerMove(el, { clientX: 100 + 2 * px, pointerId: 1, buttons: 1 })
    fireEvent.pointerUp(el, { clientX: 100 + 2 * px, pointerId: 1 })
    expect(onTaskDates).toHaveBeenCalledWith('t1', { start_date: '2026-09-10', due_date: '2026-09-14' })
  })

  it('dragging the start handle past the end clamps to a one-day bar', () => {
    const { onTaskDates } = setup()
    const el = bar()
    const startHandle = el.querySelector('[data-edge="start"]')!
    fireEvent.pointerDown(startHandle, { clientX: 100, button: 0, pointerId: 1 })
    fireEvent.pointerMove(el, { clientX: 100 + 10 * px, pointerId: 1, buttons: 1 })
    fireEvent.pointerUp(el, { clientX: 100 + 10 * px, pointerId: 1 })
    expect(onTaskDates).toHaveBeenCalledWith('t1', { start_date: '2026-09-12', due_date: '2026-09-12' })
  })

  it('a movement under 3px is a click and opens the task instead of saving', () => {
    const { onTaskDates, onTaskClick } = setup()
    const el = bar()
    fireEvent.pointerDown(el, { clientX: 100, button: 0, pointerId: 1 })
    fireEvent.pointerMove(el, { clientX: 102, pointerId: 1, buttons: 1 })
    fireEvent.pointerUp(el, { clientX: 102, pointerId: 1 })
    expect(onTaskDates).not.toHaveBeenCalled()
    expect(onTaskClick).toHaveBeenCalledWith('t1')
  })

  it('Escape during a drag cancels without saving and restores the position', () => {
    const { onTaskDates } = setup()
    const el = bar()
    const before = el.style.left
    fireEvent.pointerDown(el, { clientX: 100, button: 0, pointerId: 1 })
    fireEvent.pointerMove(el, { clientX: 100 + 5 * px, pointerId: 1, buttons: 1 })
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
    fireEvent.pointerMove(el, { clientX: 100 + 3 * px, pointerId: 1, buttons: 1 })
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
    fireEvent.pointerMove(el, { clientX: 100 + 3 * px, pointerId: 1, buttons: 1 })
    fireEvent.pointerUp(el, { clientX: 100 + 3 * px, pointerId: 1 })
    expect(onTaskDates).not.toHaveBeenCalled()
  })

  it('project bars only drag when canEditProjects is true', () => {
    const onProjectDates = vi.fn().mockResolvedValue(undefined)
    setup({ onProjectDates, canEditProjects: false })
    const el = screen.getByTitle(/ProSeries Marketing:/)
    fireEvent.pointerDown(el, { clientX: 100, button: 0, pointerId: 1 })
    fireEvent.pointerMove(el, { clientX: 100 + 3 * px, pointerId: 1, buttons: 1 })
    fireEvent.pointerUp(el, { clientX: 100 + 3 * px, pointerId: 1 })
    expect(onProjectDates).not.toHaveBeenCalled()
  })

  it('project bars drag when canEditProjects is true', () => {
    const onProjectDates = vi.fn().mockResolvedValue(undefined)
    setup({ onProjectDates, canEditProjects: true })
    const el = screen.getByTitle(/ProSeries Marketing:/)
    fireEvent.pointerDown(el, { clientX: 100, button: 0, pointerId: 1 })
    fireEvent.pointerMove(el, { clientX: 100 + 3 * px, pointerId: 1, buttons: 1 })
    fireEvent.pointerUp(el, { clientX: 100 + 3 * px, pointerId: 1 })
    expect(onProjectDates).toHaveBeenCalledWith('p1', { start_date: '2026-09-04', end_date: '2026-11-03' })
  })

  it('a cancelled pointer does not keep dragging on later hover', () => {
    const { onTaskDates } = setup()
    const el = bar()
    const before = el.style.left
    fireEvent.pointerDown(el, { clientX: 100, button: 0, pointerId: 1 })
    fireEvent.pointerMove(el, { clientX: 100 + 2 * px, pointerId: 1, buttons: 1 })
    expect(bar().style.left).not.toBe(before)
    fireEvent.pointerCancel(el, { pointerId: 1 })
    expect(bar().style.left).toBe(before)
    // A later hover (no button held) must not resume the abandoned drag.
    fireEvent.pointerMove(el, { clientX: 100 + 9 * px, pointerId: 1 })
    fireEvent.pointerUp(el, { clientX: 100 + 9 * px, pointerId: 1 })
    expect(onTaskDates).not.toHaveBeenCalled()
    expect(bar().style.left).toBe(before)
  })

  it('two rapid drags on the same bar accumulate and only the failing one reverts', async () => {
    const { onTaskDates, rerender } = setup()
    const before = parseFloat(bar().style.left)
    fireEvent.pointerDown(bar(), { clientX: 100, button: 0, pointerId: 1 })
    fireEvent.pointerMove(bar(), { clientX: 100 + 3 * px, pointerId: 1, buttons: 1 })
    fireEvent.pointerUp(bar(), { clientX: 100 + 3 * px, pointerId: 1 })
    fireEvent.pointerDown(bar(), { clientX: 500, button: 0, pointerId: 2 })
    fireEvent.pointerMove(bar(), { clientX: 500 + 2 * px, pointerId: 2, buttons: 1 })
    fireEvent.pointerUp(bar(), { clientX: 500 + 2 * px, pointerId: 2 })
    // The second drag starts from the optimistic position, not from the stale props.
    expect(onTaskDates.mock.calls).toEqual([
      ['t1', { start_date: '2026-09-13', due_date: '2026-09-15' }],
      ['t1', { start_date: '2026-09-15', due_date: '2026-09-17' }],
    ])
    await screen.findByRole('button', { name: /Brand audit/ })
    await new Promise((r) => setTimeout(r, 0))
    expect(bar().style.left).toBe(`${before + 5 * px}px`)
    // A refetch returning identical data must not disturb the optimistic position.
    rerender({ tasks: [...tasks] })
    expect(bar().style.left).toBe(`${before + 5 * px}px`)
  })

  it('a successful save keeps the bar in place while props are unchanged', async () => {
    const { onTaskDates } = setup()
    const before = parseFloat(bar().style.left)
    fireEvent.pointerDown(bar(), { clientX: 100, button: 0, pointerId: 1 })
    fireEvent.pointerMove(bar(), { clientX: 100 + 3 * px, pointerId: 1, buttons: 1 })
    fireEvent.pointerUp(bar(), { clientX: 100 + 3 * px, pointerId: 1 })
    expect(onTaskDates).toHaveBeenCalled()
    await screen.findByRole('button', { name: /Brand audit/ })
    await new Promise((r) => setTimeout(r, 0))
    expect(bar().style.left).toBe(`${before + 3 * px}px`)
  })

  it('a second pointer cannot hijack an active drag', () => {
    const { onTaskDates, onTaskClick } = setup()
    const el = bar()
    const other = screen.getByRole('button', { name: /Kickoff/ })
    fireEvent.pointerDown(el, { clientX: 100, button: 0, pointerId: 1 })
    fireEvent.pointerMove(el, { clientX: 100 + 5 * px, pointerId: 1, buttons: 1 })
    fireEvent.pointerDown(other, { clientX: 300, button: 0, pointerId: 2 })
    fireEvent.pointerUp(other, { clientX: 300, pointerId: 2 })
    expect(onTaskClick).not.toHaveBeenCalledWith('t3')
    // The foreign pointer must not commit our drag either; only pointer 1 ends it.
    expect(onTaskDates).not.toHaveBeenCalled()
    fireEvent.pointerUp(el, { clientX: 100 + 5 * px, pointerId: 1 })
    expect(onTaskDates).toHaveBeenCalledWith('t1', { start_date: '2026-09-15', due_date: '2026-09-17' })
  })

  it('a move with no button held cancels the drag and the next drag works', () => {
    const { onTaskDates } = setup()
    const el = bar()
    const before = el.style.left
    fireEvent.pointerDown(el, { clientX: 100, button: 0, pointerId: 1 })
    // Button already released off-window: the drag must be abandoned, not merely ignored.
    fireEvent.pointerMove(el, { clientX: 100 + 2 * px, pointerId: 1, buttons: 0 })
    expect(bar().style.left).toBe(before)
    // The timeline must still be usable afterwards.
    const kickoff = screen.getByRole('button', { name: /Kickoff/ })
    fireEvent.pointerDown(kickoff, { clientX: 100, button: 0, pointerId: 2 })
    fireEvent.pointerMove(kickoff, { clientX: 100 + 3 * px, pointerId: 2, buttons: 1 })
    fireEvent.pointerUp(kickoff, { clientX: 100 + 3 * px, pointerId: 2 })
    expect(onTaskDates).toHaveBeenCalledWith('t3', { start_date: '2026-09-23', due_date: '2026-09-23' })
  })

  it('an incoming prop change replaces the optimistic position', async () => {
    const { onTaskDates, rerender } = setup()
    fireEvent.pointerDown(bar(), { clientX: 100, button: 0, pointerId: 1 })
    fireEvent.pointerMove(bar(), { clientX: 100 + 3 * px, pointerId: 1, buttons: 1 })
    fireEvent.pointerUp(bar(), { clientX: 100 + 3 * px, pointerId: 1 })
    expect(onTaskDates).toHaveBeenCalled()
    await screen.findByRole('button', { name: /Brand audit/ })
    await new Promise((r) => setTimeout(r, 0))
    // The server clamped the dates to something other than what we asked for.
    const moved: GanttTask[] = [
      { ...tasks[0], start_date: '2026-09-30', due_date: '2026-10-02' },
      tasks[1],
      tasks[2],
    ]
    rerender({ tasks: moved })
    const rng = computeRange(['2026-09-01', '2026-10-31', '2026-09-30', '2026-10-02', '2026-09-20'], TODAY)
    expect(bar().style.left).toBe(`${diffDays(rng.start, '2026-09-30') * px}px`)
  })

  it('an override is dropped when the task disappears from props', async () => {
    const { rerender } = setup()
    const before = bar().style.left
    fireEvent.pointerDown(bar(), { clientX: 100, button: 0, pointerId: 1 })
    fireEvent.pointerMove(bar(), { clientX: 100 + 3 * px, pointerId: 1, buttons: 1 })
    fireEvent.pointerUp(bar(), { clientX: 100 + 3 * px, pointerId: 1 })
    await screen.findByRole('button', { name: /Kickoff/ })
    await new Promise((r) => setTimeout(r, 0))
    rerender({ tasks: tasks.filter((tk) => tk.id !== 't1') })
    expect(screen.queryByRole('button', { name: /Brand audit/ })).toBeNull()
    // Coming back must not resurrect a stale optimistic position.
    rerender({ tasks })
    expect(bar().style.left).toBe(before)
  })

  it('the live range label appears above the bar only while dragging', () => {
    setup()
    const el = bar()
    expect(screen.queryByText('Sep 13 – Sep 15')).toBeNull()
    fireEvent.pointerDown(el, { clientX: 100, button: 0, pointerId: 1 })
    fireEvent.pointerMove(el, { clientX: 100 + 3 * px, pointerId: 1, buttons: 1 })
    const pill = screen.getByText('Sep 13 – Sep 15')
    expect(pill).toBeInTheDocument()
    // Must stay under the sticky label column (z-10), not over it.
    expect(pill).toHaveClass('z-[9]')
    // The bar's own text stays the title so it is still identifiable mid-drag.
    expect(el).toHaveTextContent('Brand audit')
    // A one-day bar is 12px wide, too narrow for a title.
    expect(screen.getByRole('button', { name: /Kickoff/ }).textContent).toBe('')
    fireEvent.pointerUp(el, { clientX: 100 + 3 * px, pointerId: 1 })
    expect(screen.queryByText('Sep 13 – Sep 15')).toBeNull()
  })
})
