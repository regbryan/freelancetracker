import { useNavigate } from 'react-router-dom'
import { Sparkles, X, type LucideIcon } from 'lucide-react'
import { useI18n } from '../lib/i18n'

export type InsightVariant = 'smart' | 'forecast' | 'curator' | 'collection'

interface VariantStyle {
  background: string
  borderColor: string
  iconBg: string
  labelColor: string
  ctaBg: string
}

const VARIANTS: Record<InsightVariant, VariantStyle> = {
  // Dashboard — forest / "Smart Insight"
  smart: {
    background: 'linear-gradient(135deg, #eef5f2 0%, #e3eee9 100%)',
    borderColor: '#b5d5c8',
    iconBg: 'linear-gradient(135deg, #305445 0%, #3e6b5a 100%)',
    labelColor: 'text-accent',
    ctaBg: 'linear-gradient(135deg, #305445 0%, #3e6b5a 100%)',
  },
  // Projects — navy ink / "AI Forecast"
  forecast: {
    background: 'linear-gradient(135deg, #f0f3f8 0%, #e4eaf2 100%)',
    borderColor: '#b9c4d3',
    iconBg: 'linear-gradient(135deg, #15263a 0%, #2b425c 100%)',
    labelColor: 'text-[#15263a]',
    ctaBg: 'linear-gradient(135deg, #15263a 0%, #2b425c 100%)',
  },
  // Time Tracker — amber / "Curator's Insight"
  curator: {
    background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
    borderColor: '#fcd34d',
    iconBg: 'linear-gradient(135deg, #b45309 0%, #f59e0b 100%)',
    labelColor: 'text-[#b45309]',
    ctaBg: 'linear-gradient(135deg, #b45309 0%, #f59e0b 100%)',
  },
  // Invoices — emerald / "Collection Insight"
  collection: {
    background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
    borderColor: '#86efac',
    iconBg: 'linear-gradient(135deg, #047857 0%, #10b981 100%)',
    labelColor: 'text-[#047857]',
    ctaBg: 'linear-gradient(135deg, #047857 0%, #10b981 100%)',
  },
}

interface InsightBannerProps {
  label: string
  message: React.ReactNode
  icon?: LucideIcon
  variant?: InsightVariant
  cta?: {
    label: string
    to?: string
    onClick?: () => void
  }
  onDismiss?: () => void
  /** Optional slot rendered inside the banner, right side — for things like a confidence score. */
  accessory?: React.ReactNode
}

export default function InsightBanner({
  label,
  message,
  icon: Icon = Sparkles,
  variant = 'smart',
  cta,
  onDismiss,
  accessory,
}: InsightBannerProps) {
  const navigate = useNavigate()
  const { t } = useI18n()
  const style = VARIANTS[variant]

  const handleCta = () => {
    if (cta?.onClick) cta.onClick()
    else if (cta?.to) navigate(cta.to)
  }

  return (
    <div
      className="relative rounded-xl overflow-hidden border shadow-card"
      style={{
        background: style.background,
        borderColor: style.borderColor,
      }}
    >
      <div className="flex items-start gap-4 p-5 flex-wrap md:flex-nowrap">
        {/* Icon */}
        <div
          className="w-10 h-10 rounded-full shrink-0 flex items-center justify-center text-white shadow-button"
          style={{ background: style.iconBg }}
        >
          <Icon size={18} />
        </div>

        {/* Message */}
        <div className="flex-1 min-w-0">
          <p className={`${style.labelColor} text-[10px] font-bold uppercase tracking-wider`}>
            {label}
          </p>
          <p className="text-text-primary text-[13px] mt-1 leading-relaxed">
            {message}
          </p>
        </div>

        {/* Accessory (e.g. confidence score) */}
        {accessory && (
          <div className="shrink-0 mt-1 md:mt-0">{accessory}</div>
        )}

        {/* Actions */}
        {(cta || onDismiss) && (
          <div className="flex items-center gap-2 shrink-0 mt-1 md:mt-0">
            {onDismiss && (
              <button
                onClick={onDismiss}
                className="h-8 px-3 rounded-lg text-text-secondary text-[12px] font-semibold hover:bg-white/70 transition-colors flex items-center gap-1"
              >
                <X size={12} />
                {t('insight.dismiss')}
              </button>
            )}
            {cta && (
              <button
                onClick={handleCta}
                className="h-8 px-3.5 rounded-lg text-white text-[12px] font-semibold hover:opacity-90 transition-opacity active:scale-[0.98] shadow-button"
                style={{ background: style.ctaBg }}
              >
                {cta.label}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
