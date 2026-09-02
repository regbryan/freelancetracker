import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { I18nProvider } from '../lib/i18n'
import type { Project } from '../hooks/useProjects'
import type { Task } from '../hooks/useTasks'

/**
 * Hoisted so the vi.mock factories below can close over it; each test rewrites
 * the fields it cares about before rendering.
 */
const hooks = vi.hoisted(() => ({
  projects: [] as unknown[],
  tasks: [] as unknown[],
  projectsLoading: false,
  tasksLoading: false,
  projectsError: null as string | null,
  tasksError: null as string | null,
  updateTask: vi.fn(),
  updateProject: vi.fn(),
  refetch: vi.fn(),
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
    updateTask: hooks.updateTask,
    refetch: hooks.refetch,
  }),
}))

vi.mock('../hooks/useWorkspaceRole', () => ({
  useRole: () => 'owner',
}))

// The insight banner does its own date math and adds noise; the page is what's under test.
vi.mock('../components/TimelineInsight', () => ({ default: () => null }))

import Timeline from './Timeline'

function makeProject(over: Partial<Project> = {}): Project {
  return {
    id: 'p1',
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
    assignee: 'owner',
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
    ...over,
  }
}

function ui(entries: string[] = ['/timeline']) {
  return (
    <I18nProvider>
      <MemoryRouter initialEntries={entries}>
        <Timeline />
      </MemoryRouter>
    </I18nProvider>
  )
}

function renderPage(entries?: string[]) {
  const view = render(ui(entries))
  return { ...view, update: () => view.rerender(ui(entries)) }
}

/** The Gantt resolves pointer clicks itself; detail: 0 takes its keyboard-activation path. */
function openDialogFor(title: string) {
  const bar = screen.getByRole('button', { name: new RegExp(`^${title}:`) })
  act(() => {
    bar.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 0 }))
  })
}

beforeEach(() => {
  hooks.projects = [makeProject()]
  hooks.tasks = [makeTask()]
  hooks.projectsLoading = false
  hooks.tasksLoading = false
  hooks.projectsError = null
  hooks.tasksError = null
  hooks.updateTask = vi.fn().mockResolvedValue(undefined)
  hooks.updateProject = vi.fn().mockResolvedValue(undefined)
  hooks.refetch = vi.fn()
  localStorage.clear()
})

afterEach(() => {
  vi.useRealTimers()
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

  it('an unknown ?project id falls back to all projects', () => {
    hooks.projects = [makeProject(), makeProject({ id: 'p2', name: 'Beta', client_id: 'c2' })]
    hooks.tasks = [makeTask(), makeTask({ id: 't2', project_id: 'p2', title: 'Kickoff' })]
    renderPage(['/timeline?project=nope'])

    expect(screen.getAllByText('Alpha').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Beta').length).toBeGreaterThan(0)
    expect(screen.getByRole('combobox')).toHaveValue('')
  })

  it('zoom choice persists in localStorage', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('radio', { name: 'Week' }))

    expect(localStorage.getItem('timeline.zoom')).toBe('week')
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

      setVisibility('visible')
      act(() => {
        document.dispatchEvent(new Event('visibilitychange'))
      })
      expect(hooks.refetch).toHaveBeenCalledTimes(1)
    } finally {
      delete (document as unknown as Record<string, unknown>).visibilityState
      vi.useRealTimers()
    }
  })
})
