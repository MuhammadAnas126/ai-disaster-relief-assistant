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
  /** Evidence (photos/videos/live-share frames) attached to this case */
  evidenceIds?: string[]
}

export interface IncidentAnalysis {
  peopleAffected: number
  trapped: TrappedStatus
  structuralDamage: DamageLevel
  severityScore: number
  reasoning: string
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

/** AI-drafted broadcast returned by the Admin AI Assistant for review in the alert form */
export interface BroadcastDraft {
  level: AlertLevel
  message: string
}

export interface AdminAssistantReply {
  reply: string
  broadcast: BroadcastDraft | null
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  sentAt: string
}

export interface AssistantContext {
  /** Reported situation / disaster description from "Register Your Case" */
  situation?: string
  /** Reported location (coordinates or label) */
  location?: string
  /** Whether anyone is reported trapped */
  trapped?: TrappedStatus
  /** Number of people affected */
  peopleAffected?: number
  /** Whether the case has been submitted to responders */
  submitted?: boolean
  /** Preferred reply language for the chat */
  language?: 'en' | 'ur'
}

export interface LiveAnalysis {
  status: 'standing' | 'sitting' | 'collapsed'
  confidence: number
  hazards: string[]
  timestamp: string
  /** Disaster type classified by Qwen-VL (e.g. flood, earthquake) */
  disasterType?: string
  /** Evidence gallery id, present when the frame was archived server-side */
  evidenceId?: string
}

export interface EvidenceAnalysis {
  status: string
  disasterType: string
  confidence: number
  hazards: string[]
}

export interface EvidenceLocation {
  lat?: number
  lng?: number
  label?: string
}

/** One victim-submitted photo/video/live-stream frame, stored and analyzed by the backend */
export interface EvidenceRecord {
  id: string
  mediaType: 'image' | 'video'
  mediaUrl: string
  thumbnailUrl: string | null
  source: 'upload' | 'stream'
  caseId?: string | null
  location?: EvidenceLocation | null
  trapped?: string | null
  peopleAffected?: number | null
  analysis: EvidenceAnalysis | null
  receivedAt: string
}
