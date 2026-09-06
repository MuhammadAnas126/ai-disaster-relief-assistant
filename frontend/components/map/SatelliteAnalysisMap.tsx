'use client'

import { useEffect } from 'react'
import { MapContainer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import { LocateFixed, MapPinned } from 'lucide-react'
import { EsriBasemap } from './EsriBasemap'

const locationIcon = new L.DivIcon({
  className: '',
  html: '<div style="width:18px;height:18px;border-radius:50%;background:#E24C3F;border:3px solid #F0E8E6;box-shadow:0 0 0 5px #E24C3F44;"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
})

function MapViewport({ position }: { position: [number, number] }) {
  const map = useMap()

  useEffect(() => {
    map.setView(position, Math.max(map.getZoom(), 13), { animate: true })
  }, [map, position])

  return (
    <button
      type="button"
      aria-label="Center map on selected place"
      title="Center map on selected place"
      onClick={() => map.setView(position, Math.max(map.getZoom(), 14), { animate: true })}
      className="absolute right-3 top-3 z-[1000] flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card/95 text-text shadow-lg transition-colors hover:bg-border"
    >
      <LocateFixed size={16} />
    </button>
  )
}

export function SatelliteAnalysisMap({
  position,
  label,
  heightClassName = 'h-[420px]',
}: {
  position: [number, number]
  label: string
  heightClassName?: string
}) {
  return (
    <div className={`relative z-0 w-full overflow-hidden rounded-card ${heightClassName}`}>
      <MapContainer
        center={position}
        zoom={13}
        scrollWheelZoom
        style={{ height: '100%', width: '100%', background: '#16100f' }}
      >
        <EsriBasemap type="Imagery" />
        <Marker position={position} icon={locationIcon}>
          <Popup>
            <strong>{label}</strong><br />
            {position[0].toFixed(5)}, {position[1].toFixed(5)}
          </Popup>
        </Marker>
        <MapViewport position={position} />
      </MapContainer>
      <div className="absolute left-3 top-3 z-[1000] rounded-lg border border-border bg-card/95 px-3 py-2 shadow-lg">
        <div className="flex items-center gap-2 text-xs font-semibold text-text">
          <MapPinned size={14} className="text-accent" /> Satellite imagery
        </div>
        <div className="mt-0.5 text-[11px] text-text-muted">Selected analysis area</div>
      </div>
    </div>
  )
}
