'use client'

import { useMutation } from '@tanstack/react-query'
import { adminAssistantApi, assistantApi } from '../lib/api'
import type { AssistantContext, ChatMessage } from '../types'

interface SendChatParams {
  message: string
  history: ChatMessage[]
  context?: AssistantContext
}

export function useSendChatMessage() {
  return useMutation({
    mutationFn: (params: SendChatParams) =>
      assistantApi.send(params.message, params.history, params.context),
  })
}

/**
 * Admin AI Assistant — answers are grounded in live incidents, alert history,
 * and visual triage findings, and may carry a broadcast draft for the alert form.
 */
export function useSendAdminChatMessage() {
  return useMutation({
    mutationFn: (params: SendChatParams) =>
      adminAssistantApi.send(params.message, params.history, params.context),
  })
}
