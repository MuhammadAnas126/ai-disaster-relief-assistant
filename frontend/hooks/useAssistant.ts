'use client'

import { useMutation } from '@tanstack/react-query'
import { assistantApi } from '../lib/api'

export function useSendChatMessage() {
  return useMutation({ mutationFn: assistantApi.send })
}
