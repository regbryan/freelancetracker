import type { ComponentProps } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { I18nProvider } from '../lib/i18n'
import TaskPopover, { type PopoverTask } from './TaskPopover'

const task: PopoverTask = {
  id: 'tp1',
  title: 'Brand audit',
  description: 'Read the last two decks',
  status: 'in_progress',
  priority: 'high',
  assignee: 'courtney@example.com',
  progress: 50,
  estimate_hours: 8,
  start_date: '2026-09-10',
  due_date: '2026-09-12',
  milestone_id: 'm1',
}

const people = [
  { value: 'me', label: 'Reggie Bryant' },
  { value: 'courtney@example.com', label: 'Courtney' },
]

const milestones = [{ id: 'm1', name: 'Discovery' }]

type Props = Partial<ComponentProps<typeof TaskPopover>>

function setup(over: Props = {}) {
  const onSave = vi.fn().mockResolvedValue(undefined)
  const onDelete = vi.fn().mockResolvedValue(undefined)
  const onOpenFull = vi.fn()
  const onClose = vi.fn()
  render(
    <I18nProvider>
      <TaskPopover
        task={task}
        anchorRect={{ left: 120, top: 200, width: 60, height: 16 }}
        people={people}
        milestones={milestones}
        loggedHours={5}
        onSave={onSave}
        onDelete={onDelete}
        onOpenFull={onOpenFull}
        onClose={onClose}
        {...over}
      />
    </I18nProvider>,
  )
  return { onSave, onDelete, onOpenFull, onClose }
}

