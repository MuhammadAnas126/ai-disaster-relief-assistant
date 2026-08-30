'use client'

import dynamic from 'next/dynamic'

const PinDropMap = dynamic(() => import('./PinDropMap'), {
  ssr: false,
  loading: () => <div className="h-[220px] w-full animate-pulse rounded-xl border border-border bg-border/30" />,
})

export function PinDropMapClient(props: {
  lat: number
  lng: number
  onChange: (lat: number, lng: number) => void
  heightClassName?: string
}) {
  return <PinDropMap {...props} />
}
