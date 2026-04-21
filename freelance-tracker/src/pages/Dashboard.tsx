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
  CheckSquare,
  Circle,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  ExternalLink,
} from 'lucide-react'
import StatCard from '../components/StatCard'
import MilestoneWidget from '../components/MilestoneWidget'
import SmartInsight from '../components/SmartInsight'
import LineChart from '../components/charts/LineChart'
import DonutChart from '../components/charts/DonutChart'
import BarChart from '../components/charts/BarChart'
import { useClients } from '../hooks/useClients'
import { useProjects } from '../hooks/useProjects'
import { useTimeEntries } from '../hooks/useTimeEntries'
import { useInvoices } from '../hooks/useInvoices'
import { useTasks } from '../hooks/useTasks'
import { useMeetingNotes } from '../hooks/useMeetingNotes'
import { useI18n } from '../lib/i18n'
import { userStorage } from '../lib/userStorage'

const CHART_COLORS = ['#3e6b5a', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899']

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const STATUS_STYLES: Record<string, { key: string; style: string }> = {
  active: { key: 'status.active', style: 'bg-status-active-bg text-status-active-text' },
  completed: { key: 'status.completed', style: 'bg-status-completed-bg text-status-completed-text' },
  on_hold: { key: 'status.onHold', style: 'bg-status-hold-bg text-status-hold-text' },
  cancelled: { key: 'status.cancelled', style: 'bg-status-completed-bg text-status-completed-text' },
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { t, lang } = useI18n()
  const locale = lang === 'es' ? 'es-ES' : 'en-US'
  const { projects, loading: pLoading } = useProjects()
  const { entries, loading: tLoading } = useTimeEntries()
  const { invoices, loading: iLoading } = useInvoices()
  const { tasks, loading: taskLoading } = useTasks()
  const { meetingNotes, loading: mnLoading } = useMeetingNotes()

  const [collapsedProjects, setCollapsedProjects] = useState<Set<string>>(new Set())
  const [collapsedDates, setCollapsedDates] = useState<Set<string>>(new Set())
  const toggleProjectCollapse = (pid: string) => {
    setCollapsedProjects(prev => {
      const next = new Set(prev)
      if (next.has(pid)) next.delete(pid); else next.add(pid)
      return next
    })
  }
  const toggleDateCollapse = (key: string) => {
    setCollapsedDates(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })
  }

  const [profileName] = useState(() => {
    try {
      const raw = userStorage.get('freelancer_profile')
      if (raw) {
        const p = JSON.parse(raw)
        return p.name?.split(' ')[0] || 'there'
      }
    } catch { /* ignore */ }
    return 'there'
  })
  const { clients, loading: cLoading } = useClients()

  const loading = pLoading || tLoading || iLoading || cLoading || taskLoading || mnLoading

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
        { name: t('dash.billable'), color: '#3e6b5a', values: billable },
        { name: t('dash.nonBillable'), color: '#10b981', values: nonBillable },
        { name: t('common.total'), color: '#f59e0b', values: totals },
      ],
    }
  }, [entries])

  // --- Donut Chart: Projects by type ---
  const donutData = useMemo(() => {
    const countByType = new Map<string, number>()
    for (const p of projects) {
      const label = p.type || t('common.none')
      countByType.set(label, (countByType.get(label) || 0) + 1)
    }

    if (countByType.size === 0) {
      return [{ label: t('common.noData'), value: 1, color: CHART_COLORS[0] }]
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
    if (donutData.length === 0 || (donutData.length === 1 && donutData[0].label === t('common.noData'))) {
      return { label: t('common.noData'), value: '0' }
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
        <p className="text-text-muted text-[13px]">{t('dash.loadingDashboard')}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Smart Insight - top priority nudge */}
      <SmartInsight
        projects={projects}
        tasks={tasks}
        entries={entries}
        invoices={invoices}
      />

      {/* Row 1: Welcome */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h2 className="text-text-primary text-[20px] font-bold tracking-[-0.3px]">
            {t('dash.welcomeBack')}, {profileName}!
          </h2>
          <p className="text-text-muted text-[12px] mt-0.5">
            {t('dash.here')}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => navigate('/time')}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-white text-[12px] font-semibold hover:opacity-90 transition-all active:scale-[0.98]"
            style={{ background: 'linear-gradient(135deg, #305445 0%, #3e6b5a 100%)' }}
          >
            <Timer size={12} />
            {t('dash.logTime')}
          </button>
        </div>
      </div>

      {/* Row 2: To-Do Dashboard */}
      {(() => {
        const today = new Date().toDateString()
        const activeTasks = tasks
          .filter(t => t.status !== 'done')
          .sort((a, b) => {
            if (a.due_date && b.due_date) return b.due_date.localeCompare(a.due_date)
            if (a.due_date) return -1
            if (b.due_date) return 1
            return 0
          })

        // Group by project, then by due_date
        type DateGroup = { key: string; label: string; isOverdueGroup: boolean; tasks: typeof activeTasks }
        type ProjectGroup = { projectId: string; projectName: string; dateGroups: DateGroup[] }
        const projMap = new Map<string, ProjectGroup>()
        for (const tk of activeTasks) {
          const pid = tk.project_id ?? 'none'
          if (!projMap.has(pid)) {
            const pname = projectMap.get(pid)?.name ?? t('dash.noProject')
            projMap.set(pid, { projectId: pid, projectName: pname, dateGroups: [] })
          }
          const pg = projMap.get(pid)!
          const dkey = tk.due_date ?? 'none'
          let dg = pg.dateGroups.find(g => g.key === dkey)
          if (!dg) {
            let label = t('dash.noDueDate')
            let isOverdueGroup = false
            if (tk.due_date) {
              const d = new Date(tk.due_date + 'T00:00:00')
              const isToday = d.toDateString() === today
              const isPast = d < new Date(today)
              isOverdueGroup = isPast && !isToday
              label = isToday
                ? t('dash.today')
                : d.toLocaleDateString(locale, { weekday: 'long', month: 'long', day: 'numeric' })
            }
            dg = { key: dkey, label, isOverdueGroup, tasks: [] }
            pg.dateGroups.push(dg)
          }
          dg.tasks.push(tk)
        }
        const projectGroups = Array.from(projMap.values()).sort((a, b) => a.projectName.localeCompare(b.projectName))

        return (
          <div className="bg-surface rounded-xl border border-border-accent shadow-card flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h3 className="text-text-primary text-[14px] font-bold flex items-center gap-2">
                <CheckSquare size={15} className="text-accent" />
                {t('dash.todo')}
              </h3>
              {tasks.length > 0 && (
                <div className="flex items-center gap-2">
                  <div className="w-24 h-1.5 bg-border rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.round((tasks.filter(tk => tk.status === 'done').length / tasks.length) * 100)}%`,
                        background: tasks.filter(tk => tk.status === 'done').length === tasks.length ? '#10b981' : 'linear-gradient(90deg, #3e6b5a, #5a8f7b)',
                      }}
                    />
                  </div>
                  <span className="text-text-muted text-[11px]">
                    {tasks.filter(tk => tk.status === 'done').length}/{tasks.length} {t('dash.done')}
                  </span>
                </div>
              )}
            </div>

            {/* Column headers */}
            <div className="grid grid-cols-[1fr_120px_90px] border-b border-border bg-input-bg/50 pl-8 pr-5 py-2">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">{t('dash.task')}</span>
              <span className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">{t('common.status')}</span>
              <span className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">{t('dash.due')}</span>
            </div>

            {/* Grouped rows */}
            <div className="flex flex-col max-h-[320px] overflow-y-auto">
              {activeTasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2">
                  <CheckSquare size={24} className="text-text-muted/30" />
                  <p className="text-text-muted text-[12px]">
                    {tasks.length === 0 ? t('dash.noTasksYet') : t('dash.allTasksComplete')}
                  </p>
                </div>
              ) : (
                projectGroups.map(pg => {
                  const isProjectCollapsed = collapsedProjects.has(pg.projectId)
                  return (
                  <div key={pg.projectId}>
                    {/* Project header */}
                    <div className="w-full flex items-center gap-2 px-5 py-2 border-b border-border bg-accent/5 hover:bg-accent/10 transition-colors">
                      <button
                        onClick={() => toggleProjectCollapse(pg.projectId)}
                        className="flex items-center gap-2 flex-1 min-w-0 text-left"
                        aria-expanded={!isProjectCollapsed}
                      >
                        {isProjectCollapsed ? <ChevronRight size={11} className="text-text-muted shrink-0" /> : <ChevronDown size={11} className="text-text-muted shrink-0" />}
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${pg.projectId === 'none' ? 'bg-border' : 'bg-accent'}`} />
                        <span className="text-[12px] font-bold text-text-primary truncate">{pg.projectName}</span>
                        <span className="text-[10px] text-text-muted ml-1 shrink-0">
                          {pg.dateGroups.reduce((n, dg) => n + dg.tasks.length, 0)}
                        </span>
                      </button>
                      {pg.projectId !== 'none' && (
                        <button
                          onClick={() => navigate(`/projects/${pg.projectId}`)}
                          className="p-1 rounded hover:bg-input-bg text-text-muted hover:text-accent transition-colors shrink-0"
                          title="Open project"
                        >
                          <ExternalLink size={11} />
                        </button>
                      )}
                    </div>

                    {!isProjectCollapsed && pg.dateGroups.map(group => {
                      const dateKey = `${pg.projectId}-${group.key}`
                      const isDateCollapsed = collapsedDates.has(dateKey)
                      return (
                      <div key={dateKey}>
                        {/* Date sub-header */}
                        <button
                          onClick={() => toggleDateCollapse(dateKey)}
                          className="w-full flex items-center gap-2 pl-8 pr-5 py-1 border-b border-border/60 bg-input-bg/30 hover:bg-input-bg/60 transition-colors text-left"
                          aria-expanded={!isDateCollapsed}
                        >
                          {isDateCollapsed ? <ChevronRight size={10} className="text-text-muted shrink-0" /> : <ChevronDown size={10} className="text-text-muted shrink-0" />}
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${group.isOverdueGroup ? 'bg-negative' : group.key === 'none' ? 'bg-border' : 'bg-accent'}`} />
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-text-secondary">
                            {group.label}
                          </span>
                          <span className="text-[10px] text-text-muted ml-1">{group.tasks.length}</span>
                        </button>

                        {/* Tasks in group */}
                        {!isDateCollapsed && group.tasks.map(task => {
                          const proj = projectMap.get(task.project_id)
                          const isOverdue = group.isOverdueGroup
                          return (
                            <button
                              key={task.id}
                              onClick={() => proj ? navigate(`/projects/${proj.id}`) : undefined}
                              className="grid grid-cols-[1fr_120px_90px] items-center pl-8 pr-5 py-2.5 hover:bg-input-bg/40 transition-colors text-left group w-full border-b border-border/40 last:border-0"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <Circle size={12} className="text-border shrink-0 group-hover:text-accent transition-colors" strokeWidth={2} />
                                <span className={`text-[12px] font-medium truncate ${isOverdue ? 'text-negative' : 'text-text-primary'}`}>{task.title}</span>
                              </div>
                              <div>
                                {task.status === 'in_progress' && (
                                  <span className="text-[10px] font-semibold text-status-scheduled-text">{t('status.inProgress')}</span>
                                )}
                                {task.status === 'todo' && (
                                  <span className="text-[10px] font-semibold text-text-muted">{t('status.todo')}</span>
                                )}
                              </div>
                              <div>
                                {task.due_date ? (
                                  <span className={`text-[11px] flex items-center gap-1 ${isOverdue ? 'text-negative font-semibold' : 'text-text-muted'}`}>
                                    {isOverdue && <AlertTriangle size={9} />}
                                    {new Date(task.due_date + 'T00:00:00').toLocaleDateString(locale, { month: 'short', day: 'numeric' })}
                                  </span>
                                ) : (
                                  <span className="text-text-muted text-[11px]">—</span>
                                )}
                              </div>
                            </button>
                          )
                        })}
                      </div>
                      )
                    })}
                  </div>
                  )
                })
              )}
            </div>
          </div>
        )
      })()}

      {/* Row 3: Stat Cards + Next Milestone */}
      {(() => {
        const unbilledEntryCount = entries.filter(e => e.billable && !e.invoice_id).length
        const pendingInvoiceCount = invoices.filter(i => i.status === 'draft' || i.status === 'sent').length
        const paidInvoiceCount = invoices.filter(i => i.status === 'paid').length
        const activeClientCount = new Set(projects.filter(p => p.status === 'active').map(p => p.client_id)).size
        return (
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
        <div className="xl:col-span-2 grid grid-cols-2 gap-3">
          <StatCard
            icon={Clock}
            label={t('dash.unbilledHours')}
            value={unbilledHours.toFixed(2)}
            sublabel={unbilledEntryCount === 0 ? t('dash.nothingWaiting') : t(unbilledEntryCount === 1 ? 'dash.acrossEntry' : 'dash.acrossEntries', { n: unbilledEntryCount })}
          />
          <StatCard
            icon={DollarSign}
            label={t('dash.pendingInvoices')}
            value={`$${pendingInvoiceAmount.toLocaleString()}`}
            sublabel={pendingInvoiceCount === 0 ? t('dash.noInvoicesOut') : t('dash.awaitingPayment', { n: pendingInvoiceCount })}
          />
          <StatCard
            icon={TrendingUp}
            label={t('dash.revenue')}
            value={`$${totalRevenue.toLocaleString()}`}
            sublabel={paidInvoiceCount === 0 ? t('dash.noPaidYet') : t(paidInvoiceCount === 1 ? 'dash.paidInvoice' : 'dash.paidInvoices', { n: paidInvoiceCount })}
          />
          <StatCard
            icon={FolderKanban}
            label={t('dash.activeProjects')}
            value={String(activeProjectCount)}
            sublabel={activeProjectCount === 0 ? t('dash.noActiveWork') : t(activeClientCount === 1 ? 'dash.forClient' : 'dash.forClients', { n: activeClientCount })}
          />
        </div>
        <div className="xl:col-span-1">
          <MilestoneWidget projects={projects} tasks={tasks} entries={entries} />
        </div>
      </div>
        )
      })()}

      {/* Row 4: Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* Hours Tracked - Line Chart */}
        <div className="lg:col-span-5 h-full">
          <LineChart
            title={t('dash.hoursTracked')}
            subtitle={t('dash.last30')}
            data={lineChartData}
          />
        </div>

        {/* Project Types - Donut Chart */}
        <div className="lg:col-span-3 h-full">
          <DonutChart
            title={t('dash.projectTypes')}
            subtitle={t('dash.byCategory')}
            segments={donutData}
            centerLabel={donutCenter.label}
            centerValue={donutCenter.value}
          />
        </div>

        {/* Top Projects */}
        <div className="lg:col-span-4">
          <div className="bg-surface rounded-xl border border-border-accent shadow-card p-5 h-full flex flex-col">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-text-primary text-[14px] font-bold">{t('dash.topProjects')}</h3>
              <button className="text-accent text-[11px] font-semibold hover:underline">{t('common.viewAll')}</button>
            </div>
            <p className="text-text-muted text-[11px] mb-4">{t('dash.bestPerformers')}</p>

            <div className="flex flex-col gap-5 flex-1">
              {topProjects.length === 0 ? (
                <p className="text-text-muted text-[12px]">{t('dash.noTimeTracked')}</p>
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
                          background: 'linear-gradient(135deg, #305445 0%, #3e6b5a 100%)',
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
              <h3 className="text-text-primary text-[14px] font-bold">{t('dash.recentEntries')}</h3>
              <button onClick={() => navigate('/time')} className="text-accent text-[11px] font-semibold hover:underline">{t('common.viewAll')}</button>
            </div>

            {/* Table header */}
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 pb-2 border-b border-border text-[10px] text-text-muted font-semibold uppercase tracking-wide">
              <span>{t('dash.project')}</span>
              <span>{t('common.status')}</span>
              <span className="text-right">{t('dash.hrs')}</span>
              <span className="text-right">{t('dash.value')}</span>
            </div>

            {/* Rows */}
            {recentEntries.length === 0 ? (
              <div className="py-4 text-text-muted text-[12px] text-center">{t('dash.noEntriesYet')}</div>
            ) : recentEntries.map((entry, i) => {
              const s = STATUS_STYLES[entry.status] || STATUS_STYLES.active
              return (
                <div
                  key={i}
                  className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center py-2.5 border-b border-border/50 last:border-0"
                >
                  <span className="text-text-primary text-[12px] font-medium truncate">{entry.project}</span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${s.style}`}>{t(s.key)}</span>
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
              <h3 className="text-text-primary text-[14px] font-bold">{t('dash.recentMeetings')}</h3>
              <button onClick={() => navigate('/meetings')} className="text-accent text-[11px] font-semibold hover:underline">{t('common.viewAll')}</button>
            </div>

            <div className="flex flex-col gap-3 flex-1">
              {meetingNotes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 gap-2">
                  <BookOpen size={20} className="text-text-muted/40" />
                  <p className="text-text-muted text-[12px]">{t('dash.noMeetingsYet')}</p>
                  <button
                    onClick={() => navigate('/meetings')}
                    className="text-accent text-[11px] font-medium hover:underline"
                  >
                    {t('dash.createFirstMeeting')}
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
                    <div className="shrink-0">
                      <BookOpen size={15} className="text-accent" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-text-primary text-[12px] font-semibold truncate">{note.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {noteClient && (
                          <span className="text-text-muted text-[10px]">{noteClient.name}</span>
                        )}
                        <span className="text-text-muted text-[10px] flex items-center gap-0.5">
                          <Calendar size={8} />
                          {meetDate.toLocaleDateString(locale, { month: 'short', day: 'numeric' })}
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
          <BarChart title={t('dash.revenueGrowth')} data={barChartData} />
        </div>
      </div>
    </div>
  )
}
