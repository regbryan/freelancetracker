import type { ComponentProps } from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nProvider } from '../lib/i18n'
import MilestoneForm from './MilestoneForm'

type Props = Partial<ComponentProps<typeof MilestoneForm>>

function setup(over: Props = {}) {
  const onSave = vi.fn().mockResolvedValue(undefined)
  const onDelete = vi.fn().mockResolvedValue(undefined)
  const onOpenChange = vi.fn()
  render(
    <I18nProvider>
      <MilestoneForm open onOpenChange={onOpenChange} onSave={onSave} onDelete={onDelete} {...over} />
    </I18nProvider>,
  )
  return { onSave, onDelete, onOpenChange }
}

const existing = { id: 'm1', name: 'Discovery', startDate: '2026-09-03', endDate: '2026-09-10' }
const save = () => screen.getByRole('button', { name: 'Save' })

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('MilestoneForm', () => {
  it('will not save without a name', async () => {
    const user = userEvent.setup()
    const { onSave } = setup()

    expect(screen.getByRole('heading', { name: 'New milestone' })).toBeInTheDocument()
    expect(save()).toBeDisabled()

    await user.type(screen.getByLabelText(/^Name/), 'Discovery')

    expect(save()).toBeEnabled()
    await user.click(save())
    expect(onSave).toHaveBeenCalledWith({ name: 'Discovery', startDate: undefined, endDate: undefined })
  })

  it('refuses an end date before the start date, and says why', async () => {
    const user = userEvent.setup()
    const { onSave } = setup()

    await user.type(screen.getByLabelText(/^Name/), 'Discovery')
    fireEvent.change(screen.getByLabelText('Start'), { target: { value: '2026-09-10' } })
    fireEvent.change(screen.getByLabelText('End'), { target: { value: '2026-09-03' } })

    expect(screen.getByRole('alert')).toHaveTextContent('End date must be on or after the start date')
    expect(save()).toBeDisabled()

    // Equal dates are a one-day milestone, not an error.
    fireEvent.change(screen.getByLabelText('End'), { target: { value: '2026-09-10' } })

    expect(screen.queryByRole('alert')).toBeNull()
    await user.click(save())
    expect(onSave).toHaveBeenCalledWith({ name: 'Discovery', startDate: '2026-09-10', endDate: '2026-09-10' })
  })

  it('edit mode fills the fields and offers Delete behind a confirm', async () => {
    const user = userEvent.setup()
    const { onDelete } = setup({ milestone: existing })

    expect(screen.getByRole('heading', { name: 'Edit milestone' })).toBeInTheDocument()
    expect(screen.getByLabelText(/^Name/)).toHaveValue('Discovery')
    expect(screen.getByLabelText('Start')).toHaveValue('2026-09-03')

    const del = screen.getByRole('button', { name: 'Delete milestone' })
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(false))
    await user.click(del)
    expect(onDelete).not.toHaveBeenCalled()

    const confirmed = vi.fn().mockReturnValue(true)
    vi.stubGlobal('confirm', confirmed)
    await user.click(del)
    expect(confirmed).toHaveBeenCalledWith('Delete milestone "Discovery"? Its tasks are kept and unassigned.')
    expect(onDelete).toHaveBeenCalledWith('m1')
  })

  it('creating offers no Delete', () => {
    setup()
    expect(screen.queryByRole('button', { name: 'Delete milestone' })).toBeNull()
  })

  it('a rejected save keeps the dialog open with the typed values', async () => {
    const user = userEvent.setup()
    const { onOpenChange } = setup({ onSave: vi.fn().mockRejectedValue(new Error('RLS denied')) })

    await user.type(screen.getByLabelText(/^Name/), 'Discovery')
    await user.click(save())

    expect(onOpenChange).not.toHaveBeenCalled()
    expect(screen.getByLabelText(/^Name/)).toHaveValue('Discovery')
  })
})
