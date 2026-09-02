import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { I18nProvider } from '../lib/i18n'
import type { PortalClient, PortalProject, PortalTask } from '../lib/portal'

const hooks = vi.hoisted(() => ({
  clients: [] as PortalClient[],
  projects: [] as PortalProject[],
  tasks: [] as PortalTask[],
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
