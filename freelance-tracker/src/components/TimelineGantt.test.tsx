import type { ComponentProps } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, within, fireEvent, cleanup } from '@testing-library/react'
import { I18nProvider } from '../lib/i18n'
import TimelineGantt, { type GanttProject, type GanttTask, type GanttMilestone } from './TimelineGantt'
import { PX_PER_DAY, addDays, computeContentRange, diffDays } from '../lib/timelineMath'

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
    const range = computeContentRange(['2026-09-01', '2026-10-31', '2026-09-10', '2026-09-12', '2026-09-20'], TODAY)
    const left = diffDays(range.start, '2026-09-10') * PX_PER_DAY.month
    expect(bar).toHaveStyle({ left: `${left}px`, width: `${3 * PX_PER_DAY.month}px` })
  })

  it('starts the range a week before the earliest task when all the work is in the past', () => {
    const pastProjects: GanttProject[] = [
      { id: 'p1', name: 'Finished', status: 'completed', start_date: '2026-03-02', end_date: '2026-03-20' },
    ]
    const pastTasks: GanttTask[] = [
      { id: 't1', project_id: 'p1', title: 'Brand audit', status: 'done', start_date: '2026-03-05', due_date: '2026-03-07' },
    ]
    setup({ projects: pastProjects, tasks: pastTasks })
    // computeRange would have opened at today - 37 (2026-07-26) and pushed every bar
    // off the left of the first screen; the content range starts at 2026-03-02 - 7.
    const range = computeContentRange(['2026-03-02', '2026-03-20', '2026-03-05', '2026-03-07'], TODAY)
    expect(range.start).toBe('2026-02-23')
    const bar = screen.getByRole('button', { name: /Brand audit/ })
    expect(bar).toHaveStyle({ left: `${diffDays(range.start, '2026-03-05') * PX_PER_DAY.month}px` })
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

  it('a rejected tray schedule is caught, not left as an unhandled rejection', async () => {
    // The Timeline page re-throws after showing its banner, so the chip's own
    // promise must be swallowed here or Sentry double-reports the same failure.
    // `process` isn't in the app tsconfig's lib, so reach it through globalThis.
    const proc = (globalThis as unknown as {
      process: { on(e: string, f: () => void): void; off(e: string, f: () => void): void }
    }).process
    const unhandled = vi.fn()
    proc.on('unhandledRejection', unhandled)
    try {
      // A plain function, not vi.fn(): a Vitest spy attaches its own handler to
      // the promise it returns (to record settledResults), which would mark the
      // rejection handled and hide the very bug this test is about.
      let calls = 0
      const onScheduleTask = () => {
        calls += 1
        return Promise.reject(new Error('nope'))
      }
      setup({ onScheduleTask })
      expect(() => fireEvent.click(screen.getByRole('button', { name: 'Launch plan' }))).not.toThrow()
      expect(calls).toBe(1)
      // Let the rejection settle and any unhandled-rejection event fire.
      await new Promise((r) => setTimeout(r, 0))
      expect(unhandled).not.toHaveBeenCalled()
    } finally {
      proc.off('unhandledRejection', unhandled)
    }
  })

  it('a task with only a due date renders as a one-day bar, floored at the minimum grab width', () => {
    setup()
    const bar = screen.getByRole('button', { name: /Kickoff/ })
    // One day at Month zoom is 12px; editable bars are drawn at least 16px wide so
    // they can be hit. The drag maths still uses the true 12px width.
    expect(bar).toHaveStyle({ width: '16px' })
  })

  it('read-only bars are drawn at their true width, with no minimum', () => {
    setup({ editable: false, onTaskClick: undefined })
    expect(screen.getByTitle(/^Kickoff:/)).toHaveStyle({ width: `${PX_PER_DAY.month}px` })
  })

  it('read-only mode renders no resize handles and ignores chip clicks', () => {
    // No onTaskClick either: this is the shape the read-only portal renders in.
    setup({ editable: false, onTaskClick: undefined })
    expect(document.querySelectorAll('[data-edge]')).toHaveLength(0)
    // The chip is not a disabled button, it is not a button at all.
    expect(screen.queryByRole('button', { name: 'Launch plan' })).toBeNull()
    expect(screen.getByText('Launch plan')).toBeInTheDocument()
    // The task bar itself is not a button either when there is nothing to activate.
    expect(screen.queryByRole('button', { name: /Brand audit/ })).toBeNull()
  })

  it('week zoom draws day numbers and weekend shading', () => {
    setup({ zoom: 'week' })
    const weekends = document.querySelectorAll('[data-testid="weekend"]')
    expect(weekends.length).toBeGreaterThan(0)
    // A tint of the ink, not of the page: white-on-white would be invisible shading.
    expect(weekends[0]).toHaveClass('bg-text-primary/[0.04]')
    expect(screen.getAllByText('1').length).toBeGreaterThan(0)
  })
})

