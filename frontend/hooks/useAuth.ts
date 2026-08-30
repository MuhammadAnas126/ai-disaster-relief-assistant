'use client'

import { useMutation } from '@tanstack/react-query'
import { authApi, setToken } from '../lib/api'

export function useLogin() {
  return useMutation({
    mutationFn: authApi.login,
    onSuccess: (data) => setToken(data.token),
  })
}

export function useRegisterOrganization() {
  return useMutation({ mutationFn: authApi.registerOrganization })
}
