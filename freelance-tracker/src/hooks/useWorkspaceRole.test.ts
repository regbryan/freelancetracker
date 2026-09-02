import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
      onAuthStateChange: vi.fn(),
    },
    from: vi.fn(),
  },
}))

import { supabase } from '../lib/supabase'
import { resolveRole, COLLABORATOR_PATHS, isCollaboratorPath, useWorkspaceRole } from './useWorkspaceRole'

// --- test-only shape of the mocked client; the real client is fully replaced above ---
interface MockSupabase {
  auth: {
    getUser: ReturnType<typeof vi.fn>
    onAuthStateChange: ReturnType<typeof vi.fn>
  }
  from: ReturnType<typeof vi.fn>
}
const mockSupabase = supabase as unknown as MockSupabase

type Fixture = { data: Array<{ id: string }> | null; error: { code?: string; message?: string } | null }
type EqCall = { table: string; column: string; value: string }

/** Minimal stand-in for a Postgrest query builder: chains, and resolves like a promise. */
class QueryBuilder implements PromiseLike<Fixture> {
  table: string
  fixture: Fixture
  eqLog: EqCall[]
  constructor(table: string, fixture: Fixture, eqLog: EqCall[]) {
    this.table = table
    this.fixture = fixture
    this.eqLog = eqLog
  }
  select(): this {
    return this
  }
  limit(): this {
    return this
  }
  eq(column: string, value: string): this {
    this.eqLog.push({ table: this.table, column, value })
    return this
  }
  then<TResult1 = Fixture, TResult2 = never>(
    onfulfilled?: ((value: Fixture) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.fixture).then(onfulfilled, onrejected)
  }
}

const emptyFixture: Fixture = { data: [], error: null }

type MockSession = { user?: { id: string; email?: string } } | null

let eqLog: EqCall[]
let authChangeCallback: ((event: string, session: MockSession) => void) | null

function mockTables(fixtures: Partial<Record<'clients' | 'project_members' | 'portal_clients', Fixture>>) {
  mockSupabase.from.mockImplementation((table: string) => new QueryBuilder(table, fixtures[table as keyof typeof fixtures] ?? emptyFixture, eqLog))
}

function mockUser(user: { id: string; email?: string } | null) {
  mockSupabase.auth.getUser.mockResolvedValue({ data: { user }, error: null })
}

beforeEach(() => {
  eqLog = []
  authChangeCallback = null
  mockSupabase.auth.getUser.mockReset()
  mockSupabase.from.mockReset()
  mockSupabase.auth.onAuthStateChange.mockReset()
  mockSupabase.auth.onAuthStateChange.mockImplementation((cb: (event: string, session: MockSession) => void) => {
    authChangeCallback = cb
    return { data: { subscription: { unsubscribe: vi.fn() } } }
  })
  mockUser(null)
  mockTables({})
})

describe('resolveRole', () => {
  it('owning any client makes you the owner regardless of other flags', () => {
    expect(resolveRole(true, true, true)).toBe('owner')
  })
  it('owning clients with no membership or portal flag is still the owner', () => {
    expect(resolveRole(true, false, false)).toBe('owner')
  })
  it('a member with no clients is a collaborator, even if also a portal client', () => {
    expect(resolveRole(false, true, true)).toBe('collaborator')
  })
  it('a portal client with nothing else is portal', () => {
    expect(resolveRole(false, false, true)).toBe('portal')
  })
  it('a brand-new account with nothing is owner (freelancer signup path)', () => {
    expect(resolveRole(false, false, false)).toBe('owner')
  })
})

describe('isCollaboratorPath', () => {
  it('allows only timeline and tasks routes', () => {
    expect(COLLABORATOR_PATHS).toEqual(['/timeline', '/tasks'])
    expect(isCollaboratorPath('/timeline')).toBe(true)
    expect(isCollaboratorPath('/tasks')).toBe(true)
    expect(isCollaboratorPath('/')).toBe(false)
    expect(isCollaboratorPath('/invoices')).toBe(false)
    expect(isCollaboratorPath('/time')).toBe(false)
  })
})

