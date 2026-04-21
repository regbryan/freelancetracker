import { useState } from 'react'
import { ChevronDown, ChevronRight, Plus, Trash2, GripVertical } from 'lucide-react'
import type { MeetingTopic, MeetingTopicUpdate } from '../hooks/useMeetingNotes'
import { useI18n } from '../lib/i18n'

interface MeetingTopicEditorProps {
  topics: MeetingTopic[]
  onCreateTopic: (topic: { heading: string; notes: string; sort_order: number }) => Promise<unknown>
  onUpdateTopic: (topicId: string, updates: MeetingTopicUpdate) => Promise<unknown>
  onDeleteTopic: (topicId: string) => Promise<unknown>
}

export default function MeetingTopicEditor({
  topics,
  onCreateTopic,
  onUpdateTopic,
  onDeleteTopic,
}: MeetingTopicEditorProps) {
  const { t } = useI18n()
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set(topics.map(tk => tk.id)))
  const [editingHeading, setEditingHeading] = useState<string | null>(null)
  const [newTopicTitle, setNewTopicTitle] = useState('')
  const [showNewTopic, setShowNewTopic] = useState(false)

  const toggleExpand = (id: string) => {
    setExpandedTopics(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleAddTopic = async () => {
    if (!newTopicTitle.trim()) return
    await onCreateTopic({
      heading: newTopicTitle.trim(),
      notes: '',
      sort_order: topics.length,
    })
    setNewTopicTitle('')
    setShowNewTopic(false)
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Topic List */}
      {topics.map(topic => {
        const isExpanded = expandedTopics.has(topic.id)
        const isEditingHeading = editingHeading === topic.id

        return (
          <div
            key={topic.id}
            className="bg-surface rounded-xl border border-border overflow-hidden transition-all"
          >
            {/* Topic Header */}
            <div className="flex items-center gap-2 px-4 py-3 cursor-pointer hover:bg-input-bg/50 transition-colors"
              onClick={() => toggleExpand(topic.id)}
            >
              <GripVertical size={12} className="text-text-muted/50 shrink-0" />

              {isExpanded ? (
                <ChevronDown size={14} className="text-text-muted shrink-0" />
              ) : (
                <ChevronRight size={14} className="text-text-muted shrink-0" />
              )}

              {isEditingHeading ? (
                <input
                  autoFocus
                  type="text"
                  defaultValue={topic.heading}
                  onClick={e => e.stopPropagation()}
                  onBlur={e => {
                    const val = e.target.value.trim()
                    if (val && val !== topic.heading) {
                      onUpdateTopic(topic.id, { heading: val })
                    }
                    setEditingHeading(null)
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                    if (e.key === 'Escape') setEditingHeading(null)
                  }}
                  className="flex-1 bg-transparent text-text-primary text-[13px] font-semibold border-b border-accent outline-none"
                />
              ) : (
                <span
                  className="flex-1 text-text-primary text-[13px] font-semibold"
                  onDoubleClick={e => { e.stopPropagation(); setEditingHeading(topic.id) }}
                >
                  {topic.heading}
                </span>
              )}

              <button
                type="button"
                onClick={e => { e.stopPropagation(); onDeleteTopic(topic.id) }}
                className="p-1 rounded hover:bg-negative/10 transition-colors opacity-0 group-hover:opacity-100"
                style={{ opacity: 1 }}
              >
                <Trash2 size={12} className="text-negative" />
              </button>
            </div>

            {/* Topic Notes (expanded) */}
            {isExpanded && (
              <div className="px-4 pb-3">
                <textarea
                  value={topic.notes}
                  onChange={e => onUpdateTopic(topic.id, { notes: e.target.value })}
                  placeholder={t('topicEditor.notesPh')}
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-border/50 bg-input-bg/50 text-text-primary text-[12px] placeholder:text-text-muted focus:outline-none focus:border-accent/50 transition-all resize-y"
                />
              </div>
            )}
          </div>
        )
      })}

      {/* Add Topic */}
      {showNewTopic ? (
        <div className="flex items-center gap-2">
          <input
            autoFocus
            type="text"
            value={newTopicTitle}
            onChange={e => setNewTopicTitle(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleAddTopic()
              if (e.key === 'Escape') { setShowNewTopic(false); setNewTopicTitle('') }
            }}
            placeholder={t('topicEditor.headingPh')}
            className="flex-1 h-9 px-3 rounded-lg border border-border bg-input-bg text-text-primary text-[12px] placeholder:text-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all"
          />
          <button
            type="button"
            onClick={handleAddTopic}
            className="h-9 px-3 rounded-lg text-white text-[11px] font-semibold hover:opacity-90 transition-all"
            style={{ background: 'linear-gradient(135deg, #305445 0%, #3e6b5a 100%)' }}
          >
            {t('topicEditor.add')}
          </button>
          <button
            type="button"
            onClick={() => { setShowNewTopic(false); setNewTopicTitle('') }}
            className="h-9 px-3 rounded-lg border border-border text-text-muted text-[11px] hover:bg-input-bg transition-all"
          >
            {t('topicEditor.cancel')}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowNewTopic(true)}
          className="flex items-center gap-1.5 text-accent text-[12px] font-medium hover:text-accent/80 transition-colors py-1"
        >
          <Plus size={14} /> {t('topicEditor.addTopic')}
        </button>
      )}
    </div>
  )
}