describe('TaskPopover', () => {
  it('is a dialog named after the task, with every field filled from it', () => {
    setup()
    const panel = screen.getByRole('dialog', { name: 'Brand audit' })
    expect(panel).toBeInTheDocument()
    expect(screen.getByLabelText('Title')).toHaveValue('Brand audit')
    expect(screen.getByLabelText('Status')).toHaveValue('in_progress')
    expect(screen.getByLabelText('Priority')).toHaveValue('high')
    expect(screen.getByLabelText('Assignee')).toHaveValue('courtney@example.com')
    expect(screen.getByLabelText('Progress')).toHaveValue('50')
    expect(screen.getByLabelText('Estimated hours')).toHaveValue(8)
    expect(screen.getByLabelText('Logged hours')).toHaveTextContent('5')
    expect(screen.getByLabelText('Start Date')).toHaveValue('2026-09-10')
    expect(screen.getByLabelText('End Date')).toHaveValue('2026-09-12')
    expect(screen.getByLabelText('Milestone')).toHaveValue('m1')
    expect(screen.getByLabelText('Description')).toHaveValue('Read the last two decks')
  })

  it('moving the slider saves the percentage and the status that goes with it', () => {
    const { onSave } = setup()
    fireEvent.change(screen.getByLabelText('Progress'), { target: { value: '80' } })
    expect(onSave).toHaveBeenCalledWith('tp1', { progress: 80, status: 'in_progress' })
  })

  it('finishing the bar finishes the task', () => {
    const { onSave } = setup()
    fireEvent.change(screen.getByLabelText('Progress'), { target: { value: '100' } })
    expect(onSave).toHaveBeenCalledWith('tp1', { progress: 100, status: 'done' })
  })

  it('pulling a done task back below 100 reopens it', () => {
    const { onSave } = setup({ task: { ...task, status: 'done', progress: 100 } })
    fireEvent.change(screen.getByLabelText('Progress'), { target: { value: '60' } })
    expect(onSave).toHaveBeenCalledWith('tp1', { progress: 60, status: 'in_progress' })
  })

  it('the percentage stays where the thumb was left while the save is in flight', () => {
    setup({ onSave: () => new Promise<void>(() => {}) })
    fireEvent.change(screen.getByLabelText('Progress'), { target: { value: '80' } })
    expect(screen.getByLabelText('Progress')).toHaveValue('80')
    expect(screen.getByLabelText('Percent complete')).toHaveValue(80)
  })

  it('the title saves on blur, not on every keystroke', () => {
    const { onSave } = setup()
    const input = screen.getByLabelText('Title')
    fireEvent.change(input, { target: { value: 'Brand audit v2' } })
    expect(onSave).not.toHaveBeenCalled()
    fireEvent.blur(input)
    expect(onSave).toHaveBeenCalledWith('tp1', { title: 'Brand audit v2' })
  })

  it('a blur that changed nothing writes nothing', () => {
    const { onSave } = setup()
    fireEvent.blur(screen.getByLabelText('Title'))
    fireEvent.blur(screen.getByLabelText('Estimated hours'))
    fireEvent.blur(screen.getByLabelText('Description'))
    expect(onSave).not.toHaveBeenCalled()
  })

  it('the estimate saves on blur, and an emptied field means "not estimated"', () => {
    const { onSave } = setup()
    const input = screen.getByLabelText('Estimated hours')
    fireEvent.change(input, { target: { value: '12.5' } })
    fireEvent.blur(input)
    expect(onSave).toHaveBeenCalledWith('tp1', { estimate_hours: 12.5 })

    fireEvent.change(input, { target: { value: '' } })
    fireEvent.blur(input)
    expect(onSave).toHaveBeenLastCalledWith('tp1', { estimate_hours: null })
  })

  it('the selects and the dates save on change', () => {
    const { onSave } = setup()
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'todo' } })
    expect(onSave).toHaveBeenCalledWith('tp1', { status: 'todo' })
    fireEvent.change(screen.getByLabelText('Priority'), { target: { value: 'low' } })
    expect(onSave).toHaveBeenCalledWith('tp1', { priority: 'low' })
    fireEvent.change(screen.getByLabelText('Assignee'), { target: { value: 'me' } })
    expect(onSave).toHaveBeenCalledWith('tp1', { assignee: 'me' })
    fireEvent.change(screen.getByLabelText('End Date'), { target: { value: '2026-09-20' } })
    expect(onSave).toHaveBeenCalledWith('tp1', { due_date: '2026-09-20' })
    fireEvent.change(screen.getByLabelText('Milestone'), { target: { value: '' } })
    expect(onSave).toHaveBeenCalledWith('tp1', { milestone_id: null })
  })

  it('a rejected save says so on one line inside the panel', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('RLS denied'))
    setup({ onSave })
    fireEvent.change(screen.getByLabelText('Progress'), { target: { value: '80' } })
    expect(onSave).toHaveBeenCalled()
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('RLS denied')
    // The value the user chose stays put; nothing is silently rolled back.
    expect(screen.getByLabelText('Progress')).toHaveValue('80')
  })

  it('Delete confirms first, then closes', async () => {
    const confirm = vi.fn().mockReturnValue(true)
    vi.stubGlobal('confirm', confirm)
    try {
      const { onDelete, onClose } = setup()
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
      expect(confirm).toHaveBeenCalledWith('Delete "Brand audit"? This cannot be undone.')
      await waitFor(() => expect(onDelete).toHaveBeenCalledWith('tp1'))
      await waitFor(() => expect(onClose).toHaveBeenCalled())
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('a refused confirm deletes nothing', () => {
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(false))
    try {
      const { onDelete } = setup()
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
      expect(onDelete).not.toHaveBeenCalled()
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('Open full editor hands the task to the dialog', () => {
    const { onOpenFull } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Open full editor' }))
    expect(onOpenFull).toHaveBeenCalledWith('tp1')
  })

  it('Escape closes it', () => {
    const { onClose } = setup()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('a newly created task opens with its placeholder title selected', async () => {
    setup({ task: { ...task, title: 'New task' }, focusTitle: true })
    await waitFor(() => expect(screen.getByLabelText('Title')).toHaveFocus())
  })

  it('an assignee typed before there was a picker stays selectable', () => {
    setup({ task: { ...task, assignee: 'Jamie at SiFive' } })
    const options = Array.from(screen.getByLabelText('Assignee').querySelectorAll('option'))
    expect(options.map((o) => o.textContent)).toEqual(['Unassigned', 'Reggie Bryant', 'Courtney', 'Jamie at SiFive'])
  })
})
