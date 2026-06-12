import { useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import QuickLogForm from './QuickLogForm'
import { useProjects } from '../hooks/useProjects'
import { useTimeEntries } from '../hooks/useTimeEntries'
import { useI18n } from '../lib/i18n'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Global "log time from anywhere" dialog (Ctrl+Shift+L / command palette). */
export default function QuickLogDialog({ open, onOpenChange }: Props) {
  const { t } = useI18n()
  const { projects } = useProjects()
  const { entries, createEntry, refetch } = useTimeEntries()

  // This instance is mounted app-wide; entries logged elsewhere (e.g. the Time
  // page's own hook instance) would otherwise never reach its suggestions.
  useEffect(() => {
    if (open) refetch()
  }, [open, refetch])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-2xl p-6"
        onEscapeKeyDown={(e) => {
          // Radix handles Esc in the capture phase. When the description
          // field's suggestion list is open (aria-expanded), keep the dialog
          // up and let the form's own Esc handler dismiss the list instead.
          const target = e.target as HTMLElement | null
          if (target?.getAttribute('aria-expanded') === 'true') e.preventDefault()
        }}
      >
        <DialogHeader>
          <DialogTitle className="text-[16px]">{t('quickLog.title')}</DialogTitle>
        </DialogHeader>
        <QuickLogForm
          projects={projects.map((p) => ({ id: p.id, name: p.name }))}
          entries={entries}
          autoFocus
          onSave={async (data) => {
            await createEntry({
              project_id: data.projectId,
              description: data.description,
              hours: data.hours,
              date: data.date,
              billable: data.billable,
              task_id: data.taskId,
              invoice_id: null,
            })
          }}
          onSaved={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
