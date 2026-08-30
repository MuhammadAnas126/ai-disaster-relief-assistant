'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { inventoryApi } from '../lib/api'

export const inventoryKey = ['inventory'] as const

export function useInventory() {
  return useQuery({ queryKey: inventoryKey, queryFn: inventoryApi.list })
}

export function useMatchInventory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: inventoryApi.match,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: inventoryKey }),
  })
}
