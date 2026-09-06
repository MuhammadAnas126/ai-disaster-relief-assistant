'use client'

import dynamic from 'next/dynamic'
import { Skeleton } from '../ui/States'

const SatelliteAnalysisMap = dynamic(() => import('./SatelliteAnalysisMap').then((module) => module.SatelliteAnalysisMap), {
  ssr: false,
  loading: () => <Skeleton className="h-[420px] w-full" />,
})

export function SatelliteAnalysisMapClient(props: {
  position: [number, number]
  label: string
  heightClassName?: string
}) {
  return <SatelliteAnalysisMap {...props} />
}
