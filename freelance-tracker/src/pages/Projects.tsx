import { useState, useMemo, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  TrendingUp,
  Briefcase,
  Plus,
  ChevronRight,
  Loader2,
  FolderOpen,
  Copy,
} from 'lucide-react'
import { useProjects } from '../hooks/useProjects'
import { useClients } from '../hooks/useClients'
import ProjectForm, { type ProjectFormData } from '../components/ProjectForm'

const STATUS_CONFIG: Record<string, { label: string; dotColor: string; textColor: string }> = {
  active: { label: 'Active', dotColor: 'bg-accent', textColor: 'text-accent' },
  completed: { label: 'Completed', dotColor: 'bg-positive', textColor: 'text-positive' },
  on_hold: { label: 'On Hold', dotColor: 'bg-status-hold-text', textColor: 'text-status-hold-text' },
  cancelled: { label: 'Cancelled', dotColor: 'bg-text-muted', textColor: 'text-text-muted' },
}

export default function Projects() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { projects, loading, error, createProject, updateProject } = useProjects()
  const { clients } = useClients()
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed' | 'on_hold'>('all')
  const [formOpen, setFormOpen] = useState(false)

  // Auto-open form when navigated with ?new=1 (e.g. from sidebar button)
  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setFormOpen(true)
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, setSearchParams])
  const [editingProject, setEditingProject] = useState<null | {
    id: string
    clientId: string
    name: string
    description?: string
    status: 'active' | 'completed' | 'on_hold' | 'cancelled'
    type?: string
    hourlyRate?: number
  }>(null)

  // Derive unique project types for the picklist
  const projectTypes = useMemo(() => {
    const types = new Set<string>()
    for (const p of projects) {
      if (p.type) types.add(p.type)
    }
    return Array.from(types).sort()
  }, [projects])

  const handleSave = async (data: ProjectFormData) => {
    if (editingProject) {
      await updateProject(editingProject.id, {
        client_id: data.clientId,
        name: data.name,
        description: data.description ?? null,
        status: data.status,
        type: data.type ?? null,
        hourly_rate: data.hourlyRate ?? null,
      })
    } else {
      await createProject({
        client_id: data.clientId,
        name: data.name,
        description: data.description ?? null,
        status: data.status,
        type: data.type ?? null,
        hourly_rate: data.hourlyRate ?? null,
      })
    }
    setEditingProject(null)
  }

  const openNewForm = () => {
    setEditingProject(null)
    setFormOpen(true)
  }

  const handleCloneProject = async (project: typeof projects[0]) => {
    try {
      await createProject({
        client_id: project.client_id,
        name: `${project.name} (Copy)`,
        description: project.description,
        status: 'active',
        type: project.type,
        hourly_rate: project.hourly_rate,
      })
    } catch (err) {
      console.error('Failed to clone project:', err)
    }
  }

  const filteredProjects = useMemo(() => {
    if (statusFilter === 'all') return projects
    return projects.filter((p) => p.status === statusFilter)
  }, [projects, statusFilter])

  const featuredProject = filteredProjects.length > 0 ? filteredProjects[0] : null
  const remainingProjects = filteredProjects.length > 1 ? filteredProjects.slice(1) : []
  const activeCount = projects.filter((p) => p.status === 'active').length

  // Loading state
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-32">
        <Loader2 size={28} className="animate-spin text-accent" />
        <p className="text-text-muted text-[13px]">Loading projects...</p>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-32">
        <p className="text-negative text-[13px]">Error: {error}</p>
      </div>
    )
  }

  // Empty state
  if (projects.length === 0) {
    return (
      <div className="flex flex-col gap-5">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <p className="font-semibold text-[11px] text-accent tracking-[1.5px] uppercase">
              Your Projects
            </p>
            <h2 className="font-bold text-[20px] text-text-primary tracking-[-0.3px] mt-1">
              Active Projects
            </h2>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center gap-4 py-24 bg-surface rounded-[16px] shadow-card">
          <div className="w-14 h-14 rounded-2xl bg-accent-bg flex items-center justify-center">
            <FolderOpen size={24} className="text-accent" />
          </div>
          <div className="text-center">
            <h3 className="text-text-primary text-[16px] font-bold">No projects yet</h3>
            <p className="text-text-secondary text-[13px] mt-1">
              Create your first project to start tracking time and revenue.
            </p>
          </div>
          <button
            onClick={openNewForm}
            className="mt-2 px-5 py-2.5 rounded-[12px] text-white text-[13px] font-semibold shadow-[0px_8px_24px_rgba(0,88,190,0.35)] hover:shadow-[0px_12px_32px_rgba(0,88,190,0.45)] transition-shadow active:scale-95"
            style={{ background: 'linear-gradient(135deg, #0058be 0%, #2170e4 100%)' }}
          >
            Create Project
          </button>
        </div>

        <ProjectForm
          open={formOpen}
          onOpenChange={setFormOpen}
          clients={clients.map((c) => ({ id: c.id, name: c.name }))}
          projectTypes={projectTypes}
          onSave={handleSave}
        />
      </div>
    )
  }

  const featuredStatus = featuredProject
    ? STATUS_CONFIG[featuredProject.status] ?? STATUS_CONFIG.active
    : STATUS_CONFIG.active

  return (
    <div className="flex flex-col gap-5">
      {/* Header Section */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="font-semibold text-[11px] text-accent tracking-[1.5px] uppercase">
            Your Projects
          </p>
          <h2 className="font-bold text-[20px] text-text-primary tracking-[-0.3px] mt-1">
            Active Projects
          </h2>
        </div>
        <div className="flex gap-3">
          <div className="bg-surface flex items-center gap-2.5 px-4 py-2.5 rounded-[12px] shadow-card">
            <div className="w-7 h-7 rounded-md bg-accent-bg flex items-center justify-center">
              <TrendingUp size={14} className="text-accent" />
            </div>
            <div>
              <p className="font-semibold text-[10px] text-text-muted tracking-wide uppercase">
                Total Projects
              </p>
              <p className="font-bold text-[16px] text-text-primary leading-5">
                {projects.length}
              </p>
            </div>
          </div>
          <div className="bg-surface flex items-center gap-2.5 px-4 py-2.5 rounded-[12px] shadow-card">
            <div className="w-7 h-7 rounded-md bg-accent-bg flex items-center justify-center">
              <Briefcase size={14} className="text-accent" />
            </div>
            <div>
              <p className="font-semibold text-[10px] text-text-muted tracking-wide uppercase">
                Active
              </p>
              <p className="font-bold text-[16px] text-text-primary leading-5">
                {activeCount}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {(['all', 'active', 'completed', 'on_hold'] as const).map((status) => {
          const labels: Record<string, string> = { all: 'All', active: 'Active', completed: 'Completed', on_hold: 'On Hold' }
          const isActive = statusFilter === status
          return (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all ${
                isActive
                  ? 'bg-accent text-white shadow-sm'
                  : 'bg-input-bg text-text-muted hover:text-text-primary hover:bg-border'
              }`}
            >
              {labels[status]}
            </button>
          )
        })}
      </div>

      {/* No results */}
      {filteredProjects.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-16 bg-surface rounded-[16px] shadow-card">
          <p className="text-text-muted text-[13px] font-medium">No projects match this filter.</p>
          <button
            onClick={() => setStatusFilter('all')}
            className="text-accent text-[12px] font-semibold hover:underline"
          >
            Show all projects
          </button>
        </div>
      ) : (
      <>
      {/* Bento Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* Featured Project Card */}
        {featuredProject && (
          <div
            className="lg:col-span-8 bg-surface rounded-[16px] shadow-card p-6 flex flex-col justify-center overflow-hidden relative cursor-pointer hover:shadow-card-hover transition-shadow"
            onClick={() => navigate(`/projects/${featuredProject.id}`)}
          >
            <div className="absolute top-5 right-6">
              <span className={`bg-accent-bg text-[10px] font-semibold tracking-wide px-2.5 py-1 rounded-full ${featuredStatus.textColor}`}>
                {featuredStatus.label}
              </span>
            </div>

            <div className="flex flex-col w-full">
              <div className="flex flex-col gap-1.5 pb-5 w-full">
                <h3 className="text-text-primary text-[20px] font-bold leading-7">
                  {featuredProject.name}
                </h3>
                <p className="text-text-secondary text-[13px]">
                  {featuredProject.clients?.name ?? 'No client'}
                </p>

                <div className="grid grid-cols-3 gap-6 pt-4">
                  <div className="flex flex-col gap-1">
                    <p className="text-text-muted text-[10px] font-semibold uppercase tracking-wider">Status</p>
                    <div className="flex items-center gap-1.5">
                      <div className={`w-1.5 h-1.5 rounded-full ${featuredStatus.dotColor}`} />
                      <span className="text-text-primary text-[13px] font-semibold">
                        {featuredStatus.label}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <p className="text-text-muted text-[10px] font-semibold uppercase tracking-wider">Hourly Rate</p>
                    <span className="text-text-primary text-[13px] font-semibold">
                      {featuredProject.hourly_rate != null
                        ? `$${featuredProject.hourly_rate.toFixed(2)}/hr`
                        : '--'}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <p className="text-text-muted text-[10px] font-semibold uppercase tracking-wider">Created</p>
                    <span className="text-text-primary text-[13px] font-semibold">
                      {new Date(featuredProject.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                </div>
              </div>

              {featuredProject.description && (
                <div className="border-t border-border pt-4">
                  <p className="text-text-secondary text-[13px] leading-[22px] line-clamp-2">
                    {featuredProject.description}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Summary Card (replaces AI Forecast) */}
        <div className="lg:col-span-4 rounded-[16px] shadow-card p-5 flex flex-col items-start justify-between overflow-hidden relative bg-accent-bg-subtle">
          <div className="absolute -top-4 -right-4 w-24 h-24 bg-accent/10 rounded-full blur-[24px]" />

          <div className="pb-3 relative z-10 w-full">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md bg-accent-bg flex items-center justify-center">
                <Briefcase size={12} className="text-accent" />
              </div>
              <span className="text-text-primary text-[12px] font-bold uppercase tracking-wider">Project Summary</span>
            </div>
          </div>

          <div className="pb-4 relative z-10 w-full flex-1">
            <p className="text-text-secondary text-[13px] leading-[22px]">
              You have <span className="font-bold text-accent">{activeCount} active</span>{' '}
              {activeCount === 1 ? 'project' : 'projects'} out of{' '}
              <span className="font-semibold">{projects.length} total</span>.
              {projects.filter((p) => p.status === 'completed').length > 0 && (
                <> <span className="font-semibold">{projects.filter((p) => p.status === 'completed').length}</span> completed.</>
              )}
            </p>
          </div>

          <div className="relative z-10 w-full mt-auto">
            <div className="border-t border-border pt-4 flex flex-col gap-2 w-full">
              <div className="flex items-center justify-between w-full">
                <span className="text-text-primary text-[11px] font-medium">Active Rate</span>
                <span className="text-accent text-[11px] font-bold">
                  {projects.length > 0 ? Math.round((activeCount / projects.length) * 100) : 0}%
                </span>
              </div>
              <div className="w-full h-1.5 bg-accent/10 rounded-full">
                <div
                  className="h-full bg-accent rounded-full transition-all"
                  style={{
                    width: `${projects.length > 0 ? Math.round((activeCount / projects.length) * 100) : 0}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Remaining Project Cards */}
        {remainingProjects.map((project) => {
          const status = STATUS_CONFIG[project.status] ?? STATUS_CONFIG.active
          return (
            <div
              key={project.id}
              className="lg:col-span-4 bg-surface rounded-[16px] shadow-card p-5 flex flex-col gap-1 cursor-pointer hover:shadow-card-hover transition-shadow"
              onClick={() => navigate(`/projects/${project.id}`)}
            >
              <div className="flex items-start justify-between w-full">
                <div className="w-9 h-9 rounded-xl bg-accent-bg flex items-center justify-center">
                  <Briefcase size={16} className="text-accent" />
                </div>
                <span className={`text-[9px] font-bold uppercase ${status.textColor}`}>
                  {status.label}
                </span>
              </div>
              <h3 className="text-text-primary text-[15px] font-bold leading-5 pt-3 truncate">
                {project.name}
              </h3>
              <p className="text-text-secondary text-[12px]">
                {project.clients?.name ?? 'No client'}
              </p>
              <div className="flex items-center justify-between py-3 w-full">
                <span className="text-text-secondary text-[12px]">Hourly Rate</span>
                <span className="text-[12px] font-bold text-text-primary">
                  {project.hourly_rate != null ? `$${project.hourly_rate.toFixed(2)}` : '--'}
                </span>
              </div>
              <div className="border-t border-border flex items-center justify-between pt-3 w-full">
                <div className="flex items-center gap-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${status.dotColor}`} />
                  <span className="text-text-muted text-[10px] font-medium">
                    {status.label}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleCloneProject(project)
                    }}
                    className="p-1 rounded hover:bg-border transition-colors"
                    title="Clone project"
                  >
                    <Copy size={11} className="text-text-muted" />
                  </button>
                  <ChevronRight size={11} className="text-text-muted" />
                </div>
              </div>
            </div>
          )
        })}
      </div>
      </>)}

      {/* FAB */}
      <div className="fixed bottom-6 right-6 z-30">
        <button
          onClick={openNewForm}
          className="w-12 h-12 rounded-full flex items-center justify-center text-white shadow-[0px_8px_24px_rgba(0,88,190,0.35)] hover:shadow-[0px_12px_32px_rgba(0,88,190,0.45)] transition-shadow active:scale-95"
          style={{ background: 'linear-gradient(135deg, #0058be 0%, #2170e4 100%)' }}
        >
          <Plus size={18} />
        </button>
      </div>

      {/* Project Form Dialog */}
      <ProjectForm
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open)
          if (!open) setEditingProject(null)
        }}
        project={editingProject}
        clients={clients.map((c) => ({ id: c.id, name: c.name }))}
        projectTypes={projectTypes}
        onSave={handleSave}
      />
    </div>
  )
}
