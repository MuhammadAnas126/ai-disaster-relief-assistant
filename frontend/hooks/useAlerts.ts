'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { alertsApi } from '../lib/api'

export const alertsKey = ['alerts'] as const

export function useAlerts() {
  return useQuery({ queryKey: alertsKey, queryFn: alertsApi.list })
}

export function useSendAlert() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: alertsApi.send,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: alertsKey }),
  })
}
