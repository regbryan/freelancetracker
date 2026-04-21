import { useMemo } from 'react'
import { Settings2 } from 'lucide-react'
import InsightBanner from './InsightBanner'
import { useI18n } from '../lib/i18n'

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
  const { t } = useI18n()
  const insight = useMemo<Insight | null>(() => {
    if (!profile.name.trim() || !profile.email.trim()) {
      return {
        message: (
          <>
            {t('settingsInsight.identityMissingPre')} <strong>{t('settingsInsight.nameEmail')}</strong>{t('settingsInsight.identityMissingTail')}
          </>
        ),
      }
    }

    if (!defaults.paymentTerms.trim()) {
      return {
        message: (
          <>
            {t('settingsInsight.noTermsPre')} <strong>{t('settingsInsight.paymentTerms')}</strong>{t('settingsInsight.noTermsTail')}
          </>
        ),
      }
    }

    if (!gmailConnected && !calendarConnected) {
      return {
        message: (
          <>
            <strong>{t('settingsInsight.bothOff')}</strong>{t('settingsInsight.bothOffTail')}
          </>
        ),
      }
    }
    if (!gmailConnected) {
      return {
        message: (
          <>
            {t('settingsInsight.gmailOffPre')} <strong>{t('settingsInsight.gmailOff')}</strong>{t('settingsInsight.gmailOffTail')}
          </>
        ),
      }
    }
    if (!calendarConnected) {
      return {
        message: (
          <>
            {t('settingsInsight.calOffPre')} <strong>{t('settingsInsight.calOff')}</strong>{t('settingsInsight.calOffTail')}
          </>
        ),
      }
    }

    if (!businessLogo || !profilePhoto) {
      const missing = [
        !businessLogo ? t('settingsInsight.businessLogo') : null,
        !profilePhoto ? t('settingsInsight.profilePhoto') : null,
      ].filter(Boolean)
      return {
        message: (
          <>
            {t('settingsInsight.polishPre')} <strong>{missing.join(t('settingsInsight.and'))}</strong>{t('settingsInsight.polishTail')}
          </>
        ),
      }
    }

    const termDays = parseInt(defaults.paymentTerms, 10)
    const termStr = isNaN(termDays) ? defaults.paymentTerms : termDays
    return {
      message: (
        <>
          {t('settingsInsight.baselinePre')} <strong>{t('settingsInsight.netTerm', { term: termStr })}</strong>, {t('settingsInsight.signed')} <strong>{profile.name}</strong>.
        </>
      ),
    }
  }, [profile, defaults, profilePhoto, businessLogo, gmailConnected, calendarConnected, t])

  if (!insight) return null

  return (
    <InsightBanner
      label={t('settingsInsight.label')}
      variant="smart"
      icon={Settings2}
      message={insight.message}
    />
  )
}
