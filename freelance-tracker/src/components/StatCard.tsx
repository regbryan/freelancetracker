import type { LucideIcon } from 'lucide-react'

interface StatCardProps {
  icon: LucideIcon
  label: string
  value: string
  sublabel?: string
  trend?: number
  trendLabel?: string
}

export default function StatCard({ icon: Icon, label, value, sublabel, trend, trendLabel }: StatCardProps) {
  const trendColor = trend && trend > 0 ? 'text-positive' : trend && trend < 0 ? 'text-negative' : 'text-text-muted'
  const trendSign = trend && trend > 0 ? '+' : ''
  return (
    <div className="bg-surface border border-border-accent rounded-xl p-4 shadow-card flex flex-col gap-1.5 min-w-0 hover:shadow-card-hover transition-shadow">
      <Icon size={20} className="text-border-accent" />
      <p className="text-text-muted text-[11px] font-medium tracking-wide leading-tight">{label}</p>
      <p className="text-text-primary text-[22px] font-bold leading-tight tracking-[-0.5px]">{value}</p>
      {sublabel && (
        <p className="text-text-muted text-[11px] leading-tight mt-0.5">{sublabel}</p>
      )}
      {trend !== undefined && trend !== 0 && trendLabel && (
        <p className={`text-[11px] font-semibold mt-0.5 ${trendColor}`}>
          {trendSign}{trend}% <span className="text-text-muted font-normal">{trendLabel}</span>
        </p>
      )}
    </div>
  )
}