describe('useWorkspaceRole', () => {
  it('starts loading, then resolves owner when clients has a row, querying all 3 tables exactly once', async () => {
    mockUser({ id: 'u1', email: 'owner@example.com' })
    mockTables({ clients: { data: [{ id: 'c1' }], error: null } })

    const { result } = renderHook(() => useWorkspaceRole())
    expect(result.current.loading).toBe(true)
    expect(result.current.role).toBe(null)

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.role).toBe('owner')
    expect(mockSupabase.from).toHaveBeenCalledTimes(3)
  })

  it('skips the project_members query (and makes only 2 calls) when the user has no email', async () => {
    mockUser({ id: 'u1a' })
    mockTables({ clients: { data: [{ id: 'c1' }], error: null } })

    const { result } = renderHook(() => useWorkspaceRole())
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.role).toBe('owner')
    expect(mockSupabase.from).toHaveBeenCalledTimes(2)
    expect(eqLog).toEqual([])
  })

  it('resolves collaborator, filtering project_members by the caller\'s own lower-cased email', async () => {
    mockUser({ id: 'u2', email: 'Colleague@Example.com' })
    mockTables({
      clients: emptyFixture,
      project_members: { data: [{ id: 'pm1' }], error: null },
      portal_clients: emptyFixture,
    })

    const { result } = renderHook(() => useWorkspaceRole())
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.role).toBe('collaborator')
    expect(eqLog).toContainEqual({ table: 'project_members', column: 'email', value: 'colleague@example.com' })
    expect(eqLog.some((c) => c.value === 'Colleague@Example.com')).toBe(false)
  })

  it('treats a missing project_members table (PGRST205) as owner silently, but warns on other errors', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    mockUser({ id: 'u3', email: 'x@example.com' })
    mockTables({
      clients: emptyFixture,
      project_members: { data: null, error: { code: 'PGRST205', message: 'table not found' } },
      portal_clients: emptyFixture,
    })
    const { result: missingTable } = renderHook(() => useWorkspaceRole())
    await waitFor(() => expect(missingTable.current.loading).toBe(false))
    expect(missingTable.current.role).toBe('owner')
    expect(warnSpy).not.toHaveBeenCalled()

    mockTables({
      clients: emptyFixture,
      project_members: { data: null, error: { code: 'OTHER', message: 'boom' } },
      portal_clients: emptyFixture,
    })
    const { result: otherError } = renderHook(() => useWorkspaceRole())
    await waitFor(() => expect(otherError.current.loading).toBe(false))
    expect(otherError.current.role).toBe('owner')
    expect(warnSpy).toHaveBeenCalledWith('[useWorkspaceRole]', 'project_members', 'boom')

    warnSpy.mockRestore()
  })

  it('re-classifies when the auth user changes without a remount', async () => {
    mockUser({ id: 'u1', email: 'colleague@example.com' })
    mockTables({
      clients: emptyFixture,
      project_members: { data: [{ id: 'pm1' }], error: null },
      portal_clients: emptyFixture,
    })

    const { result } = renderHook(() => useWorkspaceRole())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.role).toBe('collaborator')

    const callsBefore = mockSupabase.from.mock.calls.length

    mockUser({ id: 'u2', email: 'owner@example.com' })
    mockTables({
      clients: { data: [{ id: 'c1' }], error: null },
      project_members: emptyFixture,
      portal_clients: emptyFixture,
    })

    act(() => {
      authChangeCallback?.('SIGNED_IN', { user: { id: 'u2', email: 'owner@example.com' } })
    })

    await waitFor(() => expect(mockSupabase.from.mock.calls.length).toBeGreaterThan(callsBefore))
    await waitFor(() => expect(result.current.role).toBe('owner'))
  })

  it('does not re-run classification when onAuthStateChange reports the same user id', async () => {
    mockUser({ id: 'u1', email: 'owner@example.com' })
    mockTables({ clients: { data: [{ id: 'c1' }], error: null } })

    const { result } = renderHook(() => useWorkspaceRole())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.role).toBe('owner')
    const callsAfterMount = mockSupabase.from.mock.calls.length

    await act(async () => {
      authChangeCallback?.('TOKEN_REFRESHED', { user: { id: 'u1', email: 'owner@example.com' } })
      await Promise.resolve()
    })

    expect(mockSupabase.from.mock.calls.length).toBe(callsAfterMount)
    expect(result.current.role).toBe('owner')
  })

  it('re-runs classification when onAuthStateChange reports the same user id but a different email', async () => {
    mockUser({ id: 'u1', email: 'owner@example.com' })
    mockTables({ clients: { data: [{ id: 'c1' }], error: null } })

    const { result } = renderHook(() => useWorkspaceRole())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.role).toBe('owner')
    const callsAfterMount = mockSupabase.from.mock.calls.length

    act(() => {
      authChangeCallback?.('USER_UPDATED', { user: { id: 'u1', email: 'renamed@example.com' } })
    })

    await waitFor(() => expect(mockSupabase.from.mock.calls.length).toBeGreaterThan(callsAfterMount))
    expect(result.current.role).toBe('owner')
  })
})
