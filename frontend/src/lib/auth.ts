/** Signed-in demo session, kept in localStorage so a refresh stays signed in. */
export interface Session {
  token: string
  email: string
  patient_id: string
  name: string
}

const KEY = 'hera.session'
const listeners = new Set<() => void>()

export function getSession(): Session | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Session) : null
  } catch {
    return null
  }
}

export function setSession(s: Session | null) {
  try {
    if (s) localStorage.setItem(KEY, JSON.stringify(s))
    else localStorage.removeItem(KEY)
  } catch {
    // Storage unavailable (private mode): the session lasts for this page only.
  }
  memory = s
  listeners.forEach((fn) => fn())
}

let memory: Session | null = getSession()
export const currentSession = () => memory ?? getSession()

export function onSessionChange(fn: () => void) {
  listeners.add(fn)
  return () => void listeners.delete(fn)
}
