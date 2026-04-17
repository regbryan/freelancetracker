import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Clock,
  DollarSign,
  FolderKanban,
  TrendingUp,
  Timer,
  BookOpen,
  Calendar,
  Loader2,
  Receipt,
  CheckSquare,
  Circle,
  AlertTriangle,
} from 'lucide-react'
import StatCard from '../components/StatCard'
import LineChart from '../components/charts/LineChart'
import DonutChart from '../components/charts/DonutChart'
import BarChart from '../components/charts/BarChart'
import { useClients } from '../hooks/useClients'
import { useProjects } from '../hooks/useProjects'
import { useTimeEntries } from '../hooks/useTimeEntries'
import { useInvoices } from '../hooks/useInvoices'
import { useExpenses } from '../hooks/useExpenses'
import { useTasks } from '../hooks/useTasks'
import { useMeetingNotes } from '../hooks/useMeetingNotes'

const CHART_COLORS = ['#0058be', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899']

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const STATUS_LABELS: Record<string, { label: string; style: string }> = {
  active: { label: 'Active', style: 'bg-status-active-bg text-status-active-text' },
  completed: { label: 'Completed', style: 'bg-status-completed-bg text-status-completed-text' },
  on_hold: { label: 'On Hold', style: 'bg-status-hold-bg text-status-hold-text' },
  cancelled: { label: 'Cancelled', style: 'bg-status-completed-bg text-status-completed-text' },
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { projects, loading: pLoading } = useProjects()
  const { entries, loading: tLoading } = useTimeEntries()
  const { invoices, loading: iLoading } = useInvoices()
  const { expenses, loading: expLoading } = useExpenses()
  const { tasks, loading: taskLoading } = useTasks()
  const { meetingNotes, loading: mnLoading } = useMeetingNotes()

  const [profileName] = useState(() => {
    try {
      const raw = localStorage.getItem('freelancer_profile')
      if (raw) {
        const p = JSON.parse(raw)
        return p.name?.split(' ')[0] || 'there'
      }
    } catch { /* ignore */ }
    return 'there'
  })
  const { clients, loading: cLoading } = useClients()

  const loading = pLoading || tLoading || iLoading || cLoading || expLoading || taskLoading || mnLoading

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0)
  const pendingTasks = tasks.filter((t) => t.status !== 'done').length

  // Compute stats from real data
  const unbilledHours = entries
    .filter(e => e.billable && !e.invoice_id)
    .reduce((sum, e) => sum + e.hours, 0)

  const pendingInvoiceAmount = invoices
    .filter(i => i.status === 'draft' || i.status === 'sent')
    .reduce((sum, i) => sum + i.total, 0)

  const activeProjectCount = projects.filter(p => p.status === 'active').length

  const totalRevenue = invoices
    .filter(i => i.status === 'paid')
    .reduce((sum, i) => sum + i.total, 0)

  // Recent time entries with project info
  const projectMap = new Map(projects.map(p => [p.id, p]))
  const recentEntries = entries.slice(0, 4).map(e => {
    const proj = projectMap.get(e.project_id)
    return {
      project: proj?.name ?? 'Unknown',
      status: proj?.status ?? 'active',
      hours: e.hours.toFixed(2),
      rate: proj?.hourly_rate ? `$${(e.hours * proj.hourly_rate).toFixed(0)}` : '-',
    }
  })

  // Top projects by hours
  const projectHours = new Map<string, number>()
  for (const e of entries) {
    projectHours.set(e.project_id, (projectHours.get(e.project_id) || 0) + e.hours)
  }
  const topProjects = projects
    .map(p => ({ name: p.name, hours: projectHours.get(p.id) || 0 }))
    .sort((a, b) => b.hours - a.hours)
    .slice(0, 2)
  const maxHours = Math.max(...topProjects.map(p => p.hours), 1)

  // --- Line Chart: Hours Tracked (last 30 days, ~7 buckets) ---
  const lineChartData = useMemo(() => {
    const now = new Date()
    const thirtyDaysAgo = new Date(now)
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    // Create 7 bucket boundaries spanning 30 days
    const bucketCount = 7
    const bucketSize = 30 / bucketCount
    const labels: string[] = []
    const billable: number[] = []
    const nonBillable: number[] = []
    const totals: number[] = []

    for (let b = 0; b < bucketCount; b++) {
      const bucketStart = new Date(thirtyDaysAgo)
      bucketStart.setDate(bucketStart.getDate() + Math.round(b * bucketSize))
      const bucketEnd = new Date(thirtyDaysAgo)
      bucketEnd.setDate(bucketEnd.getDate() + Math.round((b + 1) * bucketSize))

      labels.push(
        `${MONTH_LABELS[bucketStart.getMonth()]} ${bucketStart.getDate()}`
      )

      let bHours = 0
      let nbHours = 0
      for (const e of entries) {
        const d = new Date(e.date)
        if (d >= bucketStart && d < bucketEnd) {
          if (e.billable) {
            bHours += e.hours
          } else {
            nbHours += e.hours
          }
        }
      }
      billable.push(Math.round(bHours * 10) / 10)
      nonBillable.push(Math.round(nbHours * 10) / 10)
      totals.push(Math.round((bHours + nbHours) * 10) / 10)
    }

    return {
      labels,
      series: [
        { name: 'Billable', color: '#0058be', values: billable },
        { name: 'Non-billable', color: '#10b981', values: nonBillable },
        { name: 'Total', color: '#f59e0b', values: totals },
      ],
    }
  }, [entries])

  // --- Donut Chart: Projects by type ---
  const donutData = useMemo(() => {
    const countByType = new Map<string, number>()
    for (const p of projects) {
      const label = p.type || 'Uncategorized'
      countByType.set(label, (countByType.get(label) || 0) + 1)
    }

    if (countByType.size === 0) {
      return [{ label: 'No data', value: 1, color: CHART_COLORS[0] }]
    }

    const sorted = [...countByType.entries()]
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)

    return sorted.map((item, i) => ({
      label: item.type,
      value: item.count,
      color: CHART_COLORS[i % CHART_COLORS.length],
    }))
  }, [projects])

  // Donut center: show the top type
  const donutCenter = useMemo(() => {
    if (donutData.length === 0 || (donutData.length === 1 && donutData[0].label === 'No data')) {
      return { label: 'No data', value: '0' }
    }
    const total = donutData.reduce((s, d) => s + d.value, 0)
    const top = donutData[0]
    return {
      label: top.label,
      value: `${top.value}/${total}`,
    }
  }, [donutData])

  // --- Bar Chart: Revenue Growth (paid invoices, last 6 months) ---
  const barChartData = useMemo(() => {
    const now = new Date()
    const months: { label: string; value: number }[] = []

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const year = d.getFullYear()
      const month = d.getMonth()
      const label = MONTH_LABELS[month]

      let total = 0
      for (const inv of invoices) {
        if (inv.status !== 'paid') continue
        // Use issued_date if available, otherwise created_at
        const invDate = new Date(inv.issued_date || inv.created_at)
        if (invDate.getFullYear() === year && invDate.getMonth() === month) {
          total += inv.total
        }
      }
      months.push({ label, value: Math.round(total) })
    }

    return months
  }, [invoices])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-32">
        <Loader2 size={28} className="animate-spin text-accent" />
        <p className="text-text-muted text-[13px]">Loading dashboard...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Row 1: Welcome */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h2 className="text-text-primary text-[20px] font-bold tracking-[-0.3px]">
            Welcome back, {profileName}!
          </h2>
          <p className="text-text-muted text-[12px] mt-0.5">
            Here's what's happening today.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => navigate('/time')}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-white text-[12px] font-semibold hover:opacity-90 transition-all active:scale-[0.98]"
            style={{ background: 'linear-gradient(135deg, #0058be 0%, #2170e4 100%)' }}
          >
            <Timer size={12} />
            Log Time
          </button>
        </div>
      </div>

      {/* Row 2: Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        <StatCard icon={Clock} label="Unbilled Hours" value={unbilledHours.toFixed(2)} trend={0} trendLabel="" />
        <StatCard icon={DollarSign} label="Pending Invoices" value={`$${pendingInvoiceAmount.toLocaleString()}`} trend={0} trendLabel="" />
        <StatCard icon={FolderKanban} label="Active Projects" value={String(activeProjectCount)} trend={0} trendLabel="" />
        <StatCard icon={TrendingUp} label="Revenue" value={`$${totalRevenue.toLocaleString()}`} trend={0} trendLabel="" />
        <StatCard icon={Receipt} label="Expenses" value={`$${totalExpenses.toLocaleString()}`} trend={0} trendLabel="" />
        <StatCard icon={CheckSquare} label="Pending Tasks" value={String(pendingTasks)} trend={0} trendLabel="" />
      </div>

      {/* Row 3: To-Do Dashboard */}
      {(() => {
        const today = new Date().toDateString()
        const activeTasks = tasks
          .filter(t => t.status !== 'done')
          .sort((a, b) => {
            if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date)
            if (a.due_date) return -1
            if (b.due_date) return 1
            return 0
          })

        // Group by due_date (YYYY-MM-DD key), tasks with no due date go to 'none'
        const groups: { key: string; label: string; isOverdueGroup: boolean; tasks: typeof activeTasks }[] = []
        const seen = new Set<string>()
        for (const t of activeTasks) {
          const key = t.due_date ?? 'none'
          if (!seen.has(key)) {
            seen.add(key)
            let label = 'No Due Date'
            let isOverdueGroup = false
            if (t.due_date) {
              const d = new Date(t.due_date + 'T00:00:00')
              const isToday = d.toDateString() === today
              const isPast = d < new Date(today)
              isOverdueGroup = isPast && !isToday
              label = isToday
                ? 'Today'
                : d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
            }
            groups.push({ key, label, isOverdueGroup, tasks: [] })
          }
          groups.find(g => g.key === key)!.tasks.push(t)
        }

        return (
          <div className="bg-surface rounded-xl border border-border-accent shadow-card flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h3 className="text-text-primary text-[14px] font-bold flex items-center gap-2">
                <CheckSquare size={15} className="text-accent" />
                To-Do
              </h3>
              {tasks.length > 0 && (
                <div className="flex items-center gap-2">
                  <div className="w-24 h-1.5 bg-border rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.round((tasks.filter(t => t.status === 'done').length / tasks.length) * 100)}%`,
                        background: tasks.filter(t => t.status === 'done').length === tasks.length ? '#10b981' : 'linear-gradient(90deg, #0058be, #2170e4)',
                      }}
                    />
                  </div>
                  <span className="text-text-muted text-[11px]">
                    {tasks.filter(t => t.status === 'done').length}/{tasks.length} done
                  </span>
                </div>
              )}
            </div>

            {/* Column headers */}
            <div className="grid grid-cols-[1fr_150px_120px_90px] border-b border-border bg-input-bg/50 px-5 py-2">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">Task</span>
              <span className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">Project</span>
              <span className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">Status</span>
              <span className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">Due</span>
            </div>

            {/* Grouped rows */}
            <div className="flex flex-col max-h-[400px] overflow-y-auto">
              {activeTasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2">
                  <CheckSquare size={24} className="text-text-muted/30" />
                  <p className="text-text-muted text-[12px]">
                    {tasks.length === 0 ? 'No tasks yet' : 'All tasks complete!'}
                  </p>
                </div>
              ) : (
                groups.map(group => (
                  <div key={group.key}>
                    {/* Group header */}
                    <div className={`flex items-center gap-2 px-5 py-1.5 border-b border-border ${group.isOverdueGroup ? 'bg-negative/5' : 'bg-input-bg/30'}`}>
                      <span className={`w-2 h-2 rounded-full shrink-0 ${group.isOverdueGroup ? 'bg-negative' : group.key === 'none' ? 'bg-border' : 'bg-accent'}`} />
                      <span className={`text-[11px] font-semibold ${group.isOverdueGroup ? 'text-negative' : 'text-text-secondary'}`}>
                        {group.label}
                      </span>
                      <span className="text-[10px] text-text-muted ml-1">{group.tasks.length}</span>
                    </div>

                    {/* Tasks in group */}
                    {group.tasks.map(task => {
                      const proj = projectMap.get(task.project_id)
                      const isOverdue = group.isOverdueGroup
                      return (
                        <button
                          key={task.id}
                          onClick={() => proj ? navigate(`/projects/${proj.id}`) : undefined}
                          className="grid grid-cols-[1fr_150px_120px_90px] items-center px-5 py-2.5 hover:bg-input-bg/40 transition-colors text-left group w-full border-b border-border/40 last:border-0"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Circle size={12} className="text-border shrink-0 group-hover:text-accent transition-colors" strokeWidth={2} />
                            <span className={`text-[12px] font-medium truncate ${isOverdue ? 'text-negative' : 'text-text-primary'}`}>{task.title}</span>
                          </div>
                          <span className="text-text-muted text-[11px] truncate pr-3">{proj?.name ?? '—'}</span>
                          <div>
                            {task.status === 'in_progress' && (
                              <span className="inline-block px-2 py-0.5 text-[10px] font-semibold rounded bg-status-scheduled-bg text-status-scheduled-text">In Progress</span>
                            )}
                            {task.status === 'todo' && (
                              <span className="inline-block px-2 py-0.5 text-[10px] font-semibold rounded bg-input-bg text-text-muted border border-border">To Do</span>
                            )}
                          </div>
                          <div>
                            {task.due_date ? (
                              <span className={`text-[11px] flex items-center gap-1 ${isOverdue ? 'text-negative font-semibold' : 'text-text-muted'}`}>
                                {isOverdue && <AlertTriangle size={9} />}
                                {new Date(task.due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              </span>
                            ) : (
                              <span className="text-text-muted text-[11px]">—</span>
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                ))
              )}
            </div>
          </div>
        )
      })()}

      {/* Row 4: Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* Hours Tracked - Line Chart */}
        <div className="lg:col-span-5 h-full">
          <LineChart
            title="Hours Tracked"
            subtitle="Last 30 days overview"
            data={lineChartData}
          />
        </div>

        {/* Project Types - Donut Chart */}
        <div className="lg:col-span-3 h-full">
          <DonutChart
            title="Project Types"
            subtitle="By category"
            segments={donutData}
            centerLabel={donutCenter.label}
            centerValue={donutCenter.value}
          />
        </div>

        {/* Top Projects */}
        <div className="lg:col-span-4">
          <div className="bg-surface rounded-xl border border-border-accent shadow-card p-5 h-full flex flex-col">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-text-primary text-[14px] font-bold">Top Projects</h3>
              <button className="text-accent text-[11px] font-semibold hover:underline">View All</button>
            </div>
            <p className="text-text-muted text-[11px] mb-4">Best performers</p>

            <div className="flex flex-col gap-5 flex-1">
              {topProjects.length === 0 ? (
                <p className="text-text-muted text-[12px]">No time tracked yet.</p>
              ) : topProjects.map((project, i) => {
                const pct = maxHours > 0 ? Math.round((project.hours / maxHours) * 100) : 0
                return (
                  <div key={i} className="flex flex-col gap-1.5">
                    <span className="text-text-primary text-[12px] font-semibold truncate">{project.name}</span>
                    <span className="text-text-primary text-[20px] font-bold">{project.hours.toFixed(2)}h</span>
                    <div className="w-full h-1.5 bg-border-light rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${pct}%`,
                          background: 'linear-gradient(135deg, #0058be 0%, #2170e4 100%)',
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Row 5: Recent entries + Meetings + Revenue Growth */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Recent Time Entries */}
        <div>
          <div className="bg-surface rounded-xl border border-border-accent shadow-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-text-primary text-[14px] font-bold">Recent Entries</h3>
              <button onClick={() => navigate('/time')} className="text-accent text-[11px] font-semibold hover:underline">View All</button>
            </div>

            {/* Table header */}
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 pb-2 border-b border-border text-[10px] text-text-muted font-semibold uppercase tracking-wide">
              <span>Project</span>
              <span>Status</span>
              <span className="text-right">Hrs</span>
              <span className="text-right">Value</span>
            </div>

            {/* Rows */}
            {recentEntries.length === 0 ? (
              <div className="py-4 text-text-muted text-[12px] text-center">No entries yet.</div>
            ) : recentEntries.map((entry, i) => {
              const s = STATUS_LABELS[entry.status] || STATUS_LABELS.active
              return (
                <div
                  key={i}
                  className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center py-2.5 border-b border-border/50 last:border-0"
                >
                  <span className="text-text-primary text-[12px] font-medium truncate">{entry.project}</span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${s.style}`}>{s.label}</span>
                  <span className="text-text-secondary text-[12px] text-right">{entry.hours}</span>
                  <span className="text-text-secondary text-[12px] text-right">{entry.rate}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Recent Meetings */}
        <div>
          <div className="bg-surface rounded-xl border border-border-accent shadow-card p-5 h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-text-primary text-[14px] font-bold">Recent Meetings</h3>
              <button onClick={() => navigate('/meetings')} className="text-accent text-[11px] font-semibold hover:underline">View All</button>
            </div>

            <div className="flex flex-col gap-3 flex-1">
              {meetingNotes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 gap-2">
                  <BookOpen size={20} className="text-text-muted/40" />
                  <p className="text-text-muted text-[12px]">No meetings yet</p>
                  <button
                    onClick={() => navigate('/meetings')}
                    className="text-accent text-[11px] font-medium hover:underline"
                  >
                    Create your first meeting note →
                  </button>
                </div>
              ) : meetingNotes.slice(0, 3).map(note => {
                const noteClient = note.client_id ? clients.find(c => c.id === note.client_id) : null
                const noteTasks = tasks.filter(t => t.meeting_note_id === note.id)
                const noteDone = noteTasks.filter(t => t.status === 'done').length
                const meetDate = new Date(note.meeting_date)
                return (
                  <button
                    key={note.id}
                    onClick={() => navigate(`/meetings/${note.id}`)}
                    className="flex items-start gap-3 p-3 rounded-xl hover:bg-input-bg/50 transition-all text-left group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-accent-bg flex items-center justify-center shrink-0 group-hover:bg-accent transition-all">
                      <BookOpen size={13} className="text-accent group-hover:text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-text-primary text-[12px] font-semibold truncate">{note.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {noteClient && (
                          <span className="text-text-muted text-[10px]">{noteClient.name}</span>
                        )}
                        <span className="text-text-muted text-[10px] flex items-center gap-0.5">
                          <Calendar size={8} />
                          {meetDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                    </div>
                    {noteTasks.length > 0 && (
                      <span className="text-text-muted text-[10px] shrink-0 mt-1">
                        {noteDone}/{noteTasks.length}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Revenue Growth */}
        <div className="h-full">
          <BarChart title="Revenue Growth" data={barChartData} />
        </div>
      </div>
    </div>
  )
}
