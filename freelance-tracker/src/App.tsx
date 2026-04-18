import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import { Loader2 } from 'lucide-react'

const Clients = lazy(() => import('./pages/Clients'))
const ClientDetail = lazy(() => import('./pages/ClientDetail'))
const Projects = lazy(() => import('./pages/Projects'))
const ProjectDetail = lazy(() => import('./pages/ProjectDetail'))
const TimeTracker = lazy(() => import('./pages/TimeTracker'))
const Tasks = lazy(() => import('./pages/Tasks'))
const Expenses = lazy(() => import('./pages/Expenses'))
const Contracts = lazy(() => import('./pages/Contracts'))
const ContractSign = lazy(() => import('./pages/ContractSign'))
const Invoices = lazy(() => import('./pages/Invoices'))
const Settings = lazy(() => import('./pages/Settings'))
const Calendar = lazy(() => import('./pages/Calendar'))
const MeetingNotes = lazy(() => import('./pages/MeetingNotes'))
const MeetingNoteDetail = lazy(() => import('./pages/MeetingNoteDetail'))
const EmailSearch = lazy(() => import('./pages/EmailSearch'))
const Timeline = lazy(() => import('./pages/Timeline'))

function PageLoader() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <Loader2 size={20} className="animate-spin text-accent" />
    </div>
  )
}

export default function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-accent" />
      </div>
    )
  }

  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Public routes */}
          <Route path="/sign/:token" element={<ContractSign />} />

          {/* Protected routes */}
          {user ? (
            <Route element={<Layout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/clients" element={<Clients />} />
              <Route path="/clients/:id" element={<ClientDetail />} />
              <Route path="/projects" element={<Projects />} />
              <Route path="/projects/:id" element={<ProjectDetail />} />
              <Route path="/tasks" element={<Tasks />} />
              <Route path="/timeline" element={<Timeline />} />
              <Route path="/time" element={<TimeTracker />} />
              <Route path="/expenses" element={<Expenses />} />
              <Route path="/contracts" element={<Contracts />} />
              <Route path="/invoices" element={<Invoices />} />
              <Route path="/meetings" element={<MeetingNotes />} />
              <Route path="/meetings/:id" element={<MeetingNoteDetail />} />
              <Route path="/emails" element={<EmailSearch />} />
              <Route path="/calendar" element={<Calendar />} />
              <Route path="/settings" element={<Settings />} />
            </Route>
          ) : (
            <Route path="*" element={<Login />} />
          )}
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
