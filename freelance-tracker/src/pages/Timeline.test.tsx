import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, waitFor, fireEvent, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { I18nProvider } from '../lib/i18n'
import type { Project } from '../hooks/useProjects'
import type { Task } from '../hooks/useTasks'
import type { Milestone } from '../hooks/useMilestones'

/**
 * Hoisted so the vi.mock factories below can close over it; each test rewrites
 * the fields it cares about before rendering.
 */
const hooks = vi.hoisted(() => ({
  projects: [] as unknown[],
  tasks: [] as unknown[],
  milestones: [] as Array<{ id: string; project_id: string }>,
  members: [] as Array<{ id: string; project_id: string; email: string; role: 'editor'; created_at: string }>,
  timeEntries: [] as unknown[],
  projectsLoading: false,
  tasksLoading: false,
  projectsError: null as string | null,
  tasksError: null as string | null,
  createTask: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
  updateProject: vi.fn(),
  createMilestone: vi.fn(),
  updateMilestone: vi.fn(),
  deleteMilestone: vi.fn(),
  refetch: vi.fn(),
  refetchMilestones: vi.fn(),
}))

vi.mock('../hooks/useProjects', () => ({
  useProjects: () => ({
    projects: hooks.projects,
    loading: hooks.projectsLoading,
    error: hooks.projectsError,
    updateProject: hooks.updateProject,
    refetch: hooks.refetch,
  }),
}))

vi.mock('../hooks/useTasks', () => ({
  useTasks: () => ({
    tasks: hooks.tasks,
    loading: hooks.tasksLoading,
    error: hooks.tasksError,
    createTask: hooks.createTask,
    updateTask: hooks.updateTask,
    deleteTask: hooks.deleteTask,
    refetch: hooks.refetch,
  }),
}))

vi.mock('../hooks/useTimeEntries', () => ({
  useTimeEntries: () => ({
    entries: hooks.timeEntries,
    loading: false,
    error: null,
    createEntry: vi.fn(),
    updateEntry: vi.fn(),
    deleteEntry: vi.fn(),
    refetch: vi.fn(),
  }),
}))

/** Mirrors the real hook: one project's milestones, or all of them for Overview. */
vi.mock('../hooks/useMilestones', () => ({
  useMilestones: (projectId?: string) => ({
    milestones: projectId ? hooks.milestones.filter((m) => m.project_id === projectId) : hooks.milestones,
    loading: false,
    error: null,
    createMilestone: hooks.createMilestone,
    updateMilestone: hooks.updateMilestone,
    deleteMilestone: hooks.deleteMilestone,
    refetch: hooks.refetchMilestones,
  }),
}))

vi.mock('../hooks/useWorkspaceRole', () => ({
  useRole: () => 'owner',
}))

vi.mock('../hooks/useProjectMembers', () => ({
  useProjectMembers: () => ({
    members: hooks.members,
    loading: false,
    error: null,
    addMember: vi.fn(),
    removeMember: vi.fn(),
    refetch: vi.fn(),
  }),
}))

import Timeline from './Timeline'

function makeProject(over: Partial<Project> = {}): Project {
  return {
    id: 'p1',
    user_id: 'u1',
    client_id: 'c1',
    name: 'Alpha',
    description: null,
    status: 'active',
    type: null,
    billing_type: 'hourly',
    hourly_rate: 100,
    monthly_rate: null,
    start_date: '2026-09-01',
    end_date: '2026-10-31',
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
    ...over,
  }
}

function makeTask(over: Partial<Task> = {}): Task {
  return {
    id: 't1',
    project_id: 'p1',
    title: 'Brand audit',
    description: null,
    status: 'in_progress',
    priority: 'medium',
    start_date: '2026-09-10',
    due_date: '2026-09-12',
    meeting_note_id: null,
    milestone_id: null,
    assignee: 'owner',
    progress: 0,
    estimate_hours: null,
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
    ...over,
  }
}

