import { useState, useEffect, useRef } from 'react'
import { Save, Check, Mail, Unplug, Calendar, Loader2, Camera, FileText } from 'lucide-react'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Button } from '../components/ui/button'
import { useGmail } from '../hooks/useGmail'
import { useCalendarAuth } from '../hooks/useCalendarAuth'

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

const PROFILE_KEY = 'freelancer_profile'
const DEFAULTS_KEY = 'invoice_defaults'

function loadProfile(): FreelancerProfile {
  try {
    const raw = localStorage.getItem(PROFILE_KEY)
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
  const { isAuthenticated, login, logout, loading: gmailLoading } = useGmail()
  const calendarAuth = useCalendarAuth()

  // Profile photo
  const [profilePhoto, setProfilePhoto] = useState<string>(localStorage.getItem('freelancer_photo') || '')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Business logo (for invoices)
  const [businessLogo, setBusinessLogo] = useState<string>(localStorage.getItem('freelancer_logo') || '')
  const logoInputRef = useRef<HTMLInputElement>(null)

  function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      alert('Image must be under 2MB')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      setProfilePhoto(dataUrl)
      localStorage.setItem('freelancer_photo', dataUrl)
    }
    reader.readAsDataURL(file)
  }

  function handleRemovePhoto() {
    setProfilePhoto('')
    localStorage.removeItem('freelancer_photo')
  }

  function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      alert('Logo must be under 2MB')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      setBusinessLogo(dataUrl)
      localStorage.setItem('freelancer_logo', dataUrl)
    }
    reader.readAsDataURL(file)
  }

  function handleRemoveLogo() {
    setBusinessLogo('')
    localStorage.removeItem('freelancer_logo')
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
      localStorage.setItem(PROFILE_KEY, JSON.stringify(profile))
      showToast('profile')
    } catch (err) {
      console.error('Failed to save profile:', err)
      alert('Failed to save profile. Please try again.')
    }
  }

  function handleSaveDefaults() {
    try {
      localStorage.setItem(DEFAULTS_KEY, JSON.stringify(defaults))
      showToast('defaults')
    } catch (err) {
      console.error('Failed to save defaults:', err)
      alert('Failed to save defaults. Please try again.')
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div>
        <p className="text-accent text-[11px] font-semibold uppercase tracking-[1.5px]">
          Preferences
        </p>
        <h2 className="text-text-primary text-[20px] font-bold tracking-[-0.3px] mt-1">
          Settings
        </h2>
      </div>

      {/* Profile Section */}
      <div className="bg-surface rounded-[14px] shadow-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-text-primary text-[14px] font-bold">Profile</h3>
            <p className="text-text-muted text-[11px] mt-0.5">
              Your details appear on invoices and communications.
            </p>
          </div>
          {toast.visible && toast.section === 'profile' && (
            <span className="flex items-center gap-1 text-positive text-[11px] font-semibold">
              <Check size={12} /> Saved
            </span>
          )}
        </div>

        {/* Profile Photo */}
        <div className="flex items-center gap-4 mb-5 pb-5 border-b border-border">
          <div className="relative group">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center text-white text-[20px] font-bold overflow-hidden"
              style={!profilePhoto ? { background: 'linear-gradient(135deg, #0058be 0%, #2170e4 100%)' } : undefined}
            >
              {profilePhoto ? (
                <img src={profilePhoto} alt="Profile" className="w-full h-full object-cover" />
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
            <p className="text-text-primary text-[13px] font-semibold">Profile Photo</p>
            <p className="text-text-muted text-[11px] mt-0.5">Click to upload (max 2MB)</p>
            {profilePhoto && (
              <button
                onClick={handleRemovePhoto}
                className="text-negative text-[11px] font-medium mt-1 hover:underline"
              >
                Remove photo
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
                <img src={businessLogo} alt="Business Logo" className="w-full h-full object-contain p-1" />
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
            <p className="text-text-primary text-[13px] font-semibold">Business Logo</p>
            <p className="text-text-muted text-[11px] mt-0.5">Appears on your invoices (max 2MB)</p>
            {businessLogo && (
              <button
                onClick={handleRemoveLogo}
                className="text-negative text-[11px] font-medium mt-1 hover:underline"
              >
                Remove logo
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="prof-name" className="text-[12px]">
              Freelancer Name
            </Label>
            <Input
              id="prof-name"
              placeholder="Jane Doe"
              value={profile.name}
              onChange={(e) => setProfile({ ...profile, name: e.target.value })}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="prof-email" className="text-[12px]">
              Email
            </Label>
            <Input
              id="prof-email"
              type="email"
              placeholder="jane@example.com"
              value={profile.email}
              onChange={(e) => setProfile({ ...profile, email: e.target.value })}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="prof-phone" className="text-[12px]">
              Phone
            </Label>
            <Input
              id="prof-phone"
              type="tel"
              placeholder="+1 (555) 000-0000"
              value={profile.phone}
              onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="prof-address" className="text-[12px]">
              Address
            </Label>
            <textarea
              id="prof-address"
              rows={2}
              placeholder="123 Main St, City, ST 00000"
              className="flex w-full rounded-[12px] border border-border bg-input-bg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 ring-offset-surface resize-none"
              value={profile.address}
              onChange={(e) => setProfile({ ...profile, address: e.target.value })}
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 mt-4">
          {profileSaved && (
            <span className="flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-lg bg-status-active-bg text-status-active-text animate-pulse">
              <Check size={14} /> Profile Saved!
            </span>
          )}
          <Button type="button" size="sm" variant="gradient" onClick={handleSaveProfile}>
            <Save size={12} />
            Save Profile
          </Button>
        </div>
      </div>

      {/* Gmail Connection Section */}
      <div className="bg-surface rounded-[14px] shadow-card p-5">
        <div className="mb-4">
          <h3 className="text-text-primary text-[14px] font-bold">Gmail Connection</h3>
          <p className="text-text-muted text-[11px] mt-0.5">
            Connect your Gmail to send and receive emails from project pages.
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
                {isAuthenticated ? 'Connected' : 'Not connected'}
              </span>
            </div>
          </div>

          {isAuthenticated ? (
            <Button size="sm" variant="outline" onClick={logout}>
              <Unplug size={12} />
              Disconnect
            </Button>
          ) : (
            <Button
              size="sm"
              variant="gradient"
              onClick={login}
              disabled={gmailLoading}
            >
              <Mail size={12} />
              {gmailLoading ? 'Connecting...' : 'Connect Gmail'}
            </Button>
          )}
        </div>
      </div>

      {/* Connected Calendars Section */}
      <div className="bg-surface rounded-[14px] shadow-card p-5">
        <div className="mb-4">
          <h3 className="text-text-primary text-[14px] font-bold">Connected Calendars</h3>
          <p className="text-text-muted text-[11px] mt-0.5">
            Connect your Google Calendar and Outlook to see events on the Calendar page.
          </p>
        </div>

        {!calendarAuth.configured ? (
          <p className="text-text-muted text-[12px]">
            Calendar API not configured. Set <code className="bg-input-bg px-1 py-0.5 rounded text-[11px]">VITE_CALENDAR_API_URL</code> in your environment.
          </p>
        ) : calendarAuth.loading ? (
          <div className="flex items-center gap-2 text-text-muted text-[12px]">
            <Loader2 size={14} className="animate-spin" />
            Checking connection status...
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
                  <p className="text-text-primary text-[13px] font-semibold">Google Calendar</p>
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
                    {calendarAuth.status.google ? 'Connected' : 'Not connected'}
                  </span>
                </div>
              </div>

              {calendarAuth.status.google ? (
                <Button size="sm" variant="outline" onClick={() => calendarAuth.disconnect('google')}>
                  <Unplug size={12} />
                  Disconnect
                </Button>
              ) : (
                <Button size="sm" variant="gradient" onClick={calendarAuth.connectGoogle}>
                  <Calendar size={12} />
                  Connect Google
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
                  <p className="text-text-primary text-[13px] font-semibold">Outlook Calendar</p>
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
                    {calendarAuth.status.microsoft ? 'Connected' : 'Not connected'}
                  </span>
                </div>
              </div>

              {calendarAuth.status.microsoft ? (
                <Button size="sm" variant="outline" onClick={() => calendarAuth.disconnect('microsoft')}>
                  <Unplug size={12} />
                  Disconnect
                </Button>
              ) : (
                <Button size="sm" variant="gradient" onClick={calendarAuth.connectMicrosoft}>
                  <Calendar size={12} />
                  Connect Outlook
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
            <h3 className="text-text-primary text-[14px] font-bold">Invoice Defaults</h3>
            <p className="text-text-muted text-[11px] mt-0.5">
              Pre-fill values when creating new invoices.
            </p>
          </div>
          {toast.visible && toast.section === 'defaults' && (
            <span className="flex items-center gap-1 text-positive text-[11px] font-semibold">
              <Check size={12} /> Saved
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tax-rate" className="text-[12px]">
              Default Tax Rate (%)
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
              Default Payment Terms (days)
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
              Invoice Notes Template
            </Label>
            <textarea
              id="notes-template"
              rows={3}
              placeholder="Thank you for your business! Payment is due within the specified terms."
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
              <Check size={14} /> Defaults Saved!
            </span>
          )}
          <Button type="button" size="sm" variant="gradient" onClick={handleSaveDefaults}>
            <Save size={12} />
            Save Defaults
          </Button>
        </div>
      </div>
    </div>
  )
}
