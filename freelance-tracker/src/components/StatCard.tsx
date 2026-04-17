import type { LucideIcon } from 'lucide-react'

interface StatCardProps {
  icon: LucideIcon
  label: string
  value: string
  trend: number
  trendLabel: string
}

export default function StatCard({ icon: Icon, label, value }: StatCardProps) {
  return (
    <div className="bg-surface border border-border-accent rounded-xl p-4 shadow-card flex items-center gap-3 min-w-0 hover:shadow-card-hover transition-shadow">
      <div className="shrink-0">
        <Icon size={20} className="text-accent" />
      </div>
      <div className="min-w-0">
        <p className="text-text-muted text-[11px] font-medium tracking-wide leading-tight">{label}</p>
        <p className="text-text-primary text-[20px] font-bold leading-tight tracking-[-0.3px]">{value}</p>
      </div>
    </div>
  )
}
