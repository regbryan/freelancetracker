import { supabase } from './supabase'

export interface AiSearchEmail {
  id: string
  subject: string
  from: string
  to: string
  date: string
  snippet: string
}

export interface AiSearchMatch {
  id: string
  reason: string
}

export interface AiSearchResult {
  summary: string
  matches: AiSearchMatch[]
}

export type AiSearchErrorCode = 'timeout' | 'shape' | 'network' | 'unknown'

export class AiSearchError extends Error {
  readonly code: AiSearchErrorCode
  constructor(message: string, code: AiSearchErrorCode = 'unknown') {
    super(message)
    this.code = code
  }
}

function isValidResult(data: unknown): data is AiSearchResult {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  if (typeof d.summary !== 'string') return false
  if (!Array.isArray(d.matches)) return false
  return d.matches.every((m: unknown) => {
    if (!m || typeof m !== 'object') return false
    const x = m as Record<string, unknown>
    return typeof x.id === 'string' && typeof x.reason === 'string'
  })
}

interface RunOptions {
  query: string
  emails: AiSearchEmail[]
  signal?: AbortSignal
  timeoutMs?: number
}

export async function runAiSearch({ query, emails, signal, timeoutMs = 30_000 }: RunOptions): Promise<AiSearchResult> {
  const trimmedQuery = query.trim()
  if (!trimmedQuery) throw new AiSearchError('Empty query', 'shape')
  if (emails.length === 0) throw new AiSearchError('No emails to search', 'shape')

  const controller = new AbortController()
  const externalAbort = () => controller.abort()
  signal?.addEventListener('abort', externalAbort)
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const { data, error } = await supabase.functions.invoke('ai-search', {
      body: { query: trimmedQuery, emails: emails.slice(0, 200) },
    })

    if (error) {
      const msg = error instanceof Error ? error.message : 'AI search failed'
      throw new AiSearchError(msg, 'network')
    }

    if (!isValidResult(data)) {
      throw new AiSearchError('AI search returned an unexpected response shape', 'shape')
    }

    return data
  } catch (e) {
    if (controller.signal.aborted) {
      throw new AiSearchError('AI search timed out', 'timeout')
    }
    if (e instanceof AiSearchError) throw e
    throw new AiSearchError(e instanceof Error ? e.message : 'Unknown error', 'unknown')
  } finally {
    clearTimeout(timeoutId)
    signal?.removeEventListener('abort', externalAbort)
  }
}

const CONSENT_KEY = 'ai_search_consent_v1'

export function hasAiConsent(): boolean {
  try {
    return localStorage.getItem(CONSENT_KEY) === 'granted'
  } catch {
    return false
  }
}

export function grantAiConsent(): void {
  try {
    localStorage.setItem(CONSENT_KEY, 'granted')
  } catch { /* ignore */ }
}

export function revokeAiConsent(): void {
  try {
    localStorage.removeItem(CONSENT_KEY)
  } catch { /* ignore */ }
}
