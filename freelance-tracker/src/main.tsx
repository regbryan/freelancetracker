import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { I18nProvider } from './lib/i18n'

// Sentry is loaded lazily so it stays out of the entry chunk. The initSentry()
// call short-circuits if VITE_SENTRY_DSN isn't set, so this is a no-op in dev
// and CI builds.
if (import.meta.env.VITE_SENTRY_DSN) {
  import('./lib/sentry').then(({ initSentry }) => initSentry())
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </StrictMode>,
)
