import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Clients from './pages/Clients'
import ClientDetail from './pages/ClientDetail'
import Projects from './pages/Projects'
import ProjectDetail from './pages/ProjectDetail'
import TimeTracker from './pages/TimeTracker'
import Expenses from './pages/Expenses'
import Contracts from './pages/Contracts'
import ContractSign from './pages/ContractSign'
import Invoices from './pages/Invoices'
import Settings from './pages/Settings'
import Calendar from './pages/Calendar'
import { Loader2 } from 'lucide-react'

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
            <Route path="/time" element={<TimeTracker />} />
            <Route path="/expenses" element={<Expenses />} />
            <Route path="/contracts" element={<Contracts />} />
            <Route path="/invoices" element={<Invoices />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        ) : (
          <Route path="*" element={<Login />} />
        )}
      </Routes>
    </BrowserRouter>
  )
}
