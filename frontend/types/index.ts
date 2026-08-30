export type UserRole = 'admin' | 'dispatcher' | 'field_staff' | 'org_member'
export type AccountStatus = 'approved' | 'pending' | 'rejected'

export interface User {
  id: string
  fullName: string
  email: string
  role: UserRole
  organizationName?: string
  status: AccountStatus
  initials: string
}

export interface AuthResponse {
  token: string
  user: User
}

export type SeverityLevel = 'critical' | 'high' | 'medium'
export type IncidentStatus = 'open' | 'in_progress' | 'resolved'
export type TrappedStatus = 'yes' | 'no' | 'partial'
export type DamageLevel = 'severe' | 'moderate' | 'minor'

export interface Incident {
  id: string
  title: string
  description: string
  peopleAffected: number
  trapped: TrappedStatus
  structuralDamage: DamageLevel
  severityScore: number
  severityLevel: SeverityLevel
  status: IncidentStatus
  location: {
    lat: number
    lng: number
    label: string
  }
  reportedAt: string
  reportedBy?: string
  isGuestReport: boolean
}

export interface IncidentAnalysis {
  peopleAffected: number
  trapped: TrappedStatus
  structuralDamage: DamageLevel
  severityScore: number
  reasoning: string
}

export type SupplyStatus = 'available' | 'low_stock' | 'out_of_stock'

export interface InventoryItem {
  id: string
  item: string
  quantity: number
  location: string
  status: SupplyStatus
}

export interface InventoryStats {
  totalUnits: number
  matched: number
  unmetNeeds: number
}

export type CheckInStatus = 'normal' | 'flagged'

export interface CheckIn {
  id: string
  name: string
  lastMotion: string
  lastCheckIn: string
  batteryPercent: number
  status: CheckInStatus
}

export type AlertLevel = 'info' | 'warning' | 'critical'

export interface Alert {
  id: string
  level: AlertLevel
  message: string
  sentAt: string
  sentBy?: string
}

export interface PendingUser {
  id: string
  fullName: string
  email: string
  organizationName?: string
  role: UserRole
  requestedAt: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  sentAt: string
}