function makeMilestone(over: Partial<Milestone> = {}): Milestone {
  return {
    id: 'm1',
    project_id: 'p1',
    name: 'Discovery',
    start_date: '2026-09-03',
    end_date: '2026-09-10',
    sort_order: 0,
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
    ...over,
  }
}

/** Two active projects; Beta is the more recently updated one. */
function alpha(): Project {
  return makeProject({ updated_at: '2026-08-01T00:00:00Z' })
}
function beta(): Project {
  return makeProject({ id: 'p2', name: 'Beta', client_id: 'c2', updated_at: '2026-08-20T00:00:00Z' })
}

/** The page rewrites `?project=`; this is how the tests read the result. */
function LocationProbe() {
  return <div data-testid="search">{useLocation().search}</div>
}

function ui(entries: string[] = ['/timeline']) {
  return (
    <I18nProvider>
      <MemoryRouter initialEntries={entries}>
        <Timeline />
        <LocationProbe />
      </MemoryRouter>
    </I18nProvider>
  )
}

function renderPage(entries?: string[]) {
  const view = render(ui(entries))
  return { ...view, update: () => view.rerender(ui(entries)) }
}

/**
 * The Gantt resolves pointer clicks itself; detail: 0 takes its keyboard-activation
 * path. Since revision (d) a bar opens the floating panel, and the full dialog is
 * one step further in.
 */
function openDialogFor(title: string) {
  const bar = screen.getByRole('button', { name: new RegExp(`^${title}:`) })
  act(() => {
    bar.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 0 }))
  })
  act(() => {
    screen.getByRole('button', { name: 'Open full editor' }).click()
  })
}

