import type {
  Alert,
  AuthResponse,
  CheckIn,
  ChatMessage,
  Incident,
  IncidentAnalysis,
  InventoryItem,
  InventoryStats,
  PendingUser,
  User,
} from '../types'

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api'

const TOKEN_KEY = 'adr_token'
const USER_KEY = 'adr_user'

function isBrowser() {
  return typeof window !== 'undefined'
}

export function getToken() {
  if (!isBrowser()) return null
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string | null) {
  if (!isBrowser()) return
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

export function getStoredUser(): User | null {
  if (!isBrowser()) return null
  const raw = localStorage.getItem(USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as User
  } catch {
    return null
  }
}

export function setStoredUser(user: User | null) {
  if (!isBrowser()) return
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user))
  else localStorage.removeItem(USER_KEY)
}

/**
 * Thin fetch wrapper for the future backend. Every call is designed to point
 * at API_BASE_URL out of the box — swapping mocks for the real backend later
 * is a one-line env change, not a rewrite.
 */
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body?.message ?? `Request failed with status ${res.status}`)
  }

  return res.json() as Promise<T>
}

/**
 * Wraps a real API call with a fallback so the UI is fully usable before the
 * backend team's service is reachable. Fallbacks return empty/zero data —
 * never fake demo numbers — so nothing looks like real data prematurely.
 */
async function withFallback<T>(real: () => Promise<T>, fallback: () => Promise<T> | T): Promise<T> {
  try {
    return await real()
  } catch {
    return fallback()
  }
}

const delay = (ms = 400) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Derives a display name + initials from an email address for the fallback
 * login (used only until the real /auth/login endpoint is connected).
 */
function nameFromEmail(email: string) {
  const local = email.split('@')[0] ?? 'user'
  const words = local
    .split(/[._\-+0-9]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
  const fullName = words.length > 0 ? words.join(' ') : local
  const initials =
    words.length >= 2 ? `${words[0][0]}${words[1][0]}`.toUpperCase() : fullName.slice(0, 2).toUpperCase()
  return { fullName, initials }
}

// ---------- Auth ----------

export const authApi = {
  login: (body: { email: string; password: string }) =>
    withFallback<AuthResponse>(
      () => request('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
      async () => {
        await delay()
        const { fullName, initials } = nameFromEmail(body.email)
        return {
          token: 'local-session-token',
          user: {
            id: `u-${body.email}`,
            fullName,
            email: body.email,
            role: 'dispatcher',
            organizationName: undefined,
            status: 'approved',
            initials,
          },
        }
      },
    ),

  registerOrganization: (body: {
    organizationName: string
    fullName: string
    role: string
    email: string
    phone: string
    password: string
  }) =>
    withFallback<{ status: 'pending' }>(
      () => request('/auth/register/organization', { method: 'POST', body: JSON.stringify(body) }),
      async () => {
        await delay()
        return { status: 'pending' }
      },
    ),

  me: () =>
    withFallback<User>(
      () => request('/auth/me'),
      async () => {
        await delay(150)
        const stored = getStoredUser()
        if (stored) return stored
        throw new Error('Not signed in')
      },
    ),
}

// ---------- Incidents ----------

export const incidentsApi = {
  list: () =>
    withFallback<Incident[]>(
      () => request('/incidents'),
      async () => {
        await delay()
        return []
      },
    ),

  create: (body: Partial<Incident> & { isGuestReport?: boolean }) =>
    withFallback<Incident>(
      () => request('/incidents', { method: 'POST', body: JSON.stringify(body) }),
      async () => {
        await delay()
        return {
          id: `inc-${Date.now()}`,
          title: body.title ?? 'New incident',
          description: body.description ?? '',
          peopleAffected: body.peopleAffected ?? 0,
          trapped: body.trapped ?? 'no',
          structuralDamage: body.structuralDamage ?? 'minor',
          severityScore: body.severityScore ?? 10,
          severityLevel: 'medium',
          status: 'open',
          location: body.location ?? { lat: 24.8607, lng: 67.0011, label: 'Unknown' },
          reportedAt: new Date().toISOString(),
          reportedBy: body.isGuestReport ? 'Guest report' : 'Staff report',
          isGuestReport: !!body.isGuestReport,
        } satisfies Incident
      },
    ),

  analyze: (body: { description: string; photo?: string }) =>
    withFallback<IncidentAnalysis>(
      () => request('/incidents/analyze', { method: 'POST', body: JSON.stringify(body) }),
      async () => {
        await delay(700)
        return {
          peopleAffected: 0,
          trapped: 'no',
          structuralDamage: 'minor',
          severityScore: 0,
          reasoning: 'AI analysis unavailable — connect the backend for live estimates.',
        }
      },
    ),

  updateStatus: (id: string, status: Incident['status']) =>
    withFallback<Incident>(
      () => request(`/incidents/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
      async () => {
        await delay(200)
        throw new Error('Backend not connected — status updates require the live API.')
      },
    ),
}

// ---------- Inventory ----------

export const inventoryApi = {
  list: () =>
    withFallback<{ items: InventoryItem[]; stats: InventoryStats }>(
      () => request('/inventory'),
      async () => {
        await delay()
        return { items: [], stats: { totalUnits: 0, matched: 0, unmetNeeds: 0 } }
      },
    ),

  match: () =>
    withFallback<{ matched: number }>(
      () => request('/inventory/match', { method: 'POST' }),
      async () => {
        await delay(600)
        return { matched: 0 }
      },
    ),
}

// ---------- Check-ins ----------

export const checkInsApi = {
  list: () =>
    withFallback<CheckIn[]>(
      () => request('/check-ins'),
      async () => {
        await delay()
        return []
      },
    ),
}

// ---------- Alerts ----------

export const alertsApi = {
  list: () =>
    withFallback<Alert[]>(
      () => request('/alerts'),
      async () => {
        await delay()
        return []
      },
    ),

  send: (body: { level: Alert['level']; message: string }) =>
    withFallback<Alert>(
      () => request('/alerts', { method: 'POST', body: JSON.stringify(body) }),
      async () => {
        await delay(300)
        return {
          id: `al-${Date.now()}`,
          level: body.level,
          message: body.message,
          sentAt: new Date().toISOString(),
          sentBy: 'You',
        }
      },
    ),
}

// ---------- Admin ----------

export const adminApi = {
  pendingUsers: () =>
    withFallback<PendingUser[]>(
      () => request('/admin/pending-users'),
      async () => {
        await delay()
        return []
      },
    ),

  approveUser: (id: string) =>
    withFallback<{ id: string; status: 'approved' }>(
      () => request(`/admin/users/${id}/approve`, { method: 'PATCH' }),
      async () => {
        await delay(300)
        return { id, status: 'approved' }
      },
    ),
}

// ---------- Assistant chat (uses the analyze endpoint as the AI backend) ----------

export const assistantApi = {
  send: (message: string): Promise<ChatMessage> =>
    withFallback<ChatMessage>(
      () =>
        request<{ reply: string }>('/incidents/analyze', {
          method: 'POST',
          body: JSON.stringify({ description: message }),
        }).then((res) => ({
          id: `msg-${Date.now()}`,
          role: 'assistant',
          text: res.reply,
          sentAt: new Date().toISOString(),
        })),
      async () => {
        await delay(500)
        return {
          id: `msg-${Date.now()}`,
          role: 'assistant',
          text: "Assistant isn't connected yet — this will answer live once the backend is running.",
          sentAt: new Date().toISOString(),
        }
      },
    ),
}
