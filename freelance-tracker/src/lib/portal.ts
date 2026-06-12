/** Row shapes returned by the portal_* database views. Pure module — no React/Supabase. */
export interface PortalClient {
  id: string
  name: string
  company: string | null
}

export interface PortalProject {
  id: string
  client_id: string
  name: string
  description: string | null
  status: string
  start_date: string | null
  end_date: string | null
}

export interface PortalTask {
  id: string
  project_id: string
  title: string
  description: string | null
  status: 'todo' | 'in_progress' | 'done'
  priority: 'low' | 'medium' | 'high'
  start_date: string | null
  due_date: string | null
  updated_at: string | null
}

export interface GroupedTasks {
  todo: PortalTask[]
  in_progress: PortalTask[]
  done: PortalTask[]
}

function byDueThenTitle(a: PortalTask, b: PortalTask): number {
  if (a.due_date && b.due_date && a.due_date !== b.due_date) return a.due_date.localeCompare(b.due_date)
  if (a.due_date && !b.due_date) return -1
  if (!a.due_date && b.due_date) return 1
  return a.title.localeCompare(b.title)
}

export function groupTasksByStatus(tasks: PortalTask[]): GroupedTasks {
  const out: GroupedTasks = { todo: [], in_progress: [], done: [] }
  for (const t of tasks) out[t.status]?.push(t)
  out.todo.sort(byDueThenTitle)
  out.in_progress.sort(byDueThenTitle)
  out.done.sort(byDueThenTitle)
  return out
}

const PROJECT_STATUS_ORDER: Record<string, number> = {
  active: 0,
  completed: 1,
  on_hold: 2,
  cancelled: 3,
}

export function orderProjects(projects: PortalProject[]): PortalProject[] {
  return [...projects].sort((a, b) => {
    const ra = PROJECT_STATUS_ORDER[a.status] ?? 99
    const rb = PROJECT_STATUS_ORDER[b.status] ?? 99
    if (ra !== rb) return ra - rb
    return a.name.localeCompare(b.name)
  })
}