describe('TimelineGantt label column and bar labels', () => {
  const people = [
    { value: 'me', label: 'Reggie Bryant' },
    { value: 'courtney@example.com', label: 'Courtney' },
  ]

  const listTasks: GanttTask[] = [
    {
      id: 'l1',
      project_id: 'p1',
      title: 'Brand audit',
      status: 'in_progress',
      start_date: '2026-09-10',
      due_date: '2026-09-12',
      progress: 60,
      assignee: 'me',
      description: 'Read the last two decks',
      priority: 'high',
      estimate_hours: 8,
    },
    {
      id: 'l2',
      project_id: 'p1',
      title: 'Launch plan',
      status: 'todo',
      start_date: '2026-09-14',
      due_date: '2026-09-16',
      progress: 0,
      assignee: '',
    },
  ]

  function setupList(over: Props = {}) {
    const onTaskClick = vi.fn()
    render(
      <I18nProvider>
        <TimelineGantt
          projects={[projects[0]]}
          tasks={listTasks}
          zoom="month"
          editable={true}
          today={TODAY}
          people={people}
          hoursByTask={{ l1: 5 }}
          onTaskDates={vi.fn().mockResolvedValue(undefined)}
          onTaskClick={onTaskClick}
          {...over}
        />
      </I18nProvider>,
    )
    return { onTaskClick }
  }

  /** The list row a task's bar belongs to. */
  const rowOf = (title: string) =>
    screen.getByRole('button', { name: new RegExp(`^${title}:`) }).closest('.gantt-row') as HTMLElement

  it('the label column is a name and two facts, not a spreadsheet', () => {
    setupList()
    // Revision (d) dropped the six columns; none of their headings survive.
    for (const gone of ['#', 'Task', 'Assignee', 'Start', 'End']) {
      expect(screen.queryByText(gone)).toBeNull()
    }
    // 320px by default, narrow enough that the chart is the page.
    const cell = rowOf('Brand audit').firstElementChild as HTMLElement
    expect(cell).toHaveStyle({ width: '320px' })
  })

  it('a task row prints its percentage and the assignee initials under the name', () => {
    setupList()
    expect(within(rowOf('Brand audit')).getByTestId('sub-line')).toHaveTextContent('60% · RB')
    // Nobody on it: no initials, and no stray separator where they would be.
    expect(within(rowOf('Launch plan')).getByTestId('sub-line').textContent).toBe('0%')
  })

  it('the label beside the bar is the name plus an initials circle titled with the full name', () => {
    setupList()
    const bar = screen.getByRole('button', { name: /^Brand audit:/ })
    const label = within(rowOf('Brand audit')).getByTestId('bar-label')
    expect(within(label).getByText('Brand audit')).toBeInTheDocument()
    const chip = within(label).getByTestId('assignee-initials')
    expect(chip).toHaveTextContent('RB')
    expect(chip).toHaveAttribute('title', 'Reggie Bryant')
    // Just past the bar's right edge, so a narrow bar never truncates its own name.
    const left = parseFloat(bar.style.left)
    const width = parseFloat(bar.style.width)
    expect(label).toHaveStyle({ left: `${left + width + 8}px` })
    // Nothing inside the bar but the fill.
    expect(bar.textContent).toBe('')
    expect(within(bar).getByTestId('task-fill')).toHaveStyle({ width: '60%' })
  })

  it('an unassigned task gets no initials circle', () => {
    setupList()
    expect(within(rowOf('Launch plan')).queryByTestId('assignee-initials')).toBeNull()
  })

  it('the project row rolls up the count, the percentage and the hours', () => {
    setupList()
    const projectRow = screen.getByTitle(/^ProSeries Marketing:/).closest('.gantt-row') as HTMLElement
    const sub = within(projectRow).getByTestId('sub-line')
    expect(sub).toHaveTextContent('2 tasks')
    expect(sub).toHaveTextContent('30%')
    // 5 logged against an 8-hour estimate; the untouched task has no estimate.
    expect(sub).toHaveTextContent('5/8 h')
  })

  it('a row with no estimate anywhere says nothing about hours', () => {
    setupList({ tasks: listTasks.map((tk) => ({ ...tk, estimate_hours: null })) })
    const projectRow = screen.getByTitle(/^ProSeries Marketing:/).closest('.gantt-row') as HTMLElement
    expect(within(projectRow).getByTestId('sub-line').textContent).not.toContain('h')
  })

  it('clicking a bar hands the caller the bar and its rect', () => {
    const { onTaskClick } = setupList()
    const bar = screen.getByRole('button', { name: /^Brand audit:/ })
    fireEvent.pointerDown(bar, { clientX: 100, button: 0, pointerId: 1 })
    fireEvent.pointerUp(bar, { clientX: 101, pointerId: 1 })
    expect(onTaskClick).toHaveBeenCalledTimes(1)
    const [id, rect] = onTaskClick.mock.calls[0]
    expect(id).toBe('l1')
    expect(rect).toEqual(expect.objectContaining({ left: expect.any(Number), top: expect.any(Number) }))
  })

  it('there is no split handle to drag any more', () => {
    setupList()
    expect(screen.queryByTestId('list-resize')).toBeNull()
  })

  it('labelWidth still sets the column width', () => {
    setupList({ labelWidth: 240 })
    const cell = rowOf('Brand audit').firstElementChild as HTMLElement
    expect(cell).toHaveStyle({ width: '240px' })
  })
})

