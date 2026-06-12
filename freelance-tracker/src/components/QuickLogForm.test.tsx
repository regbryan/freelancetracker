import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nProvider } from '../lib/i18n'
import QuickLogForm from './QuickLogForm'
import type { EntryLike } from '../lib/quickLog'

const projects = [
  { id: 'a', name: 'Alpha' },
  { id: 'b', name: 'Beta' },
]

const entries: EntryLike[] = [
  { project_id: 'b', description: 'Homepage copy', hours: 2, date: '2026-06-10', created_at: '2026-06-10T10:00:00Z' },
  { project_id: 'a', description: 'Logo sketches', hours: 1.5, date: '2026-06-08', created_at: '2026-06-08T10:00:00Z' },
]

function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function setup(onSave = vi.fn().mockResolvedValue(undefined)) {
  render(
    <I18nProvider>
      <QuickLogForm projects={projects} entries={entries} onSave={onSave} />
    </I18nProvider>,
  )
  return onSave
}

describe('QuickLogForm', () => {
  it('renders recent-project chips with the most recently used pre-selected', () => {
    setup()
    const chips = screen.getByRole('radiogroup', { name: /project/i })
    const all = within(chips).getAllByRole('radio')
    expect(all[0]).toHaveAccessibleName('Beta') // most recent entry is project b
    expect(all[0]).toBeChecked()
  })

  it('submits with smart defaults: today, billable, rounded hours', async () => {
    const user = userEvent.setup()
    const onSave = setup()
    await user.type(screen.getByRole('combobox', { name: /description/i }), 'New work')
    await user.type(screen.getByRole('spinbutton', { name: /hours/i }), '1.1')
    await user.click(screen.getByRole('button', { name: /^add$/i }))
    expect(onSave).toHaveBeenCalledWith({
      projectId: 'b',
      description: 'New work',
      hours: 1.25,
      date: todayISO(),
      billable: true,
      taskId: null,
    })
  })

  it('clears description and hours but keeps project after save', async () => {
    const user = userEvent.setup()
    setup()
    const desc = screen.getByRole('combobox', { name: /description/i })
    await user.type(desc, 'New work')
    await user.type(screen.getByRole('spinbutton', { name: /hours/i }), '2')
    await user.click(screen.getByRole('button', { name: /^add$/i }))
    expect(desc).toHaveValue('')
    expect(screen.getByRole('radio', { name: 'Beta' })).toBeChecked()
  })

  it('clicking a description suggestion fills description and hours', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByRole('radio', { name: 'Alpha' }))
    await user.click(screen.getByRole('combobox', { name: /description/i }))
    await user.click(await screen.findByRole('option', { name: /logo sketches/i }))
    expect(screen.getByRole('combobox', { name: /description/i })).toHaveValue('Logo sketches')
    expect(screen.getByRole('spinbutton', { name: /hours/i })).toHaveValue(1.5)
  })

  it('shows the error and preserves values when save fails', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn().mockRejectedValue(new Error('boom'))
    setup(onSave)
    const desc = screen.getByRole('combobox', { name: /description/i })
    await user.type(desc, 'Doomed')
    await user.type(screen.getByRole('spinbutton', { name: /hours/i }), '1')
    await user.click(screen.getByRole('button', { name: /^add$/i }))
    expect(await screen.findByText(/boom/)).toBeInTheDocument()
    expect(desc).toHaveValue('Doomed')
  })

  it('sets the date to yesterday via the Yesterday pill', async () => {
    const user = userEvent.setup()
    const onSave = setup()
    await user.click(screen.getByRole('button', { name: /yesterday/i }))
    await user.type(screen.getByRole('combobox', { name: /description/i }), 'Late log')
    await user.type(screen.getByRole('spinbutton', { name: /hours/i }), '1')
    await user.click(screen.getByRole('button', { name: /^add$/i }))
    const d = new Date()
    d.setDate(d.getDate() - 1)
    const yesterdayISO = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    expect(onSave.mock.calls[0][0].date).toBe(yesterdayISO)
  })

  it('shows an empty state when there are no projects', () => {
    render(
      <I18nProvider>
        <QuickLogForm projects={[]} entries={[]} onSave={vi.fn()} />
      </I18nProvider>,
    )
    expect(screen.getByText(/no projects yet/i)).toBeInTheDocument()
  })

  it('navigates suggestions with arrow keys and applies with Enter', async () => {
    const user = userEvent.setup()
    const onSave = setup()
    await user.click(screen.getByRole('radio', { name: 'Alpha' }))
    const desc = screen.getByRole('combobox', { name: /description/i })
    await user.click(desc)
    await screen.findByRole('option', { name: /logo sketches/i })
    await user.keyboard('{ArrowDown}{Enter}')
    expect(desc).toHaveValue('Logo sketches')
    expect(screen.getByRole('spinbutton', { name: /hours/i })).toHaveValue(1.5)
    expect(onSave).not.toHaveBeenCalled() // Enter applied the suggestion, did not submit
  })
})
