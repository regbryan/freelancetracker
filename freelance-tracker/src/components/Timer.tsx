import { useState, useEffect, useRef, useCallback } from 'react'
import { Play, Pause, Square } from 'lucide-react'

interface TimerProps {
  projectId?: string
  projects?: { id: string; name: string }[]
  onSave: (data: {
    projectId: string
    description: string
    hours: number
    date: string
  }) => Promise<void>
}

export default function Timer({ projectId, projects, onSave }: TimerProps) {
  const [selectedProjectId, setSelectedProjectId] = useState(projectId ?? '')
  const [description, setDescription] = useState('')
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [isRunning, setIsRunning] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Sync selectedProjectId if the projectId prop changes
  useEffect(() => {
    if (projectId) {
      setSelectedProjectId(projectId)
    }
  }, [projectId])

  // Timer interval management
  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1)
      }, 1000)
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [isRunning])

  const formatTime = (totalSeconds: number): string => {
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    return [hours, minutes, seconds]
      .map((v) => String(v).padStart(2, '0'))
      .join(':')
  }

  const handleStartPause = () => {
    setIsRunning((prev) => !prev)
  }

  const handleStop = useCallback(async () => {
    if (elapsedSeconds === 0) return

    setIsRunning(false)

    // Round up to nearest 0.25 hour (15 min) increment
    const rawHours = elapsedSeconds / 3600
    const hours = Math.ceil(rawHours * 4) / 4
    const date = new Date().toISOString().split('T')[0]

    setIsSaving(true)
    try {
      await onSave({
        projectId: selectedProjectId,
        description,
        hours,
        date,
      })
    } finally {
      setIsSaving(false)
    }

    // Reset state
    setElapsedSeconds(0)
    setDescription('')
    if (!projectId) {
      setSelectedProjectId('')
    }
  }, [elapsedSeconds, selectedProjectId, description, projectId, onSave])

  const showProjectSelector = !projectId

  return (
    <div className="bg-surface rounded-[14px] shadow-card p-5">
      <div className="flex flex-col gap-3">
        {/* Status pill */}
        <div className="flex items-center justify-between">
          <div
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-[1.2px] transition-colors ${
              isRunning
                ? 'bg-negative-bg text-negative'
                : elapsedSeconds > 0
                  ? 'bg-status-medium-bg text-status-medium-text'
                  : 'bg-input-bg text-text-muted'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isRunning ? 'bg-negative animate-pulse' : elapsedSeconds > 0 ? 'bg-status-medium-text' : 'bg-text-muted'
              }`}
            />
            {isRunning ? 'Active Session' : elapsedSeconds > 0 ? 'Paused' : 'Ready'}
          </div>
          {elapsedSeconds > 0 && (
            <span className="text-text-muted text-[10px] font-medium">
              Auto-rounded to 15-min increment on save
            </span>
          )}
        </div>

        {/* Input row: description + optional project selector */}
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What are you working on?"
              className="w-full h-9 px-3 bg-input-bg rounded-lg text-[12px] text-text-secondary placeholder:text-text-muted border-none outline-none focus:ring-2 focus:ring-accent/20 transition-all"
            />
          </div>
          {showProjectSelector && (
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="h-9 px-3 bg-input-bg rounded-lg text-[12px] text-text-secondary border-none outline-none appearance-none cursor-pointer min-w-[140px]"
            >
              <option value="">Select Project</option>
              {projects?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Timer display + controls */}
        <div className="flex items-center justify-between">
          <span className="text-text-primary text-[32px] font-bold font-mono tracking-wider">
            {formatTime(elapsedSeconds)}
          </span>

          <div className="flex items-center gap-2">
            {/* Start / Pause / Resume */}
            <button
              onClick={handleStartPause}
              disabled={isSaving}
              className="w-10 h-10 rounded-full flex items-center justify-center text-white transition-all active:scale-95 disabled:opacity-50"
              style={{
                background: isRunning
                  ? '#ef4444'
                  : 'linear-gradient(135deg, #0058be 0%, #2170e4 100%)',
              }}
              aria-label={isRunning ? 'Pause timer' : 'Start timer'}
            >
              {isRunning ? (
                <Pause size={16} />
              ) : (
                <Play size={16} className="ml-0.5" />
              )}
            </button>

            {/* Stop + Save */}
            <button
              onClick={handleStop}
              disabled={elapsedSeconds === 0 || isSaving}
              className="w-10 h-10 rounded-full flex items-center justify-center text-white transition-all active:scale-95 disabled:opacity-40"
              style={{
                background: 'linear-gradient(135deg, #0058be 0%, #2170e4 100%)',
              }}
              aria-label="Stop timer and save entry"
            >
              <Square size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
