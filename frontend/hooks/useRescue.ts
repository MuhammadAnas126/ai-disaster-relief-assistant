'use client'

import { useMutation, useQuery } from '@tanstack/react-query'
import { rescueApi } from '../lib/api'

export const rescueKey = ['rescue'] as const
export const rescueSessionsKey = ['rescue-sessions'] as const

export function useRescueGuidance() {
  return useMutation({
    mutationFn: rescueApi.getGuidance,
  })
}

export function useCallAuthority() {
  return useMutation({
    mutationFn: rescueApi.callAuthority,
  })
}

export function useRescueSession(sessionId: string | null) {
  return useQuery({
    queryKey: [...rescueKey, sessionId],
    queryFn: () => rescueApi.getSession(sessionId!),
    enabled: !!sessionId,
    staleTime: Infinity,
  })
}

export function useRescueSessions() {
  return useQuery({
    queryKey: rescueSessionsKey,
    queryFn: rescueApi.listSessions,
  })
}
