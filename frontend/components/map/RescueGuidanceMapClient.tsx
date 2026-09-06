'use client'

import dynamic from 'next/dynamic'
import type { SafePoint } from '../../types'

const RescueGuidanceMap = dynamic(() => import('./RescueGuidanceMap').then((module) => ({ default: module.RescueGuidanceMap })), {
  ssr: false,
  loading: () => <div className="h-[330px] w-full animate-pulse rounded-card bg-border/30" />,
})

export function RescueGuidanceMapClient(props: { position: [number, number]; safePoint: SafePoint | null }) {
  return <RescueGuidanceMap {...props} />
}