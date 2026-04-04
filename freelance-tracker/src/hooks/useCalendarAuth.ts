import { useState, useEffect, useCallback } from 'react'

interface CalendarAuthStatus {
  google: boolean
  microsoft: boolean
}

const ADMIN_PASSWORD_KEY = 'calendar_admin_password'

export function useCalendarAuth() {
  const [status, setStatus] = useState<CalendarAuthStatus>({ google: false, microsoft: false })
  const [loading, setLoading] = useState(true)

  const apiUrl = import.meta.env.VITE_CALENDAR_API_URL || ''

  const checkStatus = useCallback(async () => {
    if (!apiUrl) {
      setLoading(false)
      return
    }
    try {
      const res = await fetch(`${apiUrl}/api/auth-status`)
      const data = await res.json()
      setStatus({ google: !!data.google, microsoft: !!data.microsoft })
    } catch {
      // Silently fail — status stays false
    } finally {
      setLoading(false)
    }
  }, [apiUrl])

  useEffect(() => {
    checkStatus()
  }, [checkStatus])

  // Listen for OAuth callback redirect (URL params ?connected=google etc.)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const connected = params.get('connected')
    const error = params.get('error')

    if (connected || error) {
      // Clean up URL params
      const url = new URL(window.location.href)
      url.searchParams.delete('connected')
      url.searchParams.delete('error')
      window.history.replaceState({}, '', url.pathname + url.search)

      // Refresh status
      checkStatus()
    }
  }, [checkStatus])

  function connectGoogle() {
    if (!apiUrl) return
    const returnUrl = `${window.location.origin}/settings`
    window.location.href = `${apiUrl}/api/auth-google?returnUrl=${encodeURIComponent(returnUrl)}`
  }

  function connectMicrosoft() {
    if (!apiUrl) return
    const returnUrl = `${window.location.origin}/settings`
    window.location.href = `${apiUrl}/api/auth-microsoft?returnUrl=${encodeURIComponent(returnUrl)}`
  }

  async function disconnect(provider: 'google' | 'microsoft') {
    if (!apiUrl) return
    const password = getAdminPassword()
    if (!password) return

    try {
      const res = await fetch(`${apiUrl}/api/disconnect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, password }),
      })
      const data = await res.json()
      if (data.ok) {
        setStatus((prev) => ({ ...prev, [provider]: false }))
      } else if (data.error === 'Unauthorized') {
        // Password was wrong — clear it and prompt again
        localStorage.removeItem(ADMIN_PASSWORD_KEY)
        const newPassword = prompt('Admin password is incorrect. Please re-enter:')
        if (newPassword) {
          localStorage.setItem(ADMIN_PASSWORD_KEY, newPassword)
          return disconnect(provider)
        }
      }
    } catch (err) {
      console.error('Disconnect error:', err)
    }
  }

  function getAdminPassword(): string | null {
    let password = localStorage.getItem(ADMIN_PASSWORD_KEY)
    if (!password) {
      password = prompt('Enter calendar admin password to disconnect:')
      if (password) {
        localStorage.setItem(ADMIN_PASSWORD_KEY, password)
      }
    }
    return password
  }

  return {
    status,
    loading,
    connectGoogle,
    connectMicrosoft,
    disconnect,
    refresh: checkStatus,
    configured: !!apiUrl,
  }
}
