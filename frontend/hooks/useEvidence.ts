'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { evidenceApi, type EvidenceUploadInput } from '../lib/api'
import type { EvidenceRecord } from '../types'

export const evidenceKey = ['evidence'] as const

/** Live gallery of victim evidence submissions (admin Live Share section). */
export function useEvidenceGallery() {
  return useQuery({
    queryKey: evidenceKey,
    queryFn: evidenceApi.list,
    // Real-time updates arrive over the evidence:new socket event; this slow
    // refetch is just a safety net if the socket drops.
    refetchInterval: 60_000,
  })
}

/** Upload one victim submission (photo/video) for AI analysis. */
export function useUploadEvidence() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: EvidenceUploadInput) => evidenceApi.upload(input),
    onSuccess: (record) => {
      // Seed the admin gallery cache so the submission is visible even
      // before the socket event arrives.
      queryClient.setQueryData<EvidenceRecord[]>(evidenceKey, (existing) =>
        existing ? [record, ...existing.filter((e) => e.id !== record.id)] : [record],
      )
    },
  })
}
