import type { LucideIcon } from 'lucide-react'
import { TrendingUp, TrendingDown } from 'lucide-react'

interface StatCardProps {
  icon: LucideIcon
  label: string
  value: string
  trend: number
  trendLabel: string
}

export default function StatCard({ icon: Icon, label, value, trend, trendLabel }: StatCardProps) {
  const isPositive = trend >= 0

  return (
    <div className="bg-surface rounded-[14px] shadow-card p-5 flex flex-col gap-3 min-w-0">
      {/* Label */}
      <div className="flex items-center justify-between">
        <span className="text-text-muted text-[12px] font-medium uppercase tracking-wide">{label}</span>
      </div>

      {/* Value + Trend */}
      <div className="flex items-end justify-between gap-2">
        <span className="text-text-primary text-[24px] font-bold leading-none tracking-[-0.5px]">
          {value}
        </span>
        <div className={`flex items-center gap-1 text-[12px] font-semibold shrink-0 ${
          isPositive ? 'text-positive' : 'text-negative'
        }`}>
          {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
          <span>{trendLabel}</span>
        </div>
      </div>
    </div>
  )
}
