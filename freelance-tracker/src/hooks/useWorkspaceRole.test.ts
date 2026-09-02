import { describe, it, expect } from 'vitest'
import { resolveRole, COLLABORATOR_PATHS, isCollaboratorPath } from './useWorkspaceRole'

describe('resolveRole', () => {
  it('owning any client makes you the owner regardless of other flags', () => {
    expect(resolveRole(true, true, true)).toBe('owner')
  })
  it('a member with no clients is a collaborator, even if also a portal client', () => {
    expect(resolveRole(false, true, true)).toBe('collaborator')
  })
  it('a portal client with nothing else is portal', () => {
    expect(resolveRole(false, false, true)).toBe('portal')
  })
  it('a brand-new account with nothing is owner (freelancer signup path)', () => {
    expect(resolveRole(false, false, false)).toBe('owner')
  })
})

describe('isCollaboratorPath', () => {
  it('allows only timeline and tasks routes', () => {
    expect(COLLABORATOR_PATHS).toEqual(['/timeline', '/tasks'])
    expect(isCollaboratorPath('/timeline')).toBe(true)
    expect(isCollaboratorPath('/timeline?project=x')).toBe(true)
    expect(isCollaboratorPath('/tasks')).toBe(true)
    expect(isCollaboratorPath('/')).toBe(false)
    expect(isCollaboratorPath('/invoices')).toBe(false)
    expect(isCollaboratorPath('/time')).toBe(false)
  })
})