describe('TimelineGantt creating tasks on the timeline', () => {
  const px = PX_PER_DAY.month

  const cProjects: GanttProject[] = [
    { id: 'cp', name: 'Create Project', status: 'active', start_date: '2026-09-01', end_date: '2026-09-30' },
  ]
  const cMilestones: GanttMilestone[] = [
    { id: 'm1', project_id: 'cp', name: 'Discovery', start_date: '2026-09-03', end_date: '2026-09-10', sort_order: 0 },
  ]
  const cTasks: GanttTask[] = [
    { id: 'x1', project_id: 'cp', milestone_id: 'm1', title: 'Kickoff', status: 'todo', start_date: '2026-09-04', due_date: '2026-09-05' },
  ]
  const cRange = computeContentRange(
    ['2026-09-01', '2026-09-30', '2026-09-03', '2026-09-10', '2026-09-04', '2026-09-05'],
    TODAY,
  )

  function setupCreate(over: Props = {}) {
    const onCreateTask = vi.fn()
    render(
      <I18nProvider>
        <TimelineGantt
          projects={cProjects}
          tasks={cTasks}
          milestones={cMilestones}
          zoom="month"
          editable={true}
          today={TODAY}
          onCreateTask={onCreateTask}
          onTaskClick={vi.fn()}
          onMilestoneClick={vi.fn()}
          onTaskDates={vi.fn().mockResolvedValue(undefined)}
          {...over}
        />
      </I18nProvider>,
    )
    return { onCreateTask }
  }

  const milestoneRow = () => document.querySelector('[data-milestone-id="m1"]') as HTMLElement

  it('the + on a milestone row asks for an undated task under it', () => {
    const { onCreateTask } = setupCreate()
    fireEvent.click(within(milestoneRow()).getByRole('button', { name: 'Add task' }))
    expect(onCreateTask).toHaveBeenCalledWith(
      { milestone_id: 'm1', start_date: null },
      expect.objectContaining({ left: expect.any(Number) }),
    )
  })

  it('the + on the project row asks for a task with no milestone', () => {
    const { onCreateTask } = setupCreate()
    const projectRow = screen.getByTitle(/^Create Project:/).closest('.gantt-row') as HTMLElement
    fireEvent.click(within(projectRow).getByRole('button', { name: 'Add task' }))
    expect(onCreateTask).toHaveBeenCalledWith(
      { milestone_id: null, start_date: null },
      expect.objectContaining({ left: expect.any(Number) }),
    )
  })

  it('clicking empty track in a milestone row plants a task on that day', () => {
    const { onCreateTask } = setupCreate()
    const track = within(milestoneRow()).getByTestId('milestone-track')
    // jsdom measures every element at the origin, so clientX is the offset in px.
    fireEvent.click(track, { clientX: 3 * px, clientY: 40 })
    expect(onCreateTask).toHaveBeenCalledWith(
      { milestone_id: 'm1', start_date: addDays(cRange.start, 3) },
      expect.objectContaining({ left: 3 * px }),
    )
  })

  it('a click that lands on a bar belongs to the bar, not to the track', () => {
    const { onCreateTask } = setupCreate()
    fireEvent.click(screen.getByTitle(/^Discovery:/), { clientX: 20, clientY: 40 })
    expect(onCreateTask).not.toHaveBeenCalled()
  })

  it('read-only mode offers no + and ignores clicks on the track', () => {
    const { onCreateTask } = setupCreate({
      editable: false,
      onTaskClick: undefined,
      onMilestoneClick: undefined,
    })
    expect(screen.queryByRole('button', { name: 'Add task' })).toBeNull()
    fireEvent.click(within(milestoneRow()).getByTestId('milestone-track'), { clientX: 3 * px, clientY: 40 })
    expect(onCreateTask).not.toHaveBeenCalled()
  })

  it('no + at all when the caller cannot create tasks', () => {
    setupCreate({ onCreateTask: undefined })
    expect(screen.queryByRole('button', { name: 'Add task' })).toBeNull()
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
    expect(onTaskClick).toHaveBeenCalledWith('t1', expect.objectContaining({ left: expect.any(Number) }))
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
    // No onTaskClick either, so the bar renders as a non-interactive role="img", not a button.
    const { onTaskDates } = setup({ editable: false, onTaskClick: undefined })
    const el = screen.getByTitle(/^Brand audit:/)
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
    expect(onTaskClick).not.toHaveBeenCalled()
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
    const rng = computeContentRange(['2026-09-01', '2026-10-31', '2026-09-30', '2026-10-02', '2026-09-20'], TODAY)
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
    // Must stay under the sticky list column (z-10), not over it.
    expect(pill).toHaveClass('z-[9]')
    // Nothing is drawn inside a bar but its progress fill; the title is printed
    // beside it, where it is still readable mid-drag and at any bar width.
    expect(el.textContent).toBe('')
    expect(screen.getByRole('button', { name: /Kickoff/ }).textContent).toBe('')
    const row = el.closest('.gantt-row') as HTMLElement
    expect(within(row).getByTestId('bar-label')).toHaveTextContent('Brand audit')
    fireEvent.pointerUp(el, { clientX: 100 + 3 * px, pointerId: 1 })
    expect(screen.queryByText('Sep 13 – Sep 15')).toBeNull()
  })
})

