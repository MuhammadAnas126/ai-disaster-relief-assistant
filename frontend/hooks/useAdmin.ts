'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '../lib/api'

export const pendingUsersKey = ['admin', 'pending-users'] as const

export function usePendingUsers() {
  return useQuery({ queryKey: pendingUsersKey, queryFn: adminApi.pendingUsers })
}

export function useApproveUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: adminApi.approveUser,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: pendingUsersKey }),
  })
}
