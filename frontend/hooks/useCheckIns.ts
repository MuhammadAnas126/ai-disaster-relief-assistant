'use client'

import { useQuery } from '@tanstack/react-query'
import { checkInsApi } from '../lib/api'

export const checkInsKey = ['check-ins'] as const

export function useCheckIns() {
  return useQuery({ queryKey: checkInsKey, queryFn: checkInsApi.list })
}
