/** Features the owner has switched off for now (2026-09-05). Code and data stay; delete after a month unused. */
export type Feature = 'meetings' | 'contracts' | 'expenses' | 'emails' | 'calendar'

const HIDDEN: ReadonlySet<Feature> = new Set<Feature>(['meetings', 'contracts', 'expenses'])

export function isFeatureEnabled(feature: Feature): boolean {
  return !HIDDEN.has(feature)
}
