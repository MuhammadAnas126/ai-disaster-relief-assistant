'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { incidentsApi } from '../lib/api'
import type { Incident } from '../types'

export const incidentsKey = ['incidents'] as const

export function useIncidents() {
  return useQuery({ queryKey: incidentsKey, queryFn: incidentsApi.list })
}

export function useCreateIncident() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: incidentsApi.create,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: incidentsKey }),
  })
}

export function useAnalyzeIncident() {
  return useMutation({ mutationFn: incidentsApi.analyze })
}

export function useUpdateIncidentStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: Incident['status'] }) =>
      incidentsApi.updateStatus(id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: incidentsKey }),
  })
}
