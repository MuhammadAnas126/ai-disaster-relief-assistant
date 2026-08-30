'use client'

import dynamic from 'next/dynamic'
import type { Incident } from '../../types'
import { Skeleton } from '../ui/States'

const IncidentMap = dynamic(() => import('./IncidentMap'), {
  ssr: false,
  loading: () => <Skeleton className="h-[300px] w-full" />,
})

export function IncidentMapClient(props: { incidents: Incident[]; center?: [number, number]; heightClassName?: string }) {
  return <IncidentMap {...props} />
}
