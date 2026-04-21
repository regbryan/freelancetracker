import { useState, useEffect, useRef } from 'react'
import { Save, Check, Mail, Unplug, Calendar, Loader2, Camera, FileText, LogOut } from 'lucide-react'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Button } from '../components/ui/button'
import { useAuth } from '../hooks/useAuth'
import { useGmail } from '../hooks/useGmail'
import { useCalendarAuth } from '../hooks/useCalendarAuth'
import SettingsInsight from '../components/SettingsInsight'
import { useI18n } from '../lib/i18n'
import { userStorage } from '../lib/userStorage'

interface FreelancerProfile {
  name: string
  email: string
  address: string
  phone: string
}

interface InvoiceDefaults {
  taxRate: string
  paymentTerms: string
  notesTemplate: string
}

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (digits.length === 0) return ''
  if (digits.length <= 3) return `(${digits}`
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`
}

const DEFAULTS_KEY = 'invoice_defaults'

function loadProfile(): FreelancerProfile {
  try {
    const raw = userStorage.get('freelancer_profile')
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return { name: '', email: '', address: '', phone: '' }
}

function loadDefaults(): InvoiceDefaults {
  try {
    const raw = localStorage.getItem(DEFAULTS_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return { taxRate: '', paymentTerms: '30', notesTemplate: '' }
}

type ToastState = { section: string; visible: boolean }

export default function Settings() {
  const { t } = useI18n()
  const { user, signOut } = useAuth()
  const { isAuthenticated, login, logout, loading: gmailLoading } = useGmail()
  const calendarAuth = useCalendarAuth()

  // Profile photo
  const [profilePhoto, setProfilePhoto] = useState<string>(userStorage.get('freelancer_photo') || '')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Business logo (for invoices)
  const [businessLogo, setBusinessLogo] = useState<string>(userStorage.get('freelancer_logo') || '')
  const logoInputRef = useRef<HTMLInputElement>(null)

  function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      alert(t('settings.imageTooLarge'))
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      setProfilePhoto(dataUrl)
      userStorage.set('freelancer_photo', dataUrl)
    }
    reader.readAsDataURL(file)
  }

  function handleRemovePhoto() {
    setProfilePhoto('')
    userStorage.remove('freelancer_photo')
  }

  function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      alert(t('settings.logoTooLarge'))
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      setBusinessLogo(dataUrl)
      userStorage.set('freelancer_logo', dataUrl)
    }
    reader.readAsDataURL(file)
  }

  function handleRemoveLogo() {
    setBusinessLogo('')
    userStorage.remove('freelancer_logo')
  }

  // Profile state
  const [profile, setProfile] = useState<FreelancerProfile>(loadProfile)

  // Invoice defaults state
  const [defaults, setDefaults] = useState<InvoiceDefaults>(loadDefaults)

  // Toast feedback
  const [toast, setToast] = useState<ToastState>({ section: '', visible: false })
  const [profileSaved, setProfileSaved] = useState(false)
  const [defaultsSaved, setDefaultsSaved] = useState(false)

  function showToast(section: string) {
    setToast({ section, visible: true })
    if (section === 'profile') {
      setProfileSaved(true)
      setTimeout(() => setProfileSaved(false), 3000)
    }
    if (section === 'defaults') {
      setDefaultsSaved(true)
      setTimeout(() => setDefaultsSaved(false), 3000)
    }
    setTimeout(() => setToast({ section: '', visible: false }), 3000)
  }

  function handleSaveProfile() {
    try {
      userStorage.set('freelancer_profile', JSON.stringify(profile))
      showToast('profile')
    } catch (err) {
      console.error('Failed to save profile:', err)
      alert(t('settings.failedToSaveProfile'))
    }
  }

  function handleSaveDefaults() {
    try {
      localStorage.setItem(DEFAULTS_KEY, JSON.stringify(defaults))
      showToast('defaults')
    } catch (err) {
      console.error('Failed to save defaults:', err)
      alert(t('settings.failedToSaveDefaults'))
    }
  }

  const profileFieldCount = [profile.name, profile.email, profile.address, profile.phone]
    .filter((v) => v.trim()).length

  return (
    <div className="flex flex-col gap-5">
      {/* Editorial Hero */}
      <div
        className="rounded-[16px] text-white relative overflow-hidden"
        style={{
          background:
            'linear-gradient(135deg, #15263a 0%, #24354d 45%, #3e6b5a 100%)',
          minHeight: '150px',
        }}
      >
        <div
          className="absolute -top-20 -right-24 w-72 h-72 rounded-full opacity-20 pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(239,234,224,0.5) 0%, transparent 70%)' }}
        />
        <div
          className="absolute -bottom-24 -left-16 w-64 h-64 rounded-full opacity-15 pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(138,150,144,0.4) 0%, transparent 70%)' }}
        />
        <div className="relative z-10 px-7 py-7 max-w-2xl">
          <p className="text-white/60 text-[10px] font-semibold uppercase tracking-[2px]">{t('settings.preferences')}</p>
          <h1 className="text-[24px] font-bold tracking-[-0.4px] text-white mt-1.5">{t('settings.title')}</h1>
          <p className="text-white/75 text-[13px] mt-2 leading-relaxed italic">
            {t('settings.quote')}
          </p>
          <p className="text-white/60 text-[12px] mt-3">
            {t('settings.profileFields', { n: profileFieldCount })} · {isAuthenticated ? t('settings.gmailConnected') : t('settings.gmailOff')} · {(calendarAuth.status.google || calendarAuth.status.microsoft) ? t('settings.calendarConnected') : t('settings.calendarOff')}
          </p>
        </div>
      </div>

      {/* Account Setup Insight */}
      <SettingsInsight
        profile={profile}
        defaults={defaults}
        profilePhoto={profilePhoto}
        businessLogo={businessLogo}
        gmailConnected={isAuthenticated}
        calendarConnected={calendarAuth.status.google || calendarAuth.status.microsoft}
      />

      {/* Profile Section */}
      <div className="bg-surface rounded-[14px] shadow-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-text-primary text-[14px] font-bold">{t('settings.profile')}</h3>
            <p className="text-text-muted text-[11px] mt-0.5">
              {t('settings.profileDesc')}
            </p>
          </div>
          {toast.visible && toast.section === 'profile' && (
            <span className="flex items-center gap-1 text-positive text-[11px] font-semibold">
              <Check size={12} /> {t('settings.saved')}
            </span>
          )}
        </div>

        {/* Profile Photo */}
        <div className="flex items-center gap-4 mb-5 pb-5 border-b border-border">
          <div className="relative group">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center text-white text-[20px] font-bold overflow-hidden"
              style={!profilePhoto ? { background: 'linear-gradient(135deg, #305445 0%, #3e6b5a 100%)' } : undefined}
            >
              {profilePhoto ? (
                <img src={profilePhoto} alt={t('settings.profilePhotoAlt')} className="w-full h-full object-cover" />
              ) : (
                profile.name
                  ? profile.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
                  : 'JD'
              )}
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
            >
              <Camera size={18} className="text-white" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoUpload}
            />
          </div>
          <div>
            <p className="text-text-primary text-[13px] font-semibold">{t('settings.profilePhoto')}</p>
            <p className="text-text-muted text-[11px] mt-0.5">{t('settings.clickToUpload')}</p>
            {profilePhoto && (
              <button
                onClick={handleRemovePhoto}
                className="text-negative text-[11px] font-medium mt-1 hover:underline"
              >
                {t('settings.removePhoto')}
              </button>
            )}
          </div>
        </div>

        {/* Business Logo */}
        <div className="flex items-center gap-4 mb-5 pb-5 border-b border-border">
          <div className="relative group">
            <div
              className="w-16 h-16 rounded-xl flex items-center justify-center overflow-hidden border border-border bg-input-bg/50"
            >
              {businessLogo ? (
                <img src={businessLogo} alt={t('settings.businessLogoAlt')} className="w-full h-full object-contain p-1" />
              ) : (
                <FileText size={24} className="text-text-muted" />
              )}
            </div>
            <button
              onClick={() => logoInputRef.current?.click()}
              className="absolute inset-0 rounded-xl bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
            >
              <Camera size={18} className="text-white" />
            </button>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleLogoUpload}
            />
          </div>
          <div>
            <p className="text-text-primary text-[13px] font-semibold">{t('settings.businessLogo')}</p>
            <p className="text-text-muted text-[11px] mt-0.5">{t('settings.logoAppearsOnInvoices')}</p>
            {businessLogo && (
              <button
                onClick={handleRemoveLogo}
                className="text-negative text-[11px] font-medium mt-1 hover:underline"
              >
                {t('settings.removeLogo')}
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="prof-name" className="text-[12px]">
              {t('settings.freelancerName')}
            </Label>
            <Input
              id="prof-name"
              placeholder={t('settings.namePlaceholder')}
              value={profile.name}
              onChange={(e) => setProfile({ ...profile, name: e.target.value })}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="prof-email" className="text-[12px]">
              {t('settings.email')}
            </Label>
            <Input
              id="prof-email"
              type="email"
              placeholder={t('settings.emailPlaceholder')}
              value={profile.email}
              onChange={(e) => setProfile({ ...profile, email: e.target.value })}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="prof-phone" className="text-[12px]">
              {t('settings.phone')}
            </Label>
            <Input
              id="prof-phone"
              type="tel"
              placeholder="(555) 000-0000"
              value={profile.phone}
              maxLength={14}
              onChange={(e) => setProfile({ ...profile, phone: formatPhone(e.target.value) })}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="prof-address" className="text-[12px]">
              {t('settings.address')}
            </Label>
            <textarea
              id="prof-address"
              rows={2}
              placeholder={t('settings.addressPlaceholder')}
              className="flex w-full rounded-[12px] border border-border bg-input-bg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 ring-offset-surface resize-none"
              value={profile.address}
              onChange={(e) => setProfile({ ...profile, address: e.target.value })}
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 mt-4">
          {profileSaved && (
            <span className="flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-lg bg-status-active-bg text-status-active-text animate-pulse">
              <Check size={14} /> {t('settings.profileSaved')}
            </span>
          )}
          <Button type="button" size="sm" variant="gradient" onClick={handleSaveProfile}>
            <Save size={12} />
            {t('settings.saveProfile')}
          </Button>
        </div>
      </div>

      {/* Gmail Connection Section */}
      <div className="bg-surface rounded-[14px] shadow-card p-5">
        <div className="mb-4">
          <h3 className="text-text-primary text-[14px] font-bold">{t('settings.gmailConnection')}</h3>
          <p className="text-text-muted text-[11px] mt-0.5">
            {t('settings.gmailConnectionDesc')}
          </p>
        </div>

        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{
                background: isAuthenticated
                  ? 'var(--color-status-active-bg)'
                  : 'var(--color-input-bg)',
              }}
            >
              <Mail
                size={14}
                style={{
                  color: isAuthenticated
                    ? 'var(--color-status-active-text)'
                    : 'var(--color-text-muted)',
                }}
              />
            </div>
            <div>
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                style={{
                  background: isAuthenticated
                    ? 'var(--color-status-active-bg)'
                    : 'var(--color-input-bg)',
                  color: isAuthenticated
                    ? 'var(--color-status-active-text)'
                    : 'var(--color-text-muted)',
                }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{
                    background: isAuthenticated
                      ? 'var(--color-status-active-text)'
                      : 'var(--color-text-muted)',
                  }}
                />
                {isAuthenticated ? t('settings.connected') : t('settings.notConnected')}
              </span>
            </div>
          </div>

          {isAuthenticated ? (
            <Button size="sm" variant="outline" onClick={logout}>
              <Unplug size={12} />
              {t('settings.disconnect')}
            </Button>
          ) : (
            <Button
              size="sm"
              variant="gradient"
              onClick={() => login()}
              disabled={gmailLoading}
            >
              <Mail size={12} />
              {gmailLoading ? t('settings.connecting') : t('settings.connectGmail')}
            </Button>
          )}
        </div>
      </div>

      {/* Connected Calendars Section */}
      <div className="bg-surface rounded-[14px] shadow-card p-5">
        <div className="mb-4">
          <h3 className="text-text-primary text-[14px] font-bold">{t('settings.connectedCalendars')}</h3>
          <p className="text-text-muted text-[11px] mt-0.5">
            {t('settings.connectedCalendarsDesc')}
          </p>
        </div>

        {!calendarAuth.configured ? (
          <p className="text-text-muted text-[12px]">
            {t('settings.calendarApiNotConfigured')} <code className="bg-input-bg px-1 py-0.5 rounded text-[11px]">VITE_CALENDAR_API_URL</code> {t('settings.inYourEnv')}
          </p>
        ) : calendarAuth.loading ? (
          <div className="flex items-center gap-2 text-text-muted text-[12px]">
            <Loader2 size={14} className="animate-spin" />
            {t('settings.checkingStatus')}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {/* Google Calendar */}
            <div className="flex items-center justify-between flex-wrap gap-3 p-3 rounded-xl bg-input-bg/40">
              <div className="flex items-center gap-2.5">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{
                    background: calendarAuth.status.google ? '#E8F5E9' : 'var(--color-input-bg)',
                  }}
                >
                  <Calendar
                    size={14}
                    style={{
                      color: calendarAuth.status.google ? '#2E7D32' : 'var(--color-text-muted)',
                    }}
                  />
                </div>
                <div>
                  <p className="text-text-primary text-[13px] font-semibold">{t('settings.googleCalendar')}</p>
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                    style={{
                      background: calendarAuth.status.google ? '#E8F5E9' : 'var(--color-input-bg)',
                      color: calendarAuth.status.google ? '#2E7D32' : 'var(--color-text-muted)',
                    }}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{
                        background: calendarAuth.status.google ? '#2E7D32' : 'var(--color-text-muted)',
                      }}
                    />
                    {calendarAuth.status.google ? t('settings.connected') : t('settings.notConnected')}
                  </span>
                </div>
              </div>

              {calendarAuth.status.google ? (
                <Button size="sm" variant="outline" onClick={() => calendarAuth.disconnect('google')}>
                  <Unplug size={12} />
                  {t('settings.disconnect')}
                </Button>
              ) : (
                <Button size="sm" variant="gradient" onClick={calendarAuth.connectGoogle}>
                  <Calendar size={12} />
                  {t('settings.connectGoogle')}
                </Button>
              )}
            </div>

            {/* Microsoft Outlook */}
            <div className="flex items-center justify-between flex-wrap gap-3 p-3 rounded-xl bg-input-bg/40">
              <div className="flex items-center gap-2.5">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{
                    background: calendarAuth.status.microsoft ? '#E3F2FD' : 'var(--color-input-bg)',
                  }}
                >
                  <Calendar
                    size={14}
                    style={{
                      color: calendarAuth.status.microsoft ? '#1565C0' : 'var(--color-text-muted)',
                    }}
                  />
                </div>
                <div>
                  <p className="text-text-primary text-[13px] font-semibold">{t('settings.outlookCalendar')}</p>
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                    style={{
                      background: calendarAuth.status.microsoft ? '#E3F2FD' : 'var(--color-input-bg)',
                      color: calendarAuth.status.microsoft ? '#1565C0' : 'var(--color-text-muted)',
                    }}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{
                        background: calendarAuth.status.microsoft ? '#1565C0' : 'var(--color-text-muted)',
                      }}
                    />
                    {calendarAuth.status.microsoft ? t('settings.connected') : t('settings.notConnected')}
                  </span>
                </div>
              </div>

              {calendarAuth.status.microsoft ? (
                <Button size="sm" variant="outline" onClick={() => calendarAuth.disconnect('microsoft')}>
                  <Unplug size={12} />
                  {t('settings.disconnect')}
                </Button>
              ) : (
                <Button size="sm" variant="gradient" onClick={calendarAuth.connectMicrosoft}>
                  <Calendar size={12} />
                  {t('settings.connectOutlook')}
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Invoice Defaults Section */}
      <div className="bg-surface rounded-[14px] shadow-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-text-primary text-[14px] font-bold">{t('settings.invoiceDefaults')}</h3>
            <p className="text-text-muted text-[11px] mt-0.5">
              {t('settings.invoiceDefaultsDesc')}
            </p>
          </div>
          {toast.visible && toast.section === 'defaults' && (
            <span className="flex items-center gap-1 text-positive text-[11px] font-semibold">
              <Check size={12} /> {t('settings.saved')}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tax-rate" className="text-[12px]">
              {t('settings.defaultTaxRate')}
            </Label>
            <Input
              id="tax-rate"
              type="number"
              min="0"
              max="100"
              step="0.5"
              placeholder="0"
              value={defaults.taxRate}
              onChange={(e) => setDefaults({ ...defaults, taxRate: e.target.value })}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="payment-terms" className="text-[12px]">
              {t('settings.defaultPaymentTerms')}
            </Label>
            <Input
              id="payment-terms"
              type="number"
              min="0"
              placeholder="30"
              value={defaults.paymentTerms}
              onChange={(e) =>
                setDefaults({ ...defaults, paymentTerms: e.target.value })
              }
            />
          </div>

          <div className="flex flex-col gap-1.5 md:col-span-2">
            <Label htmlFor="notes-template" className="text-[12px]">
              {t('settings.invoiceNotesTemplate')}
            </Label>
            <textarea
              id="notes-template"
              rows={3}
              placeholder={t('settings.notesTemplatePlaceholder')}
              className="flex w-full rounded-[12px] border border-border bg-input-bg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 ring-offset-surface resize-none"
              value={defaults.notesTemplate}
              onChange={(e) =>
                setDefaults({ ...defaults, notesTemplate: e.target.value })
              }
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 mt-4">
          {defaultsSaved && (
            <span className="flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-lg bg-status-active-bg text-status-active-text animate-pulse">
              <Check size={14} /> {t('settings.defaultsSaved')}
            </span>
          )}
          <Button type="button" size="sm" variant="gradient" onClick={handleSaveDefaults}>
            <Save size={12} />
            {t('settings.saveDefaults')}
          </Button>
        </div>
      </div>

      {/* Account Section */}
      <div className="bg-surface rounded-xl border border-border p-5">
        <div className="mb-4">
          <h3 className="text-text-primary text-[14px] font-bold">{t('settings.account')}</h3>
          <p className="text-text-muted text-[11px] mt-0.5">
            {t('settings.signedInAs')} <span className="font-semibold text-text-primary">{user?.email}</span>
          </p>
        </div>
        <button
          onClick={signOut}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-[12px] font-semibold text-negative bg-negative-bg hover:bg-negative/10 transition-colors"
        >
          <LogOut size={14} />
          {t('settings.signOut')}
        </button>
      </div>
    </div>
  )
}
