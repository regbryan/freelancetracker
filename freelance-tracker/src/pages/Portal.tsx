import { useMemo } from 'react'
import { Loader2 } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { usePortalData } from '../hooks/usePortalData'
import { groupTasksByStatus, orderProjects, type PortalTask } from '../lib/portal'
import PortalLayout from '../components/PortalLayout'
import { useI18n } from '../lib/i18n'

const PRIORITY_TONE: Record<PortalTask['priority'], string> = {
  high: 'bg-negative-bg text-negative',
  medium: 'bg-status-active-bg text-status-active-text',
  low: 'bg-input-bg text-text-muted',
}

const PROJECT_STATUS_KEY: Record<string, string> = {
  active: 'status.active',
  completed: 'status.completed',
  on_hold: 'status.onHold',
  cancelled: 'status.cancelled',
}

export default function Portal() {
  const { t, lang } = useI18n()
  const { user } = useAuth()
  const { clients, projects, tasks, loading, error, refetch } = usePortalData()

  const ordered = useMemo(() => orderProjects(projects), [projects])
  const tasksByProject = useMemo(() => {
    const map = new Map<string, PortalTask[]>()
    for (const task of tasks) {
      const list = map.get(task.project_id) ?? []
      list.push(task)
      map.set(task.project_id, list)
    }
    return map
  }, [tasks])

  function formatDate(iso: string): string {
    return new Date(iso + 'T00:00:00').toLocaleDateString(lang === 'es' ? 'es-ES' : 'en-US', {
      month: 'short',
      day: 'numeric',
    })
  }

  if (loading) {
    return (
      <PortalLayout>
        <div className="min-h-[40vh] flex items-center justify-center">
          <Loader2 size={20} className="animate-spin text-accent" />
        </div>
      </PortalLayout>
    )
  }

  if (error) {
    return (
      <PortalLayout>
        <div className="bg-negative-bg rounded-[14px] p-4 text-negative text-[12px]">
          {t('portal.failedToLoad', { error })}
          <button onClick={refetch} className="ml-3 underline font-semibold">
            {t('portal.retry')}
          </button>
        </div>
      </PortalLayout>
    )
  }

  if (clients.length === 0) {
    return (
      <PortalLayout>
        <div className="max-w-sm mx-auto mt-[8vh] bg-surface rounded-[14px] shadow-card p-6 text-center">
          <h1 className="text-text-primary text-[15px] font-bold mb-2">{t('portal.noAccessTitle')}</h1>
          <p className="text-text-muted text-[12px]">
            {t('portal.noAccessBody', { email: user?.email ?? '' })}
          </p>
        </div>
      </PortalLayout>
    )
  }

  const clientName = clients[0].company ?? clients[0].name

  const TASK_GROUPS: { key: keyof ReturnType<typeof groupTasksByStatus>; label: string }[] = [
    { key: 'todo', label: t('status.todo') },
    { key: 'in_progress', label: t('status.inProgress') },
    { key: 'done', label: t('status.done') },
  ]

  return (
    <PortalLayout clientName={clientName}>
      <h1 className="text-text-primary text-[18px] font-bold mb-1">
        {t('portal.greeting', { name: clients[0].name })}
      </h1>
      <p className="text-accent text-[11px] font-semibold uppercase tracking-[1.5px] mb-5">
        {t('portal.yourProjects')}
      </p>

      {ordered.length === 0 && (
        <div className="bg-surface rounded-[14px] shadow-card p-8 text-center text-text-muted text-[13px]">
          {t('portal.noProjects')}
        </div>
      )}

      <div className="flex flex-col gap-5">
        {ordered.map((project) => {
          const grouped = groupTasksByStatus(tasksByProject.get(project.id) ?? [])
          const total = (tasksByProject.get(project.id) ?? []).length
          const muted = project.status !== 'active'
          return (
            <section
              key={project.id}
              className={`bg-surface rounded-[14px] shadow-card p-5 ${muted ? 'opacity-70' : ''}`}
            >
              <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
                <h2 className="text-text-primary text-[15px] font-bold">{project.name}</h2>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-status-active-bg text-status-active-text">
                  {t(PROJECT_STATUS_KEY[project.status] ?? 'status.active')}
                </span>
              </div>
              {project.description && (
                <p className="text-text-muted text-[12px] mb-3">{project.description}</p>
              )}
              {total === 0 ? (
                <p className="text-text-muted text-[12px] py-2">{t('portal.noTasks')}</p>
              ) : (
                <div className="flex flex-col gap-3 mt-2">
                  {TASK_GROUPS.map(({ key, label }) =>
                    grouped[key].length === 0 ? null : (
                      <div key={key}>
                        <h3 className="text-[10px] font-semibold uppercase tracking-wide text-text-muted mb-1.5">
                          {label} · {grouped[key].length}
                        </h3>
                        <ul className="flex flex-col gap-1.5">
                          {grouped[key].map((task) => (
                            <li
                              key={task.id}
                              className="flex items-center justify-between gap-3 bg-input-bg/50 rounded-[10px] px-3 py-2"
                            >
                              <span className={`text-[12px] ${key === 'done' ? 'text-text-muted line-through' : 'text-text-primary'}`}>
                                {task.title}
                              </span>
                              <span className="flex items-center gap-2 shrink-0">
                                {task.due_date && key !== 'done' && (
                                  <span className="text-text-muted text-[10px]">
                                    {t('portal.due', { date: formatDate(task.due_date) })}
                                  </span>
                                )}
                                <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-semibold uppercase ${PRIORITY_TONE[task.priority]}`}>
                                  {task.priority}
                                </span>
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ),
                  )}
                </div>
              )}
            </section>
          )
        })}
      </div>
    </PortalLayout>
  )
}
