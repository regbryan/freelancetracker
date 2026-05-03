import { useEffect, useMemo, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, X, FolderKanban, Users, CheckSquare, FileText, BookOpen, ArrowRight } from 'lucide-react'
import { useProjects } from '../hooks/useProjects'
import { useClients } from '../hooks/useClients'
import { useTasks } from '../hooks/useTasks'
import { useInvoices } from '../hooks/useInvoices'
import { useMeetingNotes } from '../hooks/useMeetingNotes'

interface SearchResult {
  id: string
  label: string
  sublabel?: string
  to: string
  kind: 'project' | 'client' | 'task' | 'invoice' | 'meeting'
}

const KIND_META: Record<SearchResult['kind'], { icon: typeof FolderKanban; label: string; tone: string }> = {
  project: { icon: FolderKanban, label: 'Project', tone: 'text-accent' },
  client: { icon: Users, label: 'Client', tone: 'text-blue-500' },
  task: { icon: CheckSquare, label: 'Task', tone: 'text-emerald-600' },
  invoice: { icon: FileText, label: 'Invoice', tone: 'text-amber-500' },
  meeting: { icon: BookOpen, label: 'Meeting', tone: 'text-purple-500' },
}

interface Props {
  open: boolean
  onClose: () => void
}

/**
 * Cmd-K / Ctrl-K global search palette.
 * Searches across clients, projects, tasks, invoices, and meeting notes.
 */
export default function CommandPalette({ open, onClose }: Props) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(0)
  const inputRef = useRef<HTMLInputElement | null>(null)

  // Only fetch when open to keep cold-load light
  const { projects } = useProjects()
  const { clients } = useClients()
  const { tasks } = useTasks()
  const { invoices } = useInvoices()
  const { meetingNotes } = useMeetingNotes()

  // Build the unified result list (memoized; filtered by query)
  const results = useMemo<SearchResult[]>(() => {
    const q = query.trim().toLowerCase()
    const out: SearchResult[] = []

    const matches = (s: string | null | undefined) => !q || (s ?? '').toLowerCase().includes(q)

    for (const c of clients) {
      if (matches(c.name) || matches(c.company) || matches(c.email)) {
        out.push({ id: `client-${c.id}`, label: c.name, sublabel: c.company ?? c.email ?? '', to: `/clients/${c.id}`, kind: 'client' })
      }
    }
    for (const p of projects) {
      if (matches(p.name) || matches(p.clients?.name)) {
        out.push({ id: `project-${p.id}`, label: p.name, sublabel: p.clients?.name ?? '', to: `/projects/${p.id}`, kind: 'project' })
      }
    }
    for (const t of tasks) {
      if (matches(t.title)) {
        const proj = projects.find((p) => p.id === t.project_id)
        out.push({ id: `task-${t.id}`, label: t.title, sublabel: proj?.name ?? '', to: proj ? `/projects/${proj.id}` : '/tasks', kind: 'task' })
      }
    }
    for (const i of invoices) {
      if (matches(i.invoice_number)) {
        out.push({ id: `invoice-${i.id}`, label: i.invoice_number, sublabel: `$${i.total.toFixed(2)} · ${i.status}`, to: '/invoices', kind: 'invoice' })
      }
    }
    for (const m of meetingNotes) {
      if (matches(m.title) || matches(m.summary)) {
        out.push({ id: `meeting-${m.id}`, label: m.title, sublabel: m.summary ?? '', to: `/meetings/${m.id}`, kind: 'meeting' })
      }
    }

    // Without a query, show top 8 across kinds (recent-ish — Supabase already orders by created_at desc on most)
    return q ? out.slice(0, 50) : out.slice(0, 8)
  }, [query, projects, clients, tasks, invoices, meetingNotes])

  // Reset highlight + focus input when the palette opens or query changes
  useEffect(() => {
    if (open) {
      setHighlight(0)
      // Defer to next tick so the input is mounted
      setTimeout(() => inputRef.current?.focus(), 10)
    } else {
      setQuery('')
    }
  }, [open])

  useEffect(() => { setHighlight(0) }, [query])

  // Keyboard nav inside the palette
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); return }
      if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight((h) => Math.min(h + 1, results.length - 1)); return }
      if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight((h) => Math.max(h - 1, 0)); return }
      if (e.key === 'Enter') {
        e.preventDefault()
        const r = results[highlight]
        if (r) { navigate(r.to); onClose() }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, results, highlight, onClose, navigate])

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center pt-[10vh] px-4" onClick={onClose}>
      <div
        className="bg-surface w-full max-w-xl rounded-2xl shadow-2xl border border-border overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search size={16} className="text-text-muted shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search clients, projects, tasks, invoices, meetings…"
            className="flex-1 bg-transparent text-[14px] text-text-primary placeholder:text-text-muted focus:outline-none"
          />
          <kbd className="hidden sm:inline-flex items-center px-1.5 h-5 rounded border border-border text-[10px] font-mono text-text-muted">esc</kbd>
          <button onClick={onClose} className="p-1 rounded hover:bg-input-bg sm:hidden">
            <X size={14} className="text-text-muted" />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-[50vh] overflow-y-auto py-1">
          {results.length === 0 ? (
            <div className="px-4 py-8 text-center text-text-muted text-[12px]">
              {query ? 'No matches.' : 'Start typing to search…'}
            </div>
          ) : (
            results.map((r, i) => {
              const meta = KIND_META[r.kind]
              const isActive = i === highlight
              return (
                <button
                  key={r.id}
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => { navigate(r.to); onClose() }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${isActive ? 'bg-input-bg' : 'hover:bg-input-bg/60'}`}
                >
                  <meta.icon size={14} className={`${meta.tone} shrink-0`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-medium text-text-primary truncate">{r.label}</span>
                      <span className="text-[10px] uppercase tracking-wide text-text-muted shrink-0">{meta.label}</span>
                    </div>
                    {r.sublabel && <p className="text-[11px] text-text-muted truncate">{r.sublabel}</p>}
                  </div>
                  {isActive && <ArrowRight size={12} className="text-text-muted shrink-0" />}
                </button>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-border bg-input-bg/40 flex items-center justify-between text-[10px] text-text-muted">
          <div className="flex items-center gap-3">
            <span><kbd className="font-mono">↑↓</kbd> navigate</span>
            <span><kbd className="font-mono">↵</kbd> open</span>
          </div>
          <span><kbd className="font-mono">⌘K</kbd> to toggle</span>
        </div>
      </div>
    </div>
  )
}