describe('TimelineGantt milestones', () => {
  const px = PX_PER_DAY.month

  const mProjects: GanttProject[] = [
    { id: 'mp', name: 'Milestone Project', status: 'active', start_date: '2026-09-01', end_date: '2026-09-30' },
  ]

  // M1 is anchored by its own dates; M2 has none and must borrow its tasks' extent.
  const mMilestones: GanttMilestone[] = [
    { id: 'm1', project_id: 'mp', name: 'Discovery', start_date: '2026-09-03', end_date: '2026-09-10', sort_order: 0 },
    { id: 'm2', project_id: 'mp', name: 'Build', start_date: null, end_date: null, sort_order: 1 },
  ]

  const mTasks: GanttTask[] = [
    { id: 'a1', project_id: 'mp', milestone_id: 'm1', title: 'Kickoff deck', status: 'done', start_date: '2026-09-03', due_date: '2026-09-04' },
    { id: 'a2', project_id: 'mp', milestone_id: 'm1', title: 'Stakeholder audit', status: 'in_progress', start_date: '2026-09-05', due_date: '2026-09-06' },
    { id: 'a3', project_id: 'mp', milestone_id: 'm1', title: 'Findings memo', status: 'todo', start_date: '2026-09-07', due_date: '2026-09-08' },
    { id: 'b1', project_id: 'mp', milestone_id: 'm2', title: 'Draft pages', status: 'todo', start_date: '2026-09-12', due_date: '2026-09-14' },
    { id: 'b2', project_id: 'mp', milestone_id: 'm2', title: 'Review pass', status: 'todo', start_date: '2026-09-15', due_date: '2026-09-15' },
    { id: 'b3', project_id: 'mp', milestone_id: 'm2', title: 'Someday polish', status: 'todo', start_date: null, due_date: null },
    { id: 'u1', project_id: 'mp', milestone_id: null, title: 'Loose end', status: 'todo', start_date: '2026-09-20', due_date: '2026-09-21' },
  ]

  const mRange = computeContentRange(
    ['2026-09-01', '2026-09-30', '2026-09-03', '2026-09-10', ...mTasks.flatMap((t) => [t.start_date, t.due_date])],
    TODAY,
  )

  function setupMilestones(over: Props = {}) {
    const onMilestoneDates = vi.fn().mockResolvedValue(undefined)
    const onMilestoneClick = vi.fn()
    const onToggleMilestone = vi.fn()
    render(
      <I18nProvider>
        <TimelineGantt
          projects={mProjects}
          tasks={mTasks}
          milestones={mMilestones}
          zoom="month"
          editable={true}
          today={TODAY}
          onTaskDates={vi.fn().mockResolvedValue(undefined)}
          onTaskClick={vi.fn()}
          onMilestoneDates={onMilestoneDates}
          onMilestoneClick={onMilestoneClick}
          {...over}
        />
      </I18nProvider>,
    )
    return { onMilestoneDates, onMilestoneClick, onToggleMilestone }
  }

  const row = (id: string) => document.querySelector(`[data-milestone-id="${id}"]`) as HTMLElement

  it('is collapsed by default: milestone rows show, their task bars do not', () => {
    setupMilestones()
    expect(screen.getByRole('button', { name: 'Discovery' })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('button', { name: 'Build' })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('button', { name: /Kickoff deck/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Draft pages/ })).toBeNull()
    // The undated task of a collapsed milestone stays hidden with the rest of it.
    expect(screen.queryByRole('button', { name: 'Someday polish' })).toBeNull()
  })

  it('shows a done/total count on the milestone row', () => {
    setupMilestones()
    expect(within(row('m1')).getAllByText('1/3').length).toBeGreaterThan(0)
    expect(within(row('m2')).getAllByText('0/3').length).toBeGreaterThan(0)
  })

  it('the progress fill is the percentage the row prints, not the done count', () => {
    // Revision (c): the fill and the label are the same number. These fixtures carry
    // no progress at all, so both are 0 even though m1 has one task marked done.
    setupMilestones()
    expect(within(row('m1')).getByTestId('milestone-fill')).toHaveStyle({ width: '0.0%' })
    expect(within(row('m2')).getByTestId('milestone-fill')).toHaveStyle({ width: '0.0%' })
    const graded = mTasks.map((tk) => (tk.milestone_id === 'm1' ? { ...tk, progress: 60 } : tk))
    cleanup()
    setupMilestones({ tasks: graded })
    expect(within(row('m1')).getByTestId('milestone-fill')).toHaveStyle({ width: '60.0%' })
  })

  it('expanding a milestone reveals its tasks nested a level deeper', () => {
    setupMilestones()
    const toggle = screen.getByRole('button', { name: 'Discovery' })
    fireEvent.click(toggle)
    expect(screen.getByRole('button', { name: 'Discovery' })).toHaveAttribute('aria-expanded', 'true')
    for (const title of ['Kickoff deck', 'Stakeholder audit', 'Findings memo']) {
      expect(screen.getByRole('button', { name: new RegExp(title) })).toBeInTheDocument()
    }
    // Two levels of indent, against pl-8 for a task hanging straight off a project.
    const taskRow = screen.getByRole('button', { name: /Kickoff deck/ }).closest('.gantt-row') as HTMLElement
    expect(taskRow.querySelector('.pl-12')).not.toBeNull()
    // Collapsing again puts them away.
    fireEvent.click(screen.getByRole('button', { name: 'Discovery' }))
    expect(screen.queryByRole('button', { name: /Kickoff deck/ })).toBeNull()
  })

  it("an expanded milestone's undated tasks get their own indented tray", () => {
    setupMilestones()
    fireEvent.click(screen.getByRole('button', { name: 'Build' }))
    const tray = screen.getByText('Not scheduled (1)').closest('[data-testid="tray"]') as HTMLElement
    expect(within(tray).getByRole('button', { name: 'Someday polish' })).toBeInTheDocument()
    expect(tray.querySelector('.pl-12')).not.toBeNull()
  })

  it('controlled mode delegates the toggle and never expands itself', () => {
    const onToggleMilestone = vi.fn()
    setupMilestones({ expandedMilestoneIds: new Set<string>(), onToggleMilestone })
    fireEvent.click(screen.getByRole('button', { name: 'Discovery' }))
    expect(onToggleMilestone).toHaveBeenCalledWith('m1')
    expect(screen.getByRole('button', { name: 'Discovery' })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('button', { name: /Kickoff deck/ })).toBeNull()
  })

  it('controlled mode renders the milestones the page says are open', () => {
    setupMilestones({ expandedMilestoneIds: new Set(['m1']), onToggleMilestone: vi.fn() })
    expect(screen.getByRole('button', { name: 'Discovery' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: /Kickoff deck/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Draft pages/ })).toBeNull()
  })

  it("a dateless milestone spans its tasks and offers no handles to drag", () => {
    const { onMilestoneDates } = setupMilestones()
    const bar = screen.getByTitle(/^Build:/)
    expect(bar).toHaveStyle({
      left: `${diffDays(mRange.start, '2026-09-12') * px}px`,
      width: `${4 * px}px`,
    })
    expect(bar.title).toContain('Dates follow its tasks')
    expect(row('m2').querySelectorAll('[data-edge]')).toHaveLength(0)
    fireEvent.pointerDown(bar, { clientX: 100, button: 0, pointerId: 1 })
    fireEvent.pointerMove(bar, { clientX: 100 + 3 * px, pointerId: 1, buttons: 1 })
    fireEvent.pointerUp(bar, { clientX: 100 + 3 * px, pointerId: 1 })
    expect(onMilestoneDates).not.toHaveBeenCalled()
  })

  it('a dated milestone drags like a project bar', () => {
    const { onMilestoneDates } = setupMilestones()
    const bar = screen.getByTitle(/^Discovery:/)
    expect(row('m1').querySelectorAll('[data-edge]')).toHaveLength(2)
    fireEvent.pointerDown(bar, { clientX: 100, button: 0, pointerId: 1 })
    fireEvent.pointerMove(bar, { clientX: 100 + 2 * px, pointerId: 1, buttons: 1 })
    fireEvent.pointerUp(bar, { clientX: 100 + 2 * px, pointerId: 1 })
    expect(onMilestoneDates).toHaveBeenCalledWith('m1', { start_date: '2026-09-05', end_date: '2026-09-12' })
  })

  it('a click without a drag opens the milestone', () => {
    const { onMilestoneClick, onMilestoneDates } = setupMilestones()
    const bar = screen.getByTitle(/^Discovery:/)
    fireEvent.pointerDown(bar, { clientX: 100, button: 0, pointerId: 1 })
    fireEvent.pointerMove(bar, { clientX: 102, pointerId: 1, buttons: 1 })
    fireEvent.pointerUp(bar, { clientX: 102, pointerId: 1 })
    expect(onMilestoneDates).not.toHaveBeenCalled()
    expect(onMilestoneClick).toHaveBeenCalledWith('m1')
  })

  it('tasks with no milestone sit under an Unassigned group', () => {
    setupMilestones()
    // Scoped: "Unassigned" is also what an empty assignee column says.
    expect(within(screen.getByTestId('unassigned-row')).getByText('Unassigned')).toBeInTheDocument()
    const bar = screen.getByRole('button', { name: /Loose end/ })
    expect(bar).toBeInTheDocument()
    expect((bar.closest('.gantt-row') as HTMLElement).querySelector('.pl-12')).not.toBeNull()
  })

  it('Overview draws one diamond per dated milestone on the project bar', () => {
    render(
      <I18nProvider>
        <TimelineGantt
          projects={mProjects}
          tasks={[]}
          mode="overview"
          milestones={[
            mMilestones[0],
            { id: 'm3', project_id: 'mp', name: 'Launch', start_date: null, end_date: '2026-09-25', sort_order: 2 },
            // No dates at either end: nothing to pin a diamond to, so it is skipped.
            mMilestones[1],
          ]}
          zoom="month"
          editable={true}
          today={TODAY}
        />
      </I18nProvider>,
    )
    const diamonds = screen.getAllByTestId('milestone-diamond')
    expect(diamonds).toHaveLength(2)
    expect(diamonds[0].title).toContain('Discovery')
    expect(diamonds[1].title).toContain('Launch')
    // Pinned at the milestone's end date, and no milestone rows in this mode.
    const overviewRange = computeContentRange(['2026-09-01', '2026-09-30', '2026-09-03', '2026-09-10', '2026-09-25'], TODAY)
    expect(diamonds[0]).toHaveStyle({ left: `${diffDays(overviewRange.start, '2026-09-10') * px}px` })
    expect(document.querySelectorAll('[data-testid="milestone-row"]')).toHaveLength(0)
  })

  it('project mode keeps milestone rows when every task has been filtered away', () => {
    // The old rule inferred Overview from an empty task list; a project whose tasks are
    // all done and hidden is still a project view, so the mode is explicit now.
    setupMilestones({ tasks: [] })
    expect(document.querySelectorAll('[data-testid="milestone-row"]')).toHaveLength(2)
    expect(screen.queryByTestId('milestone-diamond')).toBeNull()
  })

  it('overview mode draws diamonds and no milestone rows', () => {
    setupMilestones({ mode: 'overview', tasks: [] })
    expect(document.querySelectorAll('[data-testid="milestone-row"]')).toHaveLength(0)
    // m2 has no dates at either end, so only m1 gets a diamond.
    expect(screen.getAllByTestId('milestone-diamond')).toHaveLength(1)
  })

  it('hideDone drops done task rows but still counts them towards the milestone', () => {
    setupMilestones({ hideDone: true, expandedMilestoneIds: new Set(['m1']), onToggleMilestone: vi.fn() })
    expect(screen.queryByRole('button', { name: /Kickoff deck/ })).toBeNull()
    expect(screen.getByRole('button', { name: /Stakeholder audit/ })).toBeInTheDocument()
    expect(within(row('m1')).getAllByText('1/3').length).toBeGreaterThan(0)
  })

  it("the milestone's percent is the mean of all its tasks, hidden done ones included", () => {
    const graded: GanttTask[] = [
      { id: 'g1', project_id: 'mp', milestone_id: 'm1', title: 'Zero', status: 'todo', start_date: '2026-09-03', due_date: '2026-09-04', progress: 0 },
      { id: 'g2', project_id: 'mp', milestone_id: 'm1', title: 'Half', status: 'in_progress', start_date: '2026-09-05', due_date: '2026-09-06', progress: 50 },
      { id: 'g3', project_id: 'mp', milestone_id: 'm1', title: 'Finished', status: 'done', start_date: '2026-09-07', due_date: '2026-09-08', progress: 100 },
    ]
    setupMilestones({ tasks: graded, milestones: [mMilestones[0]], hideDone: true })
    // The done task has no row, but 0 + 50 + 100 over three tasks is still 50%.
    expect(screen.queryByRole('button', { name: /^Finished:/ })).toBeNull()
    expect(within(row('m1')).getByText('50%')).toBeInTheDocument()
    expect(within(row('m1')).getByTestId('bar-label')).toHaveTextContent('Discovery · 50%')
  })

  it('a milestone whose tasks are all done and hidden shows a full bar at n/n', () => {
    const allDone: GanttTask[] = [
      { id: 'd1', project_id: 'mp', milestone_id: 'm1', title: 'Shipped', status: 'done', start_date: '2026-09-03', due_date: '2026-09-04', progress: 100 },
      { id: 'd2', project_id: 'mp', milestone_id: 'm1', title: 'Also shipped', status: 'done', start_date: '2026-09-05', due_date: '2026-09-06', progress: 100 },
    ]
    setupMilestones({
      tasks: allDone,
      milestones: [mMilestones[0]],
      hideDone: true,
      expandedMilestoneIds: new Set(['m1']),
      onToggleMilestone: vi.fn(),
    })
    expect(screen.queryByRole('button', { name: /Shipped/ })).toBeNull()
    expect(within(row('m1')).getAllByText('2/2').length).toBeGreaterThan(0)
    // Both rows are hidden and both are at 100%: the bar still reads as finished.
    expect(within(row('m1')).getByTestId('milestone-fill')).toHaveStyle({ width: '100.0%' })
  })

  it('a dateless milestone still spans tasks that hideDone has hidden', () => {
    setupMilestones({
      hideDone: true,
      tasks: mTasks.map((tk) => (tk.milestone_id === 'm2' ? { ...tk, status: 'done' } : tk)),
    })
    const bar = screen.getByTitle(/^Build:/)
    expect(bar).toHaveStyle({
      left: `${diffDays(mRange.start, '2026-09-12') * px}px`,
      width: `${4 * px}px`,
    })
  })

  it('read-only milestones still collapse and expand', () => {
    setupMilestones({ editable: false, onTaskClick: undefined, onMilestoneClick: undefined, onMilestoneDates: undefined })
    expect(document.querySelectorAll('[data-edge]')).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: 'Discovery' }))
    expect(screen.getByTitle(/^Kickoff deck:/)).toBeInTheDocument()
  })

  it('a milestone with no dates and no dated tasks still gets something to click', () => {
    // The bug this covers: no bar meant no route to the edit dialog at all, so a
    // milestone created without dates could never be given any (or deleted).
    const { onMilestoneClick } = setupMilestones({ milestones: [mMilestones[1]], tasks: [] })
    const placeholder = screen.getByTestId('milestone-placeholder')
    expect(placeholder.tagName).toBe('BUTTON')
    const bare = computeContentRange(['2026-09-01', '2026-09-30'], TODAY)
    expect(placeholder).toHaveStyle({ left: `${diffDays(bare.start, TODAY) * px}px`, width: `${px}px` })
    expect(placeholder.title).toBe('No dates yet. Click to set them.')
    // Nothing to drag: there is no range yet to move or resize.
    expect(row('m2').querySelectorAll('[data-edge]')).toHaveLength(0)
    fireEvent.click(placeholder)
    expect(onMilestoneClick).toHaveBeenCalledWith('m2')
  })

  it('every milestone label carries a pencil that opens the dialog', () => {
    const { onMilestoneClick } = setupMilestones()
    expect(screen.getAllByRole('button', { name: 'Edit milestone' })).toHaveLength(2)
    fireEvent.click(within(row('m2')).getByRole('button', { name: 'Edit milestone' }))
    expect(onMilestoneClick).toHaveBeenCalledWith('m2')
  })

  it('read-only mode offers neither a pencil nor a clickable placeholder', () => {
    setupMilestones({
      milestones: [mMilestones[1]],
      tasks: [],
      editable: false,
      onTaskClick: undefined,
      onMilestoneClick: undefined,
      onMilestoneDates: undefined,
    })
    expect(screen.queryByRole('button', { name: 'Edit milestone' })).toBeNull()
    expect(screen.getByTestId('milestone-placeholder').tagName).toBe('DIV')
  })

  it('a project with no milestones keeps the flat layout', () => {
    setupMilestones({ milestones: [] })
    expect(screen.queryByTestId('unassigned-row')).toBeNull()
    expect(document.querySelectorAll('[data-testid="milestone-row"]')).toHaveLength(0)
    // Every dated task is a top-level row again.
    const bar = screen.getByRole('button', { name: /Kickoff deck/ })
    expect((bar.closest('.gantt-row') as HTMLElement).querySelector('.pl-8')).not.toBeNull()
  })
})
