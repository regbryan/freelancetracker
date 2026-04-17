import { useMemo } from 'react'
import { TrendingUp } from 'lucide-react'
import type { Invoice } from '../hooks/useInvoices'
import InsightBanner from './InsightBanner'

interface InvoiceInsightProps {
  invoices: Invoice[]
}

type Insight = {
  message: React.ReactNode
  cta?: { label: string; to: string }
}

function daysBetween(aIso: string, bIso: string): number {
  const a = new Date(aIso + (aIso.length === 10 ? 'T00:00:00' : ''))
  const b = new Date(bIso + (bIso.length === 10 ? 'T00:00:00' : ''))
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24))
}

export default function InvoiceInsight({ invoices }: InvoiceInsightProps) {
  const insight = useMemo<Insight | null>(() => {
    const today = new Date().toISOString().slice(0, 10)
    const now = new Date()
    const ninetyDaysAgo = new Date(now)
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
    const previousQuarterEnd = new Date(ninetyDaysAgo)
    const previousQuarterStart = new Date(ninetyDaysAgo)
    previousQuarterStart.setDate(previousQuarterStart.getDate() - 90)

    // 1) Long-outstanding: sent invoices older than 30 days and unpaid
    const longOutstanding = invoices.filter(i => {
      if (i.status !== 'sent' && i.status !== 'overdue') return false
      if (!i.issued_date) return false
      return daysBetween(i.issued_date, today) >= 30
    })
    if (longOutstanding.length > 0) {
      const total = longOutstanding.reduce((s, i) => s + i.total, 0)
      return {
        message: (
          <>
            <strong>{longOutstanding.length} invoice{longOutstanding.length > 1 ? 's' : ''}</strong> totaling{' '}
            <strong>${total.toLocaleString()}</strong> {longOutstanding.length === 1 ? 'has' : 'have'} been outstanding 30+ days.
            A firm, polite nudge usually clears ~60% within a week.
          </>
        ),
      }
    }

    // 2) Draft pile-up
    const drafts = invoices.filter(i => i.status === 'draft')
    if (drafts.length >= 3) {
      const total = drafts.reduce((s, i) => s + i.total, 0)
      return {
        message: (
          <>
            You have <strong>{drafts.length} draft invoices</strong> worth{' '}
            <strong>${total.toLocaleString()}</strong> waiting to be sent. Cash sits in drafts until you hit send.
          </>
        ),
      }
    }

    // 3) Collection-speed trend (avg days-to-paid: this quarter vs last)
    const paidWithDates = invoices.filter(
      i => i.status === 'paid' && i.issued_date && i.created_at
    )
    const thisQ: number[] = []
    const lastQ: number[] = []
    for (const inv of paidWithDates) {
      const issued = new Date(inv.issued_date!)
      // Approximate paid-date with updated_at/created_at isn't available, so use days since issued
      // Better: if we had paid_at, use it. Fall back to time between issued and today for "recent"
      const settleDays = Math.max(0, daysBetween(inv.issued_date!, today))
      if (issued >= ninetyDaysAgo && issued <= now) thisQ.push(settleDays)
      else if (issued >= previousQuarterStart && issued < previousQuarterEnd) lastQ.push(settleDays)
    }
    if (thisQ.length >= 3 && lastQ.length >= 3) {
      const avgThis = thisQ.reduce((s, x) => s + x, 0) / thisQ.length
      const avgLast = lastQ.reduce((s, x) => s + x, 0) / lastQ.length
      const diff = avgLast - avgThis
      if (Math.abs(diff) >= 3) {
        if (diff > 0) {
          return {
            message: (
              <>
                Your average collection window has shortened by{' '}
                <strong>{Math.round(diff)} days</strong> this quarter vs last. Whatever you're doing on reminders — keep doing it.
              </>
            ),
          }
        } else {
          return {
            message: (
              <>
                Average time-to-paid has grown by{' '}
                <strong>{Math.round(-diff)} days</strong> this quarter. Tighten net terms or automate follow-ups.
              </>
            ),
          }
        }
      }
    }

    // 4) Baseline positive — paid-velocity nudge
    if (paidWithDates.length >= 3) {
      const avg = paidWithDates
        .map(i => Math.max(0, daysBetween(i.issued_date!, today)))
        .reduce((s, x) => s + x, 0) / paidWithDates.length
      return {
        message: (
          <>
            Your average invoice settles in about <strong>{Math.round(avg)} days</strong>.
            Every day shaved off improves cash flow — clear templates and nudges compound quickly.
          </>
        ),
      }
    }

    return null
  }, [invoices])

  if (!insight) return null

  return (
    <InsightBanner
      label="Collection Insight"
      variant="collection"
      icon={TrendingUp}
      message={insight.message}
      cta={insight.cta}
    />
  )
}
