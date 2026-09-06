'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { weatherApi } from '../lib/api'

export const pakistanWeatherKey = ['weather', 'pakistan'] as const

export function usePakistanWeather() {
  return useQuery({
    queryKey: pakistanWeatherKey,
    queryFn: weatherApi.pakistan,
    refetchInterval: 60_000,
  })
}

export function useRefreshPakistanWeather() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: weatherApi.refreshPakistan,
    onSuccess: (snapshot) => {
      queryClient.setQueryData(pakistanWeatherKey, snapshot)
    },
  })
}