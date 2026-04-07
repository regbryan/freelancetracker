import React, { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search,
  Mail,
  ArrowUpRight,
  ArrowDownLeft,
  ChevronDown,
  ChevronUp,
  Loader2,
  FolderKanban,
} from 'lucide-react'
import { useAllCommunications } from '../hooks/useCommunications'
import { useProjects } from '../hooks/useProjects'

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }) + ' at ' + date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query.trim()) return <>{text}</>
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
  const parts = text.split(regex)
  return (
    <>
      {parts.map((part, i) =>
        regex.test(part)
          ? <mark key={i} className="bg-accent/20 text-accent rounded-sm px-0.5">{part}</mark>
          : <span key={i}>{part}</span>
      )}
    </>
  )
}

export default function EmailSearch() {
  const navigate = useNavigate()
  const { communications, loading } = useAllCommunications()
  const { projects } = useProjects()
  const [search, setSearch] = useState('')
  const [filterDirection, setFilterDirection] = useState<'' | 'sent' | 'received'>('')
  const [filterProject, setFilterProject] = useState('')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const projectMap = useMemo(() => new Map(projects.map(p => [p.id, p])), [projects])

  const filtered = useMemo(() => {
    let results = communications

    if (filterDirection) {
      results = results.filter(c => c.direction === filterDirection)
    }
    if (filterProject) {
      results = results.filter(c => c.project_id === filterProject)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      results = results.filter(c =>
        (c.subject?.toLowerCase().includes(q)) ||
        (c.body?.toLowerCase().includes(q)) ||
        (c.from_email?.toLowerCase().includes(q)) ||
        (c.to_email?.toLowerCase().includes(q))
      )
    }

    return results
  }, [communications, search, filterDirection, filterProject])

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Get unique projects that have communications
  const projectsWithEmails = useMemo(() => {
    const ids = new Set(communications.map(c => c.project_id))
    return projects.filter(p => ids.has(p.id))
  }, [communications, projects])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-32">
        <Loader2 size={28} className="animate-spin text-accent" />
        <p className="text-text-muted text-[13px]">Loading emails...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div>
        <h2 className="text-text-primary text-[20px] font-bold tracking-[-0.3px] flex items-center gap-2">
          <Mail size={20} className="text-accent" />
          Email Search
        </h2>
        <p className="text-text-muted text-[12px] mt-0.5">
          Search across {communications.length} synced email{communications.length !== 1 ? 's' : ''} from all projects
        </p>
      </div>

      {/* Search + Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[250px] max-w-[480px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by subject, body, sender, or recipient..."
            className="w-full h-10 pl-9 pr-3 rounded-lg border border-border bg-input-bg text-text-primary text-[13px] placeholder:text-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all"
            autoFocus
          />
        </div>
        <select
          value={filterDirection}
          onChange={e => setFilterDirection(e.target.value as '' | 'sent' | 'received')}
          className="h-10 px-3 rounded-lg border border-border bg-input-bg text-text-primary text-[12px] focus:outline-none focus:border-accent transition-all"
        >
          <option value="">All Directions</option>
          <option value="sent">Sent</option>
          <option value="received">Received</option>
        </select>
        <select
          value={filterProject}
          onChange={e => setFilterProject(e.target.value)}
          className="h-10 px-3 rounded-lg border border-border bg-input-bg text-text-primary text-[12px] focus:outline-none focus:border-accent transition-all"
        >
          <option value="">All Projects</option>
          {projectsWithEmails.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {/* Results count */}
      {search.trim() && (
        <p className="text-text-muted text-[12px]">
          {filtered.length} result{filtered.length !== 1 ? 's' : ''} found
        </p>
      )}

      {/* Results */}
      {filtered.length === 0 ? (
        <div className="bg-surface rounded-xl border border-border p-12 flex flex-col items-center gap-3">
          <Mail size={32} className="text-text-muted/30" />
          <p className="text-text-muted text-[13px]">
            {communications.length === 0
              ? 'No emails synced yet. Sync emails from a project\'s Communications tab.'
              : 'No emails match your search.'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map(comm => {
            const isSent = comm.direction === 'sent'
            const isExpanded = expandedIds.has(comm.id)
            const hasLongBody = (comm.body?.length ?? 0) > 200
            const proj = projectMap.get(comm.project_id)
            const q = search.trim()

            return (
              <div
                key={comm.id}
                className={`rounded-xl bg-surface border transition-shadow hover:shadow-md ${
                  isSent
                    ? 'border-l-[3px] border-l-accent border-t-border border-r-border border-b-border'
                    : 'border-l-[3px] border-l-positive border-t-border border-r-border border-b-border'
                }`}
              >
                <div className="px-4 py-3">
                  {/* Top row: direction + project + date */}
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        {isSent ? (
                          <ArrowUpRight className="h-3.5 w-3.5 text-accent" />
                        ) : (
                          <ArrowDownLeft className="h-3.5 w-3.5 text-positive" />
                        )}
                        <span className={`text-[11px] font-medium ${isSent ? 'text-accent' : 'text-positive'}`}>
                          {isSent ? 'Sent' : 'Received'}
                        </span>
                      </div>
                      {proj && (
                        <button
                          onClick={() => navigate(`/projects/${proj.id}`)}
                          className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-accent-bg text-accent text-[10px] font-medium hover:underline"
                        >
                          <FolderKanban size={9} />
                          {proj.name}
                        </button>
                      )}
                    </div>
                    <span className="text-[11px] text-text-muted shrink-0">
                      {formatDate(comm.date)}
                    </span>
                  </div>

                  {/* From / To */}
                  <div className="flex items-center gap-3 text-[11px] text-text-muted mb-1">
                    {comm.from_email && (
                      <span>From: {q ? highlightMatch(comm.from_email, q) : comm.from_email}</span>
                    )}
                    {comm.to_email && (
                      <span>To: {q ? highlightMatch(comm.to_email, q) : comm.to_email}</span>
                    )}
                  </div>

                  {/* Subject */}
                  <p className="text-[13px] font-semibold text-text-primary leading-snug">
                    {q && comm.subject ? highlightMatch(comm.subject, q) : (comm.subject || '(no subject)')}
                  </p>

                  {/* Body */}
                  {comm.body && (
                    <p className="mt-1.5 text-[12px] text-text-secondary leading-relaxed whitespace-pre-wrap">
                      {isExpanded
                        ? (q ? highlightMatch(comm.body, q) : comm.body)
                        : (q
                          ? highlightMatch(comm.body.slice(0, 200) + (hasLongBody ? '...' : ''), q)
                          : comm.body.slice(0, 200) + (hasLongBody ? '...' : '')
                        )
                      }
                    </p>
                  )}

                  {/* Expand/collapse */}
                  {hasLongBody && (
                    <button
                      onClick={() => toggleExpand(comm.id)}
                      className="mt-1.5 flex items-center gap-1 text-[11px] text-accent font-medium hover:underline"
                    >
                      {isExpanded ? (
                        <><ChevronUp className="h-3 w-3" /> Show less</>
                      ) : (
                        <><ChevronDown className="h-3 w-3" /> Show more</>
                      )}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
