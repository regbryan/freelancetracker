import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}))

import { supabase } from '../lib/supabase'
import { useMilestones } from './useMilestones'

// --- test-only shape of the mocked client; the real client is fully replaced above ---
interface MockSupabase {
  from: ReturnType<typeof vi.fn>
}
const mockSupabase = supabase as unknown as MockSupabase

type Fixture = { data: unknown; error: { code?: string; message?: string } | null }

/** Minimal stand-in for a Postgrest query builder: chains, and resolves like a promise. */
class QueryBuilder implements PromiseLike<Fixture> {
  fixture: Fixture
  payloadLog?: unknown[]
  constructor(fixture: Fixture, payloadLog?: unknown[]) {
    this.fixture = fixture
    this.payloadLog = payloadLog
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
    this.payloadLog?.push(payload)
    return this
  }
  update(payload: unknown): this {
    this.payloadLog?.push(payload)
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

const discovery = {
  id: 'ms1',
  project_id: 'p1',
  name: 'Discovery',
  start_date: '2026-09-01',
  end_date: '2026-09-30',
  sort_order: 0,
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z',
}

beforeEach(() => {
  mockSupabase.from.mockReset()
})

describe('useMilestones', () => {
  it('createMilestone inserts the payload and appends the returned row', async () => {
    const payloadLog: unknown[] = []
    mockSupabase.from
      .mockReturnValueOnce(new QueryBuilder(emptyFixture)) // initial fetch on mount
      .mockReturnValueOnce(new QueryBuilder({ data: discovery, error: null }, payloadLog)) // insert

    const { result } = renderHook(() => useMilestones('p1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.createMilestone({
        project_id: 'p1',
        name: 'Discovery',
        start_date: '2026-09-01',
        end_date: '2026-09-30',
      })
    })

    expect(payloadLog).toEqual([
      { project_id: 'p1', name: 'Discovery', start_date: '2026-09-01', end_date: '2026-09-30' },
    ])
    expect(result.current.milestones).toEqual([discovery])
  })

  it('updateMilestone sends updated_at and replaces the row in place', async () => {
    const payloadLog: unknown[] = []
    const renamed = { ...discovery, name: 'Discovery & scoping', updated_at: '2026-09-05T00:00:00Z' }
    mockSupabase.from
      .mockReturnValueOnce(new QueryBuilder({ data: [discovery], error: null })) // initial fetch
      .mockReturnValueOnce(new QueryBuilder({ data: renamed, error: null }, payloadLog)) // update

    const { result } = renderHook(() => useMilestones('p1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.updateMilestone('ms1', { name: 'Discovery & scoping' })
    })

    expect(payloadLog).toHaveLength(1)
    const sent = payloadLog[0] as { name: string; updated_at: string }
    expect(sent.name).toBe('Discovery & scoping')
    expect(typeof sent.updated_at).toBe('string')
    expect(result.current.milestones).toEqual([renamed])
  })

  it('deleteMilestone rejects with "failed" and keeps the list when RLS filters the delete', async () => {
    mockSupabase.from
      .mockReturnValueOnce(new QueryBuilder({ data: [discovery], error: null })) // initial fetch
      .mockReturnValueOnce(new QueryBuilder({ data: [], error: null })) // delete().select('id') returns no rows

    const { result } = renderHook(() => useMilestones('p1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.milestones).toEqual([discovery])

    await expect(result.current.deleteMilestone('ms1')).rejects.toThrow('failed')
    expect(result.current.milestones).toEqual([discovery])
  })

  it('deleteMilestone drops the row when the delete returns it', async () => {
    mockSupabase.from
      .mockReturnValueOnce(new QueryBuilder({ data: [discovery], error: null })) // initial fetch
      .mockReturnValueOnce(new QueryBuilder({ data: [{ id: 'ms1' }], error: null })) // delete

    const { result } = renderHook(() => useMilestones('p1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.deleteMilestone('ms1')
    })

    expect(result.current.milestones).toEqual([])
  })

  it('treats a PGRST205 fetch error (view not yet migrated) as an empty list with no error', async () => {
    mockSupabase.from.mockReturnValueOnce(
      new QueryBuilder({ data: null, error: { code: 'PGRST205', message: 'relation not found' } }),
    )

    const { result } = renderHook(() => useMilestones('p1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.milestones).toEqual([])
    expect(result.current.error).toBeNull()
  })

  it('fetches every milestone when no project id is given', async () => {
    mockSupabase.from.mockReturnValueOnce(new QueryBuilder({ data: [discovery], error: null }))

    const { result } = renderHook(() => useMilestones())
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(mockSupabase.from).toHaveBeenCalledWith('milestones')
    expect(result.current.milestones).toEqual([discovery])
  })
})
