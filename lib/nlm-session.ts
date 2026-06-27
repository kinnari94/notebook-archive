// Server-side in-memory store: which app-session users have connected NotebookLM.
// Keyed by lowercase email. Cleared on logout or server restart.

const connected = new Set<string>()

export function isNlmConnected(email: string): boolean {
  return connected.has(email.toLowerCase())
}

export function setNlmConnected(email: string): void {
  connected.add(email.toLowerCase())
}

export function clearNlmSession(email: string): void {
  connected.delete(email.toLowerCase())
}
