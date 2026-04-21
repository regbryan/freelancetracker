import { useState } from 'react';
import { ArrowUpRight, ArrowDownLeft, ChevronDown, ChevronUp, Mail, Loader2, CornerUpLeft } from 'lucide-react';
import type { Communication } from '@/hooks/useCommunications';
import { useI18n } from '../lib/i18n';

interface CommunicationFeedProps {
  communications: Communication[];
  loading?: boolean;
  onReply?: (comm: Communication) => void;
}

function formatDate(dateString: string, locale: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }) + ' · ' + date.toLocaleTimeString(locale, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function truncateBody(body: string | null, maxLength: number = 100): string {
  if (!body) return '';
  if (body.length <= maxLength) return body;
  return body.slice(0, maxLength).trimEnd() + '...';
}

export default function CommunicationFeed({ communications, loading, onReply }: CommunicationFeedProps) {
  const { t, lang } = useI18n();
  const locale = lang === 'es' ? 'es-ES' : 'en-US';
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  // Sort by date descending (most recent first)
  const sorted = [...communications].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-accent" />
        <p className="mt-2 text-[12px] text-text-muted">{t('commFeed.loading')}</p>
      </div>
    );
  }

  if (sorted.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-input-bg">
          <Mail className="h-5 w-5 text-text-muted" />
        </div>
        <p className="mt-3 text-[12px] text-text-muted text-center">
          {t('commFeed.empty')}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {sorted.map((comm) => {
        const isSent = comm.direction === 'sent';
        const isExpanded = expandedIds.has(comm.id);
        const hasLongBody = (comm.body?.length ?? 0) > 100;
        const canReply = !isSent && !!onReply;

        return (
          <div
            key={comm.id}
            className={`rounded-[12px] bg-surface border transition-shadow hover:shadow-card-hover ${
              isSent
                ? 'border-l-[3px] border-l-accent border-t-border border-r-border border-b-border'
                : 'border-l-[3px] border-l-positive border-t-border border-r-border border-b-border'
            }`}
          >
            {/* Clickable header / body area */}
            <button
              type="button"
              onClick={() => hasLongBody && toggleExpand(comm.id)}
              className={`w-full text-left px-4 py-3 ${hasLongBody ? 'cursor-pointer' : 'cursor-default'}`}
            >
              {/* Top row: direction + date */}
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-1.5">
                  {isSent ? (
                    <ArrowUpRight className="h-3.5 w-3.5 text-accent" />
                  ) : (
                    <ArrowDownLeft className="h-3.5 w-3.5 text-positive" />
                  )}
                  <span className={`text-[11px] font-medium ${isSent ? 'text-accent' : 'text-positive'}`}>
                    {isSent ? t('commFeed.sent') : t('commFeed.received')}
                  </span>
                </div>
                <span className="text-[11px] text-text-muted">
                  {formatDate(comm.date, locale)}
                </span>
              </div>

              {/* Subject */}
              <p className="text-[13px] font-semibold text-text-primary leading-snug">
                {comm.subject || t('commFeed.noSubject')}
              </p>

              {/* Body preview / full */}
              {comm.body && (
                <p className="mt-1 text-[12px] text-text-secondary leading-relaxed whitespace-pre-wrap">
                  {isExpanded ? comm.body : truncateBody(comm.body)}
                </p>
              )}

              {/* Expand/collapse hint */}
              {hasLongBody && (
                <div className="mt-1.5 flex items-center gap-1 text-[11px] text-text-muted">
                  {isExpanded ? (
                    <><ChevronUp className="h-3 w-3" /><span>{t('commFeed.showLess')}</span></>
                  ) : (
                    <><ChevronDown className="h-3 w-3" /><span>{t('commFeed.showMore')}</span></>
                  )}
                </div>
              )}
            </button>

            {/* Footer: reply button (received emails only) */}
            {canReply && (
              <div className="px-4 pb-2.5 flex justify-end border-t border-border/40 pt-2">
                <button
                  type="button"
                  onClick={() => onReply(comm)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-accent hover:bg-accent-bg transition-colors"
                >
                  <CornerUpLeft className="h-3 w-3" />
                  {t('commFeed.reply')}
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
