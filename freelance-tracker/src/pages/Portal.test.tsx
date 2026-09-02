import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { I18nProvider } from '../lib/i18n'
import type { PortalClient, PortalMilestone, PortalProject, PortalTask } from '../lib/portal'

const hooks = vi.hoisted(() => ({
  clients: [] as PortalClient[],
  projects: [] as PortalProject[],
  tasks: [] as PortalTask[],
  milestones: [] as PortalMilestone[],
  loading: false,
  error: null as string | null,
  refetch: vi.fn(),
}))

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ user: { email: 'client@example.com' }, signOut: vi.fn() }),
}))

vi.mock('../hooks/usePortalData', () => ({
  usePortalData: () => ({
    clients: hooks.clients,
    projects: hooks.projects,
    tasks: hooks.tasks,
    milestones: hooks.milestones,
    loading: hooks.loading,
    error: hooks.error,
    refetch: hooks.refetch,
  }),
}))

import Portal from './Portal'

function client(over: Partial<PortalClient> = {}): PortalClient {
  return { id: 'c1', name: 'Jamie', company: 'Acme Co', ...over }
}

function project(over: Partial<PortalProject> = {}): PortalProject {
  return {
    id: 'p1',
    client_id: 'c1',
    name: 'Website Rebuild',
    description: null,
    status: 'active',
    start_date: '2026-09-01',
    end_date: '2026-10-01',
    ...over,
  }
}

function task(over: Partial<PortalTask> = {}): PortalTask {
  return {
    id: 't1',
    project_id: 'p1',
    title: 'Design review',
    description: null,
    status: 'todo',
    priority: 'medium',
    start_date: '2026-09-05',
    due_date: '2026-09-10',
    updated_at: null,
    milestone_id: null,
    ...over,
  }
}

function milestone(over: Partial<PortalMilestone> = {}): PortalMilestone {
  return {
    id: 'm1',
    project_id: 'p1',
    name: 'Discovery',
    start_date: '2026-09-03',
    end_date: '2026-09-10',
    sort_order: 0,
    ...over,
  }
}

function ui() {
  return (
    <I18nProvider>
      <MemoryRouter>
        <Portal />
      </MemoryRouter>
    </I18nProvider>
  )
}

function renderPage() {
  return render(ui())
}

beforeEach(() => {
  hooks.clients = [client()]
  hooks.projects = [
    project({ id: 'p1', name: 'Website Rebuild' }),
    project({ id: 'p2', name: 'Brand Refresh', start_date: '2026-09-15', end_date: '2026-11-01' }),
  ]
  hooks.tasks = [
    task({ id: 't1', project_id: 'p1', title: 'Design review' }),
    task({ id: 't2', project_id: 'p1', title: 'Ship homepage', status: 'in_progress' }),
    task({ id: 't3', project_id: 'p2', title: 'Unscheduled kickoff', start_date: null, due_date: null }),
  ]
  hooks.milestones = []
  hooks.loading = false
  hooks.error = null
  hooks.refetch = vi.fn()
  localStorage.clear()
})

