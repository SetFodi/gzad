import { afterEach, describe, expect, it, vi } from 'vitest'
import { clientIntroductionDestination, finishClientIntroduction, startClientIntroduction } from './client-onboarding'

afterEach(() => { finishClientIntroduction(); vi.unstubAllGlobals() })

describe('client introduction routing', () => {
  it('keeps normal returning client logins unchanged', () => {
    expect(clientIntroductionDestination('/portal/dashboard')).toBe('/portal/dashboard')
  })
  it('opens the introduction after signup and keeps the pending step through verification', () => {
    startClientIntroduction()
    expect(clientIntroductionDestination('/portal/verify')).toBe('/portal/verify')
    expect(clientIntroductionDestination('/portal/login?verified=1')).toBe('/portal/login?verified=1')
    expect(clientIntroductionDestination('/portal/dashboard')).toBe('/portal/dashboard/guide?welcome=1')
    finishClientIntroduction()
    expect(clientIntroductionDestination('/portal/dashboard')).toBe('/portal/dashboard')
  })
  it.each(['/admin', '/fleet'])('preserves the server role destination %s and clears client onboarding', destination => {
    startClientIntroduction()
    expect(clientIntroductionDestination(destination)).toBe(destination)
    expect(clientIntroductionDestination('/portal/dashboard')).toBe('/portal/dashboard')
  })
  it('restores a pending introduction from session storage after a reload', () => {
    vi.stubGlobal('sessionStorage', { getItem: () => 'pending' })
    expect(clientIntroductionDestination('/portal/dashboard')).toBe('/portal/dashboard/guide?welcome=1')
  })
})
