import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'
import { I18nProvider } from '../lib/i18n'
import { WorkspaceRoleContext, type WorkspaceRole } from '../hooks/useWorkspaceRole'
import Sidebar from './Sidebar'
import WorkTabs from './WorkTabs'
import BottomNav from './BottomNav'

function renderWithRole(ui: ReactNode, role: WorkspaceRole, entries: string[] = ['/']) {
  return render(
    <I18nProvider>
      <MemoryRouter initialEntries={entries}>
        <WorkspaceRoleContext.Provider value={role}>{ui}</WorkspaceRoleContext.Provider>
      </MemoryRouter>
    </I18nProvider>,
  )
}

describe('Sidebar collaborator shell', () => {
  it('collaborator sidebar has exactly links /timeline and /tasks and no New Project', () => {
    renderWithRole(<Sidebar open onClose={() => {}} />, 'collaborator')

    const links = screen.getAllByRole('link')
    expect(links.map((l) => l.getAttribute('href'))).toEqual(['/timeline', '/tasks'])
    expect(screen.queryByText('New Project')).not.toBeInTheDocument()
  })

  it('at /tasks the Timeline link is not active and the Tasks link is', () => {
    renderWithRole(<Sidebar open onClose={() => {}} />, 'collaborator', ['/tasks'])

    const timelineLink = screen.getByRole('link', { name: /Timeline/ })
    const tasksLink = screen.getByRole('link', { name: /Tasks/ })
    expect(timelineLink.className).not.toContain('text-white font-semibold')
    expect(tasksLink.className).toContain('text-white font-semibold')
  })

  it('owner sidebar has no /meetings link but keeps Billing', () => {
    renderWithRole(<Sidebar open onClose={() => {}} />, 'owner')

    const hrefs = screen.getAllByRole('link').map((l) => l.getAttribute('href'))
    expect(hrefs).not.toContain('/meetings')
    expect(hrefs).toContain('/invoices')
    expect(screen.getByRole('link', { name: /Billing/ })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Meetings/ })).not.toBeInTheDocument()
  })

  it('owner Work link is active at /tasks, /timeline, and /time', () => {
    for (const path of ['/tasks', '/timeline', '/time']) {
      const { unmount } = renderWithRole(<Sidebar open onClose={() => {}} />, 'owner', [path])
      const workLink = screen.getByRole('link', { name: /Work/ })
      expect(workLink.className).toContain('text-white font-semibold')
      unmount()
    }
  })
})

describe('WorkTabs collaborator shell', () => {
  it('shows exactly Timeline and Tasks for a collaborator', () => {
    renderWithRole(<WorkTabs />, 'collaborator')

    const links = screen.getAllByRole('link')
    expect(links.map((l) => l.textContent)).toEqual(['Timeline', 'Tasks'])
  })

  it('shows Timeline, Tasks, Timer for an owner', () => {
    renderWithRole(<WorkTabs />, 'owner')

    const links = screen.getAllByRole('link')
    expect(links.map((l) => l.textContent)).toEqual(['Timeline', 'Tasks', 'Timer'])
  })
})

describe('BottomNav collaborator shell', () => {
  it('has two links and no More button', () => {
    renderWithRole(<BottomNav onMoreClick={() => {}} />, 'collaborator')

    expect(screen.getAllByRole('link')).toHaveLength(2)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