describe('Portal', () => {
  it('defaults to the Timeline view', () => {
    renderPage()

    expect(screen.getByTestId('gantt-scroll')).toBeInTheDocument()
    // The list-only "Due <date>" caption and priority badge never render in the gantt.
    expect(screen.queryByText(/^Due /)).not.toBeInTheDocument()
    expect(screen.queryByText('Medium')).not.toBeInTheDocument()
    for (const el of screen.queryAllByText('Design review')) {
      expect(el.closest('li')).toBeNull()
    }
  })

  it('renders no drag affordances in the read-only portal', () => {
    const { container } = renderPage()

    expect(container.querySelectorAll('[data-edge]')).toHaveLength(0)
    // The undated task renders as a plain span, never as a clickable button.
    expect(screen.queryByRole('button', { name: /^Unscheduled kickoff/ })).not.toBeInTheDocument()
    expect(screen.getByText('Unscheduled kickoff').tagName).toBe('SPAN')
    // Dated task bars are non-interactive too: no click handler is wired up in the portal.
    expect(screen.queryByRole('button', { name: /Design review/ })).not.toBeInTheDocument()
    expect(screen.getByText('View only · scroll sideways to see more')).toBeInTheDocument()
  })

  it('clicking List shows the cards, hides the gantt, and persists the choice', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('radio', { name: 'List' }))

    expect(screen.queryByTestId('gantt-scroll')).not.toBeInTheDocument()
    expect(screen.getByText('Design review').closest('li')).toBeInTheDocument()
    expect(localStorage.getItem('portal.view')).toBe('list')
  })

  it('shows the list view on first render when localStorage is pre-set to list', () => {
    localStorage.setItem('portal.view', 'list')
    renderPage()

    expect(screen.queryByTestId('gantt-scroll')).not.toBeInTheDocument()
    expect(screen.getByText('Design review').closest('li')).toBeInTheDocument()
  })

  it('shows the empty message with zero projects, without the gantt, list, or toggle', () => {
    hooks.projects = []
    hooks.tasks = []
    renderPage()

    expect(screen.getByText(/no projects/i)).toBeInTheDocument()
    expect(screen.queryByTestId('gantt-scroll')).not.toBeInTheDocument()
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument()
  })
})

describe('Portal milestones', () => {
  it('collapses a milestone in the timeline until its chevron is clicked, and stays read-only', async () => {
    const user = userEvent.setup()
    hooks.milestones = [milestone()]
    hooks.tasks = [task({ id: 't1', project_id: 'p1', title: 'Design review', milestone_id: 'm1' })]
    renderPage()

    expect(screen.getByTestId('milestone-row')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Discovery' })).toHaveAttribute('aria-expanded', 'false')
    // Collapsed: the task's own row (bar and sticky label) is not rendered at all.
    expect(screen.queryByText('Design review')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Discovery' }))

    expect(screen.getByRole('button', { name: 'Discovery' })).toHaveAttribute('aria-expanded', 'true')
    // Appears twice once expanded: the row's sticky label, and the bar's inline label.
    expect(screen.getAllByText('Design review').length).toBeGreaterThan(0)
    // Read-only even once expanded: no clickable bar, no drag handles.
    expect(screen.queryByRole('button', { name: /Design review/ })).not.toBeInTheDocument()
    expect(document.querySelectorAll('[data-edge]')).toHaveLength(0)
  })

  it('groups the list view by milestone with done/total counts and an Unassigned heading', async () => {
    const user = userEvent.setup()
    hooks.milestones = [milestone()]
    hooks.tasks = [
      task({ id: 't1', project_id: 'p1', title: 'Design review', status: 'done', milestone_id: 'm1' }),
      task({ id: 't2', project_id: 'p1', title: 'Ship homepage', status: 'in_progress', milestone_id: 'm1' }),
      task({ id: 't3', project_id: 'p1', title: 'Kickoff call', status: 'todo', milestone_id: null }),
    ]
    renderPage()

    await user.click(screen.getByRole('radio', { name: 'List' }))

    expect(screen.getByRole('heading', { level: 3, name: /Discovery/ })).toBeInTheDocument()
    expect(screen.getByText('1/2 done')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: 'Unassigned' })).toBeInTheDocument()
    expect(screen.getByText('Design review').closest('li')).toBeInTheDocument()
    expect(screen.getByText('Kickoff call').closest('li')).toBeInTheDocument()
  })

  it('renders a project with no milestones exactly as before', async () => {
    const user = userEvent.setup()
    // p2 has a milestone; p1 (Website Rebuild) does not, and must stay unaffected.
    hooks.milestones = [milestone({ project_id: 'p2', name: 'Rollout' })]
    renderPage()

    await user.click(screen.getByRole('radio', { name: 'List' }))

    const section = screen.getByRole('heading', { name: 'Website Rebuild' }).closest('section') as HTMLElement
    expect(within(section).queryByText('Unassigned')).not.toBeInTheDocument()
    expect(within(section).queryByRole('heading', { level: 3 })).not.toBeInTheDocument()
    expect(within(section).getByText(/To Do/)).toBeInTheDocument()
    expect(within(section).getByText('Design review').closest('li')).toBeInTheDocument()
  })
})
