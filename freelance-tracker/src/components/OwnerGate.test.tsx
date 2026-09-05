import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import OwnerGate from './OwnerGate'

vi.mock('../hooks/useWorkspaceRole', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../hooks/useWorkspaceRole')>()
  return { ...actual, useWorkspaceRole: vi.fn() }
})

import { useRole, useWorkspaceRole, type WorkspaceRole } from '../hooks/useWorkspaceRole'

function mockRole(role: WorkspaceRole | null, loading: boolean) {
  vi.mocked(useWorkspaceRole).mockReturnValue({ role, loading })
}

function RoleProbe() {
  const role = useRole()
  return <div>role: {role}</div>
}

function ThrowingProbe() {
  useRole()
  return null
}

beforeEach(() => {
  vi.mocked(useWorkspaceRole).mockReset()
})

describe('OwnerGate', () => {
  it('shows a loading spinner while the role is unresolved', () => {
    mockRole(null, true)
    const { container } = render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<OwnerGate><div>content</div></OwnerGate>} />
        </Routes>
      </MemoryRouter>,
    )
    expect(container.querySelector('.animate-spin')).toBeInTheDocument()
    expect(screen.queryByText('content')).not.toBeInTheDocument()
  })

  it('redirects a portal user to /portal', () => {
    mockRole('portal', false)
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<OwnerGate><div>content</div></OwnerGate>} />
          <Route path="/portal" element={<div>portal page</div>} />
        </Routes>
      </MemoryRouter>,
    )
    expect(screen.getByText('portal page')).toBeInTheDocument()
  })

  it('redirects a collaborator away from a non-collaborator route to /timeline', () => {
    mockRole('collaborator', false)
    render(
      <MemoryRouter initialEntries={['/invoices']}>
        <Routes>
          <Route path="/invoices" element={<OwnerGate><div>content</div></OwnerGate>} />
          <Route path="/timeline" element={<div>timeline page</div>} />
        </Routes>
      </MemoryRouter>,
    )
    expect(screen.getByText('timeline page')).toBeInTheDocument()
  })

  it('lets a collaborator render children on an allowed route', () => {
    mockRole('collaborator', false)
    render(
      <MemoryRouter initialEntries={['/timeline']}>
        <Routes>
          <Route path="/timeline" element={<OwnerGate><div>gated content</div></OwnerGate>} />
        </Routes>
      </MemoryRouter>,
    )
    expect(screen.getByText('gated content')).toBeInTheDocument()
  })

  it('lets an owner render children, and provides the role via context', () => {
    mockRole('owner', false)
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<OwnerGate><RoleProbe /></OwnerGate>} />
        </Routes>
      </MemoryRouter>,
    )
    expect(screen.getByText('role: owner')).toBeInTheDocument()
  })

  it('useRole throws when used outside OwnerGate', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<ThrowingProbe />)).toThrow('useRole must be used inside OwnerGate')
    errorSpy.mockRestore()
  })
})
