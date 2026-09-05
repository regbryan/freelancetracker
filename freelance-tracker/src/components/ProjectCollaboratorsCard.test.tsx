import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nProvider } from '../lib/i18n'
import ProjectCollaboratorsCard from './ProjectCollaboratorsCard'
import { useProjectMembers, type ProjectMember } from '../hooks/useProjectMembers'

vi.mock('../hooks/useProjectMembers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../hooks/useProjectMembers')>()
  return {
    ...actual,
    useProjectMembers: vi.fn(),
  }
})

const mockedUseProjectMembers = vi.mocked(useProjectMembers)

const member = (overrides: Partial<ProjectMember> = {}): ProjectMember => ({
  id: 'm1',
  project_id: 'p1',
  email: 'colleague@example.com',
  role: 'editor',
  created_at: '2026-06-10T10:00:00Z',
  ...overrides,
})

function setup(overrides: Partial<ReturnType<typeof useProjectMembers>> = {}) {
  const addMember = vi.fn().mockResolvedValue(undefined)
  const removeMember = vi.fn().mockResolvedValue(undefined)
  const refetch = vi.fn().mockResolvedValue(undefined)
  mockedUseProjectMembers.mockReturnValue({
    members: [],
    loading: false,
    error: null,
    addMember,
    removeMember,
    refetch,
    ...overrides,
  })
  render(
    <I18nProvider>
      <ProjectCollaboratorsCard projectId="p1" />
    </I18nProvider>,
  )
  return { addMember, removeMember }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ProjectCollaboratorsCard', () => {
  it('shows the empty message when there are no members', () => {
    setup({ members: [] })
    expect(screen.getByText('No collaborators yet.')).toBeInTheDocument()
  })

  it('lists member emails with a Remove button each', () => {
    setup({ members: [member(), member({ id: 'm2', email: 'second@example.com' })] })
    expect(screen.getByText('colleague@example.com')).toBeInTheDocument()
    expect(screen.getByText('second@example.com')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /remove/i })).toHaveLength(2)
  })

  it('submitting an email calls addMember with the raw input and clears the field on success', async () => {
    const user = userEvent.setup()
    const { addMember } = setup()
    const input = screen.getByPlaceholderText('colleague@example.com')
    await user.type(input, 'New@Example.com')
    await user.click(screen.getByRole('button', { name: /^add$/i }))
    expect(addMember).toHaveBeenCalledWith('New@Example.com')
    expect(input).toHaveValue('')
  })

  it('shows the duplicate message when addMember rejects with a duplicate error', async () => {
    const user = userEvent.setup()
    setup({ addMember: vi.fn().mockRejectedValue(new Error('duplicate')) })
    await user.type(screen.getByPlaceholderText('colleague@example.com'), 'dupe@example.com')
    await user.click(screen.getByRole('button', { name: /^add$/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent('That email is already a collaborator.')
  })

  it('shows the invalid message when addMember rejects with an invalid error', async () => {
    const user = userEvent.setup()
    setup({ addMember: vi.fn().mockRejectedValue(new Error('invalid')) })
    await user.type(screen.getByPlaceholderText('colleague@example.com'), 'not-an-email')
    await user.click(screen.getByRole('button', { name: /^add$/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Enter a valid email address.')
  })

  it('disables the Add button while the input is blank', () => {
    setup()
    expect(screen.getByRole('button', { name: /^add$/i })).toBeDisabled()
  })

  it('shows a load error in an alert', () => {
    setup({ error: 'Failed to load members' })
    expect(screen.getByRole('alert')).toHaveTextContent('Failed to load members')
  })
})
