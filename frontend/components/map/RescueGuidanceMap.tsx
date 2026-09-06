'use client'

import { MapContainer, Marker, Polyline, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import { useEffect } from 'react'
import { LocateFixed, MapPinned, Navigation } from 'lucide-react'
import { useLanguage } from '../../lib/i18n'
import type { SafePoint } from '../../types'
import { EsriBasemap } from './EsriBasemap'

const victimIcon = new L.DivIcon({
  className: '',
  html: '<div style="width:18px;height:18px;border-radius:50%;background:#E24C3F;border:3px solid #F0E8E6;box-shadow:0 0 0 5px #E24C3F44;"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
})

const safePointIcon = new L.DivIcon({
  className: '',
  html: '<div style="width:18px;height:18px;border-radius:4px;background:#7BAE7F;border:3px solid #F0E8E6;box-shadow:0 0 0 5px #7BAE7F44;"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
})

function FitGuidance({ position, safePoint }: { position: [number, number]; safePoint: SafePoint | null }) {
  const map = useMap()

  useEffect(() => {
    if (!safePoint) {
      map.setView(position, Math.max(map.getZoom(), 13))
      return
    }
    map.fitBounds([position, [safePoint.lat, safePoint.lng]], { padding: [44, 44], maxZoom: 15 })
  }, [map, position, safePoint])

  return null
}

function RecenterControl({ position }: { position: [number, number] }) {
  const map = useMap()

  return (
    <button
      type="button"
      aria-label="Center map on my location"
      title="Center map on my location"
      onClick={() => map.setView(position, Math.max(map.getZoom(), 14), { animate: true })}
      className="absolute right-3 top-3 z-[1000] flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card/95 text-text shadow-lg transition-colors hover:bg-border"
    >
      <LocateFixed size={16} />
    </button>
  )
}

export function RescueGuidanceMap({ position, safePoint, heightClassName = 'h-[330px]' }: {
  position: [number, number]
  safePoint: SafePoint | null
  heightClassName?: string
}) {
  const { t } = useLanguage()
  const safePosition: [number, number] | null = safePoint ? [safePoint.lat, safePoint.lng] : null

  function openNavigation() {
    const mapsUrl = safePoint
      ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${safePoint.lat},${safePoint.lng}`)}&travelmode=walking`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${position[0]},${position[1]}`)}`
    window.location.assign(mapsUrl)
  }

  return (
    <div className={`relative z-0 w-full overflow-hidden rounded-card ${heightClassName}`}>
      <MapContainer center={position} zoom={13} scrollWheelZoom style={{ height: '100%', width: '100%', background: '#16100f' }}>
        <EsriBasemap />
        <Marker position={position} icon={victimIcon}>
          <Popup>
            <strong>Your location</strong><br />
            {position[0].toFixed(4)}, {position[1].toFixed(4)}
          </Popup>
        </Marker>
        {safePosition && <>
          <Marker position={safePosition} icon={safePointIcon}>
            <Popup>
              <strong>{safePoint?.label}</strong><br />
              Safe destination
            </Popup>
          </Marker>
          <Polyline positions={[position, safePosition]} pathOptions={{ color: '#E2A63F', dashArray: '8 10', weight: 4 }} />
        </>}
        <FitGuidance position={position} safePoint={safePoint} />
        <RecenterControl position={position} />
      </MapContainer>
      <div className="absolute left-3 top-3 z-[1000] rounded-lg border border-border bg-card/95 px-3 py-2 shadow-lg">
        <div className="flex items-center gap-2 text-xs font-semibold text-text"><MapPinned size={14} className="text-accent" /> Rescue map</div>
        <div className="mt-0.5 text-[11px] text-text-muted">{safePoint ? 'Route to safe destination' : 'Location ready for guidance'}</div>
      </div>
      <button
        type="button"
        onClick={openNavigation}
        title={safePoint ? t('rescue.openNavigation') : t('rescue.openMap')}
        aria-label={safePoint ? t('rescue.openNavigation') : t('rescue.openMap')}
        className="absolute right-3 top-14 z-[1000] flex items-center gap-2 rounded-lg border border-border bg-card/95 px-3 py-2 text-xs font-semibold text-text shadow-lg transition-colors hover:bg-border"
      >
        <Navigation size={14} />
        {safePoint ? t('rescue.openNavigation') : t('rescue.openMap')}
      </button>
      <div className="absolute bottom-3 left-3 z-[1000] flex flex-wrap gap-2 rounded-xl border border-border bg-card/95 px-3 py-2 text-[11px] text-text shadow-lg">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-accent" /> You are here</span>
        {safePoint && <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-success" /> Safe point</span>}
      </div>
    </div>
  )
}