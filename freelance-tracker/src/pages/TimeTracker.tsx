import { useState, useCallback, useMemo } from 'react'
import { useTimeEntries } from '../hooks/useTimeEntries'
import { useProjects } from '../hooks/useProjects'
import Timer from '../components/Timer'
import TimeEntryForm from '../components/TimeEntryForm'
import TimeEntryList from '../components/TimeEntryList'
import TimeEntryEditDialog from '../components/TimeEntryEditDialog'
import CuratorInsight from '../components/CuratorInsight'
import type { TimeEntry as ListTimeEntry } from '../components/TimeEntryList'
import { useI18n } from '../lib/i18n'

export default function TimeTracker() {
  const { t, lang } = useI18n()
  const { entries, loading, error, createEntry, updateEntry, deleteEntry, refetch } = useTimeEntries()
  const { projects, loading: projectsLoading } = useProjects()
  const [showManualForm, setShowManualForm] = useState(false)
  const [dateRange, setDateRange] = useState<'7' | '30' | 'all'>('all')
  const [editingEntry, setEditingEntry] = useState<ListTimeEntry | null>(null)

  const projectList = projects.map((p) => ({ id: p.id, name: p.name }))

  // Build a lookup map for project names
  const projectNameMap = new Map(projects.map((p) => [p.id, p.name]))

  const handleTimerSave = useCallback(
    async (data: { projectId: string; description: string; hours: number; date: string }) => {
      await createEntry({
        project_id: data.projectId,
        description: data.description,
        hours: data.hours,
        date: data.date,
        billable: true,
        invoice_id: null,
      })
    },
    [createEntry],
  )

  const handleManualSave = useCallback(
    async (data: { projectId: string; description: string; hours: number; date: string; billable: boolean }) => {
      await createEntry({
        project_id: data.projectId,
        description: data.description,
        hours: data.hours,
        date: data.date,
        billable: data.billable,
        invoice_id: null,
      })
    },
    [createEntry],
  )

  // Map from Supabase snake_case to the component's camelCase interface
  const mappedEntries: ListTimeEntry[] = entries.map((e) => ({
    id: e.id,
    projectId: e.project_id,
    description: e.description ?? '',
    hours: e.hours,
    date: e.date,
    billable: e.billable,
  }))

  const formatDate = useCallback((iso: string): string => {
    const d = new Date(iso + 'T00:00:00')
    return d.toLocaleDateString(lang === 'es' ? 'es-ES' : 'en-US', { month: 'short', day: 'numeric' })
  }, [lang])

  const filteredEntries = useMemo(() => {
    if (dateRange === 'all') return mappedEntries
    const now = new Date()
    const daysAgo = parseInt(dateRange, 10)
    const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo)
    return mappedEntries.filter((e) => new Date(e.date + 'T00:00:00') >= cutoff)
  }, [mappedEntries, dateRange])

  const handleEdit = useCallback((entry: ListTimeEntry) => {
    setEditingEntry(entry)
  }, [])

  const handleEditSave = useCallback(
    async (id: string, data: { description: string; hours: number; date: string; billable: boolean }) => {
      await updateEntry(id, {
        description: data.description,
        hours: data.hours,
        date: data.date,
        billable: data.billable,
      })
      setEditingEntry(null)
    },
    [updateEntry],
  )

  const handleClone = useCallback(
    async (entry: ListTimeEntry) => {
      await createEntry({
        project_id: entry.projectId,
        description: entry.description,
        hours: entry.hours,
        date: new Date().toISOString().split('T')[0],
        billable: entry.billable,
        invoice_id: null,
      })
    },
    [createEntry],
  )

  const handleDelete = useCallback(
    async (id: string) => {
      await deleteEntry(id)
    },
    [deleteEntry],
  )

  const isLoading = loading || projectsLoading

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-accent text-[11px] font-semibold uppercase tracking-[1.5px]">{t('timeTracker.tracking')}</p>
        <h2 className="text-text-primary text-[20px] font-bold tracking-[-0.3px] mt-1">{t('timeTracker.title')}</h2>
      </div>

      {/* Curator's Insight */}
      <CuratorInsight projects={projects} entries={entries} />

      {/* Timer Widget */}
      <Timer projects={projectList} onSave={handleTimerSave} />

      {/* Toggle for manual entry form */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setShowManualForm((prev) => !prev)}
          className="text-accent text-[12px] font-semibold hover:underline transition-all"
        >
          {showManualForm ? t('timeTracker.hideManual') : t('timeTracker.addManual')}
        </button>
      </div>

      {/* Manual Entry Form */}
      {showManualForm && (
        <TimeEntryForm projects={projectList} onSave={handleManualSave} />
      )}

      {/* Error state */}
      {error && (
        <div className="bg-negative-bg rounded-[14px] p-4 text-negative text-[12px]">
          {t('timeTracker.failedToLoad', { error: String(error) })}
          <button
            onClick={refetch}
            className="ml-3 underline font-semibold"
          >
            {t('timeTracker.retry')}
          </button>
        </div>
      )}

      {/* Recent Entries */}
      <div>
        <div className="mb-3 flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-text-primary text-[14px] font-bold">{t('timeTracker.recentEntries')}</h3>
          <div className="flex items-center gap-1.5">
            {(['7', '30', 'all'] as const).map((value) => {
              const label = value === '7' ? t('timeTracker.last7') : value === '30' ? t('timeTracker.last30') : t('timeTracker.allTime')
              const isActive = dateRange === value
              return (
                <button
                  key={value}
                  onClick={() => setDateRange(value)}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all ${
                    isActive
                      ? 'bg-accent text-white shadow-sm'
                      : 'bg-input-bg text-text-muted hover:text-text-primary hover:bg-border'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>

        {isLoading ? (
          <div className="bg-surface rounded-[14px] shadow-card p-8 flex items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              <p className="text-text-muted text-[12px]">{t('timeTracker.loadingEntries')}</p>
            </div>
          </div>
        ) : (
          <>
            {/* Show project name in a custom wrapper when not filtered by project */}
            {filteredEntries.length === 0 ? (
              <div className="bg-surface rounded-[14px] shadow-card p-8 flex items-center justify-center">
                <p className="text-text-muted text-[13px]">
                  {t('timeTracker.noEntries')}
                </p>
              </div>
            ) : (
              <div className="bg-surface rounded-[14px] shadow-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[600px]">
                    <thead>
                      <tr className="text-[10px] text-text-muted font-semibold uppercase tracking-wide border-b border-border">
                        <th className="text-left px-5 py-3">{t('timeTracker.colDate')}</th>
                        <th className="text-left px-3 py-3">{t('timeTracker.colProject')}</th>
                        <th className="text-left px-3 py-3">{t('timeTracker.colDescription')}</th>
                        <th className="text-right px-3 py-3">{t('timeTracker.colHours')}</th>
                        <th className="text-center px-3 py-3">{t('timeTracker.colBillable')}</th>
                        <th className="text-right px-5 py-3">{t('timeTracker.colActions')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredEntries.map((entry) => (
                        <tr
                          key={entry.id}
                          className="border-b border-border/50 last:border-0 hover:bg-input-bg/50 transition-colors"
                        >
                          <td className="px-5 py-3 text-text-muted text-[12px]">
                            {formatDate(entry.date)}
                          </td>
                          <td className="px-3 py-3 text-accent text-[12px] font-semibold">
                            {projectNameMap.get(entry.projectId) ?? t('timeTracker.unknown')}
                          </td>
                          <td className="px-3 py-3 text-text-secondary text-[12px]">
                            {entry.description}
                          </td>
                          <td className="px-3 py-3 text-text-primary text-[12px] font-bold text-right">
                            {entry.hours.toFixed(2)}
                          </td>
                          <td className="px-3 py-3 text-center">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                entry.billable
                                  ? 'bg-status-active-bg text-status-active-text'
                                  : 'bg-status-completed-bg text-status-completed-text'
                              }`}
                            >
                              {entry.billable ? t('timeTracker.yes') : t('timeTracker.no')}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => handleClone(entry)}
                                className="p-1.5 rounded hover:bg-border transition-colors"
                                aria-label={t('timeTracker.cloneEntry')}
                                title={t('timeTracker.cloneToToday')}
                              >
                                <svg
                                  width="12"
                                  height="12"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  className="text-text-muted"
                                >
                                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                </svg>
                              </button>
                              <button
                                onClick={() => handleEdit(entry)}
                                className="p-1.5 rounded hover:bg-border transition-colors"
                                aria-label={t('timeTracker.editEntry')}
                              >
                                <svg
                                  width="12"
                                  height="12"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  className="text-accent"
                                >
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => handleDelete(entry.id)}
                                className="p-1.5 rounded hover:bg-border transition-colors"
                                aria-label={t('timeTracker.deleteEntry')}
                              >
                                <svg
                                  width="12"
                                  height="12"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  className="text-negative"
                                >
                                  <polyline points="3 6 5 6 21 6" />
                                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Edit Time Entry Dialog */}
      <TimeEntryEditDialog
        open={!!editingEntry}
        onOpenChange={(open) => { if (!open) setEditingEntry(null) }}
        entry={editingEntry}
        onSave={handleEditSave}
      />
    </div>
  )
}
