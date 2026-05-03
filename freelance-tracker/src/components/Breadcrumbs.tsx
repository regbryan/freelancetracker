import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'

export interface Crumb {
  label: string
  to?: string // omit for current page (last crumb)
}

/**
 * Simple breadcrumb trail for detail pages. The last crumb renders as
 * non-interactive text so users always know where they are.
 */
export default function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-[12px] text-text-muted flex-wrap">
      {items.map((c, i) => {
        const isLast = i === items.length - 1
        return (
          <span key={i} className="flex items-center gap-1">
            {c.to && !isLast ? (
              <Link to={c.to} className="hover:text-accent hover:underline transition-colors">
                {c.label}
              </Link>
            ) : (
              <span className={isLast ? 'text-text-primary font-semibold' : ''}>{c.label}</span>
            )}
            {!isLast && <ChevronRight size={11} className="text-text-muted/60" />}
          </span>
        )
      })}
    </nav>
  )
}