beforeEach(() => {
  hooks.projects = [makeProject()]
  hooks.tasks = [makeTask()]
  hooks.milestones = []
  hooks.members = []
  hooks.timeEntries = []
  hooks.createMilestone = vi.fn().mockResolvedValue(makeMilestone())
  hooks.updateMilestone = vi.fn().mockResolvedValue(makeMilestone())
  hooks.deleteMilestone = vi.fn().mockResolvedValue(undefined)
  hooks.refetchMilestones = vi.fn()
  hooks.projectsLoading = false
  hooks.tasksLoading = false
  hooks.projectsError = null
  hooks.tasksError = null
  hooks.createTask = vi.fn()
  hooks.updateTask = vi.fn().mockResolvedValue(undefined)
  hooks.deleteTask = vi.fn().mockResolvedValue(undefined)
  hooks.updateProject = vi.fn().mockResolvedValue(undefined)
  hooks.refetch = vi.fn()
  localStorage.clear()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('Timeline page', () => {
  it('typing in the task dialog survives a background refetch', async () => {
    const user = userEvent.setup()
    const view = renderPage()

    openDialogFor('Brand audit')
    const input = await screen.findByLabelText(/^Title/)
    await user.type(input, ' v2')
    expect(input).toHaveValue('Brand audit v2')

    // A refetch hands the page a brand-new array of equal-content tasks.
    hooks.tasks = [makeTask()]
    view.update()

    expect(screen.getByLabelText(/^Title/)).toHaveValue('Brand audit v2')
  })

  it('a rejected dialog save shows the error banner and keeps the dialog open', async () => {
    const user = userEvent.setup()
    hooks.updateTask = vi.fn().mockRejectedValue(new Error('RLS denied'))
    renderPage()

    openDialogFor('Brand audit')
    await screen.findByLabelText(/^Title/)
    await user.click(screen.getByRole('button', { name: 'Save Changes' }))

    // The open dialog aria-hides the page behind it, so the banner needs hidden: true.
    await waitFor(() => {
      expect(
        screen.getAllByRole('alert', { hidden: true }).some((el) => el.textContent?.includes('RLS denied')),
      ).toBe(true)
    })
    expect(screen.getByLabelText(/^Title/)).toBeInTheDocument()
  })

  it('a fetch error is shown instead of the empty state', () => {
    hooks.projects = []
    hooks.tasks = []
    hooks.projectsError = 'boom'
    renderPage()

    expect(screen.getAllByRole('alert').some((el) => el.textContent?.includes('boom'))).toBe(true)
    expect(screen.queryByText(/No projects yet/)).not.toBeInTheDocument()
  })

  it('an unknown ?project id falls back to the newest active project, not to Overview', async () => {
    hooks.projects = [alpha(), beta()]
    hooks.tasks = [makeTask(), makeTask({ id: 't2', project_id: 'p2', title: 'Kickoff' })]
    renderPage(['/timeline?project=nope'])

    // Beta is the more recently updated active project.
    await waitFor(() => expect(screen.getByTestId('search')).toHaveTextContent('?project=p2'))
    expect(screen.getByRole('combobox', { name: 'Project' })).toHaveValue('p2')
    // Alpha is still an option in the switcher; what it must not have is a row in the grid.
    expect(screen.queryByRole('img', { name: /^Alpha:/ })).not.toBeInTheDocument()
  })

  it('the header names the project and counts its tasks, with no hero copy', () => {
    hooks.tasks = [makeTask(), makeTask({ id: 't2', title: 'Old logo pass', status: 'done' })]
    renderPage()

    expect(screen.getByRole('heading', { level: 1, name: 'Alpha' })).toBeInTheDocument()
    expect(screen.getByText(/Sep 1, 2026 – Oct 31, 2026 · 2 tasks · 1 open/)).toBeInTheDocument()
    // The stock-photo hero and its quote are gone for good.
    expect(screen.queryByText(/Your Runway/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Time is the axis/)).not.toBeInTheDocument()
  })

  it('a project with no dates says so instead of printing a range', () => {
    hooks.projects = [makeProject({ start_date: null, end_date: null })]
    hooks.tasks = []
    renderPage()

    expect(screen.getByText(/No dates yet · 0 tasks · 0 open/)).toBeInTheDocument()
  })

  it('zoom choice persists in localStorage', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('radio', { name: 'Quarter' }))

    expect(localStorage.getItem('timeline.zoom')).toBe('quarter')
  })

  it('defaults to Week zoom when nothing is stored', () => {
    renderPage()

    expect(screen.getByRole('radio', { name: 'Week' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: 'Month' })).toHaveAttribute('aria-checked', 'false')
  })

  it('opens on the most recently updated active project and records the choice', async () => {
    hooks.projects = [alpha(), beta()]
    hooks.tasks = [makeTask(), makeTask({ id: 't2', project_id: 'p2', title: 'Kickoff' })]
    renderPage()

    await waitFor(() => expect(screen.getByTestId('search')).toHaveTextContent('?project=p2'))
    expect(localStorage.getItem('timeline.lastProject')).toBe('p2')
    // Only Beta's row and only Beta's tasks.
    expect(screen.getByRole('button', { name: /^Kickoff:/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Brand audit:/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('img', { name: /^Alpha:/ })).not.toBeInTheDocument()
  })

  it('?project=all shows one bar per project, no tasks, and the hint', async () => {
    hooks.projects = [alpha(), beta()]
    hooks.tasks = [makeTask(), makeTask({ id: 't2', project_id: 'p2', title: 'Kickoff' })]
    renderPage(['/timeline?project=all'])

    expect(screen.getByRole('img', { name: /^Alpha:/ })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /^Beta:/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Brand audit:/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Kickoff:/ })).not.toBeInTheDocument()
    expect(screen.getByText('One bar per project. Pick a project to plan its tasks.')).toBeInTheDocument()
    await waitFor(() => expect(localStorage.getItem('timeline.lastProject')).toBe('all'))
  })

  it('choosing a project in the switcher switches to it and updates the URL', async () => {
    const user = userEvent.setup()
    hooks.projects = [alpha(), beta()]
    hooks.tasks = [makeTask(), makeTask({ id: 't2', project_id: 'p2', title: 'Kickoff' })]
    renderPage(['/timeline?project=all'])

    await user.selectOptions(screen.getByRole('combobox', { name: 'Project' }), 'p1')

    await waitFor(() => expect(screen.getByTestId('search')).toHaveTextContent('?project=p1'))
    expect(screen.getByRole('combobox', { name: 'Project' })).toHaveValue('p1')
    expect(screen.getByRole('heading', { level: 1, name: 'Alpha' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Brand audit:/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Kickoff:/ })).not.toBeInTheDocument()
    expect(localStorage.getItem('timeline.lastProject')).toBe('p1')
  })

  it('the switcher groups active projects apart from the rest', () => {
    hooks.projects = [alpha(), beta(), makeProject({ id: 'p3', name: 'Gamma', status: 'completed' })]
    renderPage()

    const groups = Array.from(document.querySelectorAll('optgroup')).map((g) => g.label)
    expect(groups).toEqual(['Active', 'Other'])
  })

  it('hides done tasks by default and says how many it hid', () => {
    hooks.tasks = [
      makeTask(),
      makeTask({ id: 't2', title: 'Old logo pass', status: 'done' }),
      makeTask({ id: 't3', title: 'Sitemap', status: 'done' }),
    ]
    renderPage()

    expect(screen.getByRole('checkbox', { name: 'Hide done' })).toBeChecked()
    expect(screen.getByRole('button', { name: /^Brand audit:/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Old logo pass:/ })).not.toBeInTheDocument()
    expect(screen.getByText('2 done hidden')).toBeInTheDocument()
  })

  it('the count is absent when the project has no done tasks', () => {
    renderPage()

    expect(screen.getByRole('checkbox', { name: 'Hide done' })).toBeChecked()
    expect(screen.queryByText(/done hidden/)).not.toBeInTheDocument()
  })

  it('unticking Hide done brings the done tasks back and persists the choice', async () => {
    const user = userEvent.setup()
    hooks.tasks = [makeTask(), makeTask({ id: 't2', title: 'Old logo pass', status: 'done' })]
    renderPage()

    await user.click(screen.getByRole('checkbox', { name: 'Hide done' }))

    expect(screen.getByRole('button', { name: /^Old logo pass:/ })).toBeInTheDocument()
    expect(screen.queryByText(/done hidden/)).not.toBeInTheDocument()
    expect(localStorage.getItem('timeline.hideDone')).toBe('false')
  })

  it('a stored Hide done choice of false is honoured on load', () => {
    localStorage.setItem('timeline.hideDone', 'false')
    hooks.tasks = [makeTask(), makeTask({ id: 't2', title: 'Old logo pass', status: 'done' })]
    renderPage()

    expect(screen.getByRole('checkbox', { name: 'Hide done' })).not.toBeChecked()
    expect(screen.getByRole('button', { name: /^Old logo pass:/ })).toBeInTheDocument()
  })

  it('the Print button calls window.print', async () => {
    const user = userEvent.setup()
    const print = vi.fn()
    vi.stubGlobal('print', print)
    try {
      renderPage()
      await user.click(screen.getByRole('button', { name: /Print \/ PDF/ }))
      expect(print).toHaveBeenCalledTimes(1)
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('refresh is skipped while the document is hidden', () => {
    vi.useFakeTimers()
    const setVisibility = (value: string) =>
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => value })
    try {
      setVisibility('hidden')
      renderPage()

      act(() => {
        vi.advanceTimersByTime(60_000)
      })
      expect(hooks.refetch).not.toHaveBeenCalled()
      expect(hooks.refetchMilestones).not.toHaveBeenCalled()

      setVisibility('visible')
      act(() => {
        document.dispatchEvent(new Event('visibilitychange'))
      })
      expect(hooks.refetch).toHaveBeenCalledTimes(1)
      // Milestones are collaborative too: refreshing only the tasks would leave a
      // colleague's renamed or re-dated milestone stale until a full reload.
      expect(hooks.refetchMilestones).toHaveBeenCalledTimes(1)
    } finally {
      delete (document as unknown as Record<string, unknown>).visibilityState
      vi.useRealTimers()
    }
  })
})

describe('Timeline bar popover, hours and task creation', () => {
  function member(email: string) {
    return { id: `mem-${email}`, project_id: 'p1', email, role: 'editor' as const, created_at: '2026-08-01T00:00:00Z' }
  }

  /** Click a task bar. The Gantt resolves pointer clicks itself, so this is a real one. */
  function openPopover(title = 'Brand audit') {
    const bar = screen.getByRole('button', { name: new RegExp(`^${title}:`) })
    fireEvent.pointerDown(bar, { clientX: 100, button: 0, pointerId: 1 })
    fireEvent.pointerUp(bar, { clientX: 100, pointerId: 1 })
    return screen.getByRole('dialog', { name: title })
  }

  it('clicking a bar floats the editor against it instead of opening a modal', () => {
    renderPage()

    const panel = openPopover()
    expect(panel).toBeInTheDocument()
    expect(within(panel).getByLabelText('Title')).toHaveValue('Brand audit')
    // The full dialog is still shut: this is a panel, not the old modal.
    expect(screen.queryByRole('button', { name: 'Save Changes' })).not.toBeInTheDocument()
  })

  it('the assignee picker offers the owner and every collaborator on the project', () => {
    hooks.members = [member('courtney@example.com')]
    renderPage()

    const options = Array.from(within(openPopover()).getByLabelText('Assignee').querySelectorAll('option'))
    // No profile name is stored in this browser, so the owner reads as "Me"; a
    // member's email reads as its capitalised local part.
    expect(options.map((o) => o.textContent)).toEqual(['Unassigned', 'Me', 'Courtney', 'owner'])
    expect(options.map((o) => o.getAttribute('value'))).toEqual(['', 'me', 'courtney@example.com', 'owner'])
  })

  it('an edit in the popover goes through updateTask', async () => {
    renderPage()

    fireEvent.change(within(openPopover()).getByLabelText('Progress'), { target: { value: '80' } })

    await waitFor(() =>
      expect(hooks.updateTask).toHaveBeenCalledWith('t1', { progress: 80, status: 'in_progress' }),
    )
  })

  it('marking a task done fills its bar too', async () => {
    renderPage()

    fireEvent.change(within(openPopover()).getByLabelText('Status'), { target: { value: 'done' } })

    await waitFor(() => expect(hooks.updateTask).toHaveBeenCalledWith('t1', { status: 'done', progress: 100 }))
  })

  it('an estimate typed into the popover is saved on blur', async () => {
    renderPage()

    const input = within(openPopover()).getByLabelText('Estimated hours')
    fireEvent.change(input, { target: { value: '6.5' } })
    fireEvent.blur(input)

    await waitFor(() => expect(hooks.updateTask).toHaveBeenCalledWith('t1', { estimate_hours: 6.5 }))
  })

  it('a rejected edit shows the page banner as well as the inline line', async () => {
    hooks.updateTask = vi.fn().mockRejectedValue(new Error('RLS denied'))
    renderPage()

    fireEvent.change(within(openPopover()).getByLabelText('Progress'), { target: { value: '80' } })

    await waitFor(() => {
      expect(screen.getAllByRole('alert').some((el) => el.textContent?.includes('RLS denied'))).toBe(true)
    })
  })

  it('a missing progress column is named, not shown as a raw Postgres error', async () => {
    hooks.updateTask = vi.fn().mockRejectedValue(new Error('migration-pending'))
    renderPage()

    fireEvent.change(within(openPopover()).getByLabelText('Progress'), { target: { value: '80' } })

    await waitFor(() => {
      expect(
        screen.getAllByRole('alert').some((el) => el.textContent?.includes('supabase_migration_task_progress.sql')),
      ).toBe(true)
    })
  })

  it('the hours logged against the task are summed from the time entries', () => {
    hooks.timeEntries = [
      { id: 'e1', project_id: 'p1', task_id: 't1', hours: 3, date: '2026-09-10', billable: true, description: null, invoice_id: null, created_at: '2026-09-10T00:00:00Z' },
      { id: 'e2', project_id: 'p1', task_id: 't1', hours: 2.5, date: '2026-09-11', billable: true, description: null, invoice_id: null, created_at: '2026-09-11T00:00:00Z' },
      // Another task's time, and time logged against no task at all.
      { id: 'e3', project_id: 'p1', task_id: 't2', hours: 9, date: '2026-09-11', billable: true, description: null, invoice_id: null, created_at: '2026-09-11T00:00:00Z' },
      { id: 'e4', project_id: 'p1', task_id: null, hours: 4, date: '2026-09-11', billable: true, description: null, invoice_id: null, created_at: '2026-09-11T00:00:00Z' },
    ]
    hooks.tasks = [makeTask({ estimate_hours: 8 })]
    renderPage()

    // On the row, against the estimate...
    const row = screen.getByRole('button', { name: /^Brand audit:/ }).closest('.gantt-row') as HTMLElement
    expect(within(row).getByTestId('sub-line')).toBeInTheDocument()
    // ...and in the popover, read-only.
    expect(within(openPopover()).getByLabelText('Logged hours')).toHaveTextContent('5.5')
  })

  it('Delete removes the task and closes the popover', async () => {
    const confirm = vi.fn().mockReturnValue(true)
    vi.stubGlobal('confirm', confirm)
    try {
      renderPage()
      fireEvent.click(within(openPopover()).getByRole('button', { name: 'Delete' }))

      await waitFor(() => expect(hooks.deleteTask).toHaveBeenCalledWith('t1'))
      await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Brand audit' })).not.toBeInTheDocument())
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('+ creates a task on the project and opens it with the title focused', async () => {
    hooks.createTask = vi.fn().mockImplementation(async (input: { milestone_id: string | null }) => {
      const created = makeTask({
        id: 'new1',
        title: 'New task',
        status: 'todo',
        start_date: null,
        due_date: null,
        milestone_id: input.milestone_id,
      })
      hooks.tasks = [...hooks.tasks, created]
      return created
    })
    renderPage()

    fireEvent.click(screen.getAllByRole('button', { name: 'Add task' })[0])

    await waitFor(() =>
      expect(hooks.createTask).toHaveBeenCalledWith(
        expect.objectContaining({
          project_id: 'p1',
          title: 'New task',
          status: 'todo',
          priority: 'medium',
          assignee: '',
          milestone_id: null,
          start_date: null,
          due_date: null,
          meeting_note_id: null,
        }),
      ),
    )
    const panel = await screen.findByRole('dialog', { name: 'New task' })
    await waitFor(() => expect(within(panel).getByLabelText('Title')).toHaveFocus())
  })

  it('+ on a milestone row creates the task under that milestone', async () => {
    hooks.milestones = [makeMilestone()]
    hooks.createTask = vi.fn().mockImplementation(async (input: { milestone_id: string | null }) => {
      const created = makeTask({ id: 'new2', title: 'New task', status: 'todo', start_date: null, due_date: null, milestone_id: input.milestone_id })
      hooks.tasks = [...hooks.tasks, created]
      return created
    })
    renderPage()

    const milestoneRow = document.querySelector('[data-milestone-id="m1"]') as HTMLElement
    fireEvent.click(within(milestoneRow).getByRole('button', { name: 'Add task' }))

    await waitFor(() =>
      expect(hooks.createTask).toHaveBeenCalledWith(expect.objectContaining({ milestone_id: 'm1' })),
    )
  })

  it('Open full editor hands the task over to the dialog', async () => {
    renderPage()

    fireEvent.click(within(openPopover()).getByRole('button', { name: 'Open full editor' }))

    expect(await screen.findByRole('button', { name: 'Save Changes' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Brand audit' })).not.toBeInTheDocument()
  })

  it('the header states the project percentage alongside the counts', () => {
    hooks.tasks = [makeTask({ progress: 100, status: 'done' }), makeTask({ id: 't2', title: 'Sitemap', progress: 0 })]
    renderPage()

    expect(screen.getByText(/2 tasks · 1 open · 50% complete/)).toBeInTheDocument()
  })

  it('the six-column list and its remembered split are gone', () => {
    renderPage()

    expect(screen.queryByTestId('list-resize')).toBeNull()
    expect(localStorage.getItem('timeline.listWidth')).toBeNull()
    const cell = (screen.getByRole('button', { name: /^Brand audit:/ }).closest('.gantt-row') as HTMLElement)
      .firstElementChild as HTMLElement
    expect(cell).toHaveStyle({ width: '320px' })
  })
})

describe('Timeline milestones', () => {
  /** The Gantt resolves pointer clicks itself; detail: 0 is the keyboard path. */
  function activate(name: RegExp) {
    const el = screen.getByRole('button', { name })
    act(() => {
      el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 0 }))
    })
  }

  const milestoneRows = () => document.querySelectorAll('[data-testid="milestone-row"]')

  it('draws a milestone row per milestone and counts them in the header', () => {
    hooks.milestones = [makeMilestone()]
    hooks.tasks = [makeTask({ milestone_id: 'm1' })]
    renderPage()

    expect(milestoneRows()).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Discovery' })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByText(/· 1 milestones/)).toBeInTheDocument()
    // Collapsed by default, so the nested task has no bar yet.
    expect(screen.queryByRole('button', { name: /^Brand audit:/ })).not.toBeInTheDocument()
  })

  it('expanding a milestone persists under the project key and survives a remount', async () => {
    const user = userEvent.setup()
    hooks.milestones = [makeMilestone()]
    hooks.tasks = [makeTask({ milestone_id: 'm1' })]
    const view = renderPage()

    await user.click(screen.getByRole('button', { name: 'Discovery' }))

    expect(screen.getByRole('button', { name: /^Brand audit:/ })).toBeInTheDocument()
    expect(localStorage.getItem('timeline.expanded.p1')).toBe('["m1"]')

    view.unmount()
    renderPage()

    expect(screen.getByRole('button', { name: 'Discovery' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: /^Brand audit:/ })).toBeInTheDocument()
  })

  it('switching project forgets the other project\'s expansion', async () => {
    const user = userEvent.setup()
    hooks.projects = [alpha(), beta()]
    hooks.tasks = [makeTask({ milestone_id: 'm1' }), makeTask({ id: 't2', project_id: 'p2', title: 'Kickoff' })]
    hooks.milestones = [makeMilestone(), makeMilestone({ id: 'm2', project_id: 'p2', name: 'Rollout' })]
    localStorage.setItem('timeline.expanded.p1', '["m1"]')
    renderPage(['/timeline?project=p1'])

    expect(screen.getByRole('button', { name: 'Discovery' })).toHaveAttribute('aria-expanded', 'true')

    await user.selectOptions(screen.getByRole('combobox', { name: 'Project' }), 'p2')

    expect(screen.getByRole('button', { name: 'Rollout' })).toHaveAttribute('aria-expanded', 'false')
  })

  it('+ Milestone opens the dialog and saves with the next sort_order', async () => {
    const user = userEvent.setup()
    hooks.milestones = [makeMilestone({ sort_order: 3 })]
    renderPage()

    await user.click(screen.getByRole('button', { name: '+ Milestone' }))
    await user.type(await screen.findByLabelText(/^Name/), 'Launch')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(hooks.createMilestone).toHaveBeenCalledWith({
      project_id: 'p1',
      name: 'Launch',
      start_date: null,
      end_date: null,
      sort_order: 4,
    })
  })

  it('+ Milestone is not offered in Overview', () => {
    hooks.projects = [alpha(), beta()]
    renderPage(['/timeline?project=all'])

    expect(screen.queryByRole('button', { name: '+ Milestone' })).not.toBeInTheDocument()
  })

  it('clicking a milestone bar opens it for editing, and Delete confirms first', async () => {
    const user = userEvent.setup()
    hooks.milestones = [makeMilestone()]
    renderPage()

    activate(/^Discovery:/)

    expect(await screen.findByRole('heading', { name: 'Edit milestone' })).toBeInTheDocument()
    expect(screen.getByLabelText(/^Name/)).toHaveValue('Discovery')

    const confirm = vi.fn().mockReturnValue(true)
    vi.stubGlobal('confirm', confirm)
    await user.click(screen.getByRole('button', { name: 'Delete milestone' }))

    expect(confirm).toHaveBeenCalledWith('Delete milestone "Discovery"? Its tasks are kept and unassigned.')
    expect(hooks.deleteMilestone).toHaveBeenCalledWith('m1')
  })

  it('editing a milestone saves its new name and dates', async () => {
    const user = userEvent.setup()
    hooks.milestones = [makeMilestone()]
    renderPage()

    activate(/^Discovery:/)
    const name = await screen.findByLabelText(/^Name/)
    await user.clear(name)
    await user.type(name, 'Discovery v2')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(hooks.updateMilestone).toHaveBeenCalledWith('m1', {
      name: 'Discovery v2',
      start_date: '2026-09-03',
      end_date: '2026-09-10',
    })
  })

  it('the task dialog picks up the milestone and saves it back', async () => {
    const user = userEvent.setup()
    hooks.milestones = [makeMilestone()]
    hooks.tasks = [makeTask({ milestone_id: 'm1' })]
    localStorage.setItem('timeline.expanded.p1', '["m1"]')
    renderPage()

    openDialogFor('Brand audit')
    await screen.findByLabelText(/^Title/)

    // The picker is pre-set to the task's current milestone.
    expect(screen.getByRole('combobox', { name: 'Milestone' })).toHaveTextContent('Discovery')

    await user.click(screen.getByRole('button', { name: 'Save Changes' }))

    expect(hooks.updateTask).toHaveBeenCalledWith(
      't1',
      expect.objectContaining({ title: 'Brand audit', milestone_id: 'm1' }),
    )
  })

  it('a project with no milestones gets the task dialog it always had', async () => {
    renderPage()

    openDialogFor('Brand audit')
    await screen.findByLabelText(/^Title/)

    expect(screen.queryByRole('combobox', { name: 'Milestone' })).not.toBeInTheDocument()
  })

  it('Overview draws milestone diamonds and no milestone rows', () => {
    hooks.projects = [alpha(), beta()]
    hooks.tasks = [makeTask({ milestone_id: 'm1' })]
    hooks.milestones = [makeMilestone()]
    renderPage(['/timeline?project=all'])

    expect(screen.getAllByTestId('milestone-diamond')).toHaveLength(1)
    expect(milestoneRows()).toHaveLength(0)
  })

  it('a rejected milestone drag shows the banner', async () => {
    hooks.milestones = [makeMilestone()]
    hooks.updateMilestone = vi.fn().mockRejectedValue(new Error('RLS denied'))
    renderPage()

    const bar = screen.getByRole('button', { name: /^Discovery:/ })
    fireEvent.pointerDown(bar, { clientX: 0, button: 0, pointerId: 1 })
    fireEvent.pointerMove(bar, { clientX: 200, pointerId: 1, buttons: 1 })
    fireEvent.pointerUp(bar, { clientX: 200, pointerId: 1 })

    await waitFor(() => {
      expect(screen.getAllByRole('alert').some((el) => el.textContent?.includes('RLS denied'))).toBe(true)
    })
  })
})
