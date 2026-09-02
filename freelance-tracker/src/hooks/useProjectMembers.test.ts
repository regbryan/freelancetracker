import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}))

import { supabase } from '../lib/supabase'
import { normalizeEmail, useProjectMembers } from './useProjectMembers'

// --- test-only shape of the mocked client; the real client is fully replaced above ---
interface MockSupabase {
  from: ReturnType<typeof vi.fn>
}
const mockSupabase = supabase as unknown as MockSupabase

type Fixture = { data: unknown; error: { code?: string; message?: string } | null }

/** Minimal stand-in for a Postgrest query builder: chains, and resolves like a promise. */
class QueryBuilder implements PromiseLike<Fixture> {
  fixture: Fixture
  insertLog?: unknown[]
  constructor(fixture: Fixture, insertLog?: unknown[]) {
    this.fixture = fixture
    this.insertLog = insertLog
  }
  select(): this {
    return this
  }
  eq(): this {
    return this
  }
  order(): this {
    return this
  }
  insert(payload: unknown): this {
    this.insertLog?.push(payload)
    return this
  }
  delete(): this {
    return this
  }
  single(): this {
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

beforeEach(() => {
  mockSupabase.from.mockReset()
})

describe('normalizeEmail', () => {
  it('trims and lower-cases', () => {
    expect(normalizeEmail('  Colleague@Example.COM ')).toBe('colleague@example.com')
  })
  it('rejects things that are not emails', () => {
    expect(normalizeEmail('')).toBeNull()
    expect(normalizeEmail('nope')).toBeNull()
    expect(normalizeEmail('a@b')).toBeNull()
    expect(normalizeEmail('a b@c.com')).toBeNull()
  })
})

describe('useProjectMembers', () => {
  it('addMember normalizes the email, inserts it, and appends the returned row', async () => {
    const insertLog: unknown[] = []
    const inserted = {
      id: 'm1',
      project_id: 'p1',
      email: 'colleague@example.com',
      role: 'editor',
      created_at: '2026-01-01T00:00:00Z',
    }
    mockSupabase.from
      .mockReturnValueOnce(new QueryBuilder(emptyFixture)) // initial fetch on mount
      .mockReturnValueOnce(new QueryBuilder({ data: inserted, error: null }, insertLog)) // insert

    const { result } = renderHook(() => useProjectMembers('p1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.addMember('  Colleague@Example.com ')
    })

    expect(insertLog).toEqual([{ project_id: 'p1', email: 'colleague@example.com' }])
    expect(result.current.members).toEqual([inserted])
  })

  it('rejects with "duplicate" when the insert fails with a 23505 conflict', async () => {
    mockSupabase.from
      .mockReturnValueOnce(new QueryBuilder(emptyFixture)) // initial fetch on mount
      .mockReturnValueOnce(new QueryBuilder({ data: null, error: { code: '23505', message: 'duplicate key' } }))

    const { result } = renderHook(() => useProjectMembers('p1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await expect(result.current.addMember('dupe@example.com')).rejects.toThrow('duplicate')
  })

  it('removeMember rejects with "failed" and leaves the list unchanged when RLS filters the delete', async () => {
    const existing = {
      id: 'm1',
      project_id: 'p1',
      email: 'a@example.com',
      role: 'editor',
      created_at: '2026-01-01T00:00:00Z',
    }
    mockSupabase.from
      .mockReturnValueOnce(new QueryBuilder({ data: [existing], error: null })) // initial fetch on mount
      .mockReturnValueOnce(new QueryBuilder({ data: [], error: null })) // delete().select('id') returns no rows

    const { result } = renderHook(() => useProjectMembers('p1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.members).toEqual([existing])

    await expect(result.current.removeMember('m1')).rejects.toThrow('failed')
    expect(result.current.members).toEqual([existing])
  })

  it('treats a PGRST205 fetch error (table not yet migrated) as an empty list with no error', async () => {
    mockSupabase.from.mockReturnValueOnce(
      new QueryBuilder({ data: null, error: { code: 'PGRST205', message: 'table not found' } }),
    )

    const { result } = renderHook(() => useProjectMembers('p1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.members).toEqual([])
    expect(result.current.error).toBeNull()
  })
})
