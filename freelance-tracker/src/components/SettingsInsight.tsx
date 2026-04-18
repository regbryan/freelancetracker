import { useMemo } from 'react'
import { Settings2 } from 'lucide-react'
import InsightBanner from './InsightBanner'

interface SettingsInsightProps {
  profile: { name: string; email: string; address: string; phone: string }
  defaults: { taxRate: string; paymentTerms: string; notesTemplate: string }
  profilePhoto: string
  businessLogo: string
  gmailConnected: boolean
  calendarConnected: boolean
}

type Insight = { message: React.ReactNode }

export default function SettingsInsight({
  profile,
  defaults,
  profilePhoto,
  businessLogo,
  gmailConnected,
  calendarConnected,
}: SettingsInsightProps) {
  const insight = useMemo<Insight | null>(() => {
    // 1) Identity missing — can't invoice without a name
    if (!profile.name.trim() || !profile.email.trim()) {
      return {
        message: (
          <>
            Your invoices need a <strong>name and email</strong> to look
            professional. Fill your freelancer details below — it's the first
            thing a client sees on every invoice.
          </>
        ),
      }
    }

    // 2) No payment terms — invoices will be ambiguous
    if (!defaults.paymentTerms.trim()) {
      return {
        message: (
          <>
            No default <strong>payment terms</strong> set. Net 30 is the common
            norm — lock it in once and every invoice inherits it.
          </>
        ),
      }
    }

    // 3) Integrations dormant
    if (!gmailConnected && !calendarConnected) {
      return {
        message: (
          <>
            <strong>Gmail and Calendar aren't connected.</strong> Hook both up
            to auto-pull meeting notes, client threads, and event context into
            your tracker.
          </>
        ),
      }
    }
    if (!gmailConnected) {
      return {
        message: (
          <>
            Calendar is linked but <strong>Gmail isn't</strong>. Connect it so
            client email threads surface next to the projects they touch.
          </>
        ),
      }
    }
    if (!calendarConnected) {
      return {
        message: (
          <>
            Gmail is linked but <strong>Calendar isn't</strong>. Connect it so
            meetings with clients land on your tracker timeline automatically.
          </>
        ),
      }
    }

    // 4) Polish missing — logo / photo
    if (!businessLogo || !profilePhoto) {
      const missing = [
        !businessLogo ? 'business logo' : null,
        !profilePhoto ? 'profile photo' : null,
      ].filter(Boolean)
      return {
        message: (
          <>
            Add your <strong>{missing.join(' and ')}</strong> to polish the
            little surfaces — invoices, nav, and shared links all use them.
          </>
        ),
      }
    }

    // 5) Baseline — everything set
    const termDays = parseInt(defaults.paymentTerms, 10)
    return {
      message: (
        <>
          Profile set. Every field here is what clients see — invoices go out
          on <strong>net {isNaN(termDays) ? defaults.paymentTerms : termDays}</strong>,
          signed <strong>{profile.name}</strong>.
        </>
      ),
    }
  }, [profile, defaults, profilePhoto, businessLogo, gmailConnected, calendarConnected])

  if (!insight) return null

  return (
    <InsightBanner
      label="Account Setup"
      variant="smart"
      icon={Settings2}
      message={insight.message}
    />
  )
}
