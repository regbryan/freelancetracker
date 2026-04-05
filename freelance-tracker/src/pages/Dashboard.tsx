import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Clock,
  DollarSign,
  FolderKanban,
  TrendingUp,
  Timer,
  Sparkles,
  Lightbulb,
  Clock3,
  Loader2,
  Receipt,
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
  const { loading: cLoading } = useClients()

  const loading = pLoading || tLoading || iLoading || cLoading || expLoading

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0)

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
    <div className="flex flex-col gap-5">
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
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
        <StatCard icon={Clock} label="Unbilled Hours" value={unbilledHours.toFixed(2)} trend={0} trendLabel="" />
        <StatCard icon={DollarSign} label="Pending Invoices" value={`$${pendingInvoiceAmount.toLocaleString()}`} trend={0} trendLabel="" />
        <StatCard icon={FolderKanban} label="Active Projects" value={String(activeProjectCount)} trend={0} trendLabel="" />
        <StatCard icon={TrendingUp} label="Revenue" value={`$${totalRevenue.toLocaleString()}`} trend={0} trendLabel="" />
        <StatCard icon={Receipt} label="Expenses" value={`$${totalExpenses.toLocaleString()}`} trend={0} trendLabel="" />
      </div>

      {/* Row 3: Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* Hours Tracked - Line Chart */}
        <div className="lg:col-span-5">
          <LineChart
            title="Hours Tracked"
            subtitle="Last 30 days overview"
            data={lineChartData}
          />
        </div>

        {/* Project Types - Donut Chart */}
        <div className="lg:col-span-3">
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
          <div className="bg-surface rounded-[16px] shadow-card p-5 h-full flex flex-col">
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

      {/* Row 4: Bottom panels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Revenue Growth */}
        <div>
          <BarChart title="Revenue Growth" data={barChartData} />
        </div>

        {/* Recent Time Entries */}
        <div>
          <div className="bg-surface rounded-[16px] shadow-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-text-primary text-[14px] font-bold">Recent Entries</h3>
              <button className="text-accent text-[11px] font-semibold hover:underline">View All</button>
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

        {/* AI Insights */}
        <div>
          <div className="bg-surface rounded-[16px] shadow-card p-5 h-full flex flex-col">
            <h3 className="text-text-primary text-[14px] font-bold mb-4">AI Insights</h3>

            <div className="flex flex-col gap-3 flex-1">
              <div className="flex items-start gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-accent-bg flex items-center justify-center shrink-0">
                  <Clock3 size={14} className="text-accent" />
                </div>
                <div className="min-w-0">
                  <p className="text-text-primary text-[12px] font-semibold">Best Productivity</p>
                  <p className="text-text-muted text-[11px] leading-relaxed">
                    Tuesday at 10 AM shows the highest focus hours...
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-accent-bg flex items-center justify-center shrink-0">
                  <Lightbulb size={14} className="text-accent" />
                </div>
                <div className="min-w-0">
                  <p className="text-text-primary text-[12px] font-semibold">Rate Suggestion</p>
                  <p className="text-text-muted text-[11px] leading-relaxed">
                    Your average rate is below market by 12%...
                  </p>
                </div>
              </div>
            </div>

            <button
              className="mt-3 w-full flex items-center justify-center gap-1.5 h-9 rounded-lg text-white text-[12px] font-semibold hover:opacity-90 transition-all active:scale-[0.98]"
              style={{ background: 'linear-gradient(135deg, #0058be 0%, #2170e4 100%)' }}
            >
              <Sparkles size={12} />
              Open AI Assistant
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
