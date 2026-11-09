const KEY = 'gzad-client-introduction'
let pending = false

export function startClientIntroduction() {
  pending = true
  try { sessionStorage.setItem(KEY, 'pending') } catch { /* Current-tab fallback. */ }
}

export function finishClientIntroduction() {
  pending = false
  try { sessionStorage.removeItem(KEY) } catch { /* Storage can be unavailable. */ }
}

/** Preserve the server's role and verification decisions; only enrich a client destination. */
export function clientIntroductionDestination(next: string): string {
  let needsIntroduction = pending
  try { needsIntroduction ||= sessionStorage.getItem(KEY) === 'pending' } catch { /* Current-tab fallback. */ }
  if (next === '/admin' || next === '/fleet') finishClientIntroduction()
  return next === '/portal/dashboard' && needsIntroduction ? '/portal/dashboard/guide?welcome=1' : next
}
