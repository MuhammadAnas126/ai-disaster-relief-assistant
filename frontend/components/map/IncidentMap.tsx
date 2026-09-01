'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet'
import type { CircleMarker as CircleMarkerInstance } from 'leaflet'
import { useLanguage } from '../../lib/i18n'
import type { TranslationKey } from '../../lib/dictionaries'
import type { Incident } from '../../types'

const SEVERITY_COLOR: Record<Incident['severityLevel'], string> = {
  critical: '#E24C3F',
  high: '#E2A63F',
  medium: '#7BAE7F',
}

const SEVERITY_LABEL_KEY: Record<Incident['severityLevel'], TranslationKey> = {
  critical: 'common.severityCritical',
  high: 'common.severityHigh',
  medium: 'common.severityMedium',
}

const TRAPPED_LABEL_KEY: Record<Incident['trapped'], TranslationKey> = {
  yes: 'map.trappedYes',
  partial: 'map.trappedPartial',
  no: 'map.trappedNo',
}

interface IncidentMapProps {
  incidents: Incident[]
  center?: [number, number]
  heightClassName?: string
  /** Incident id to auto-center on and open its popup (from ?focus=<id>). */
  focusIncidentId?: string | null
}

/**
 * Centers the map on the focused incident (e.g. a trapped person from the
 * response list's "Get location" button) and opens its popup once markers
 * have rendered.
 */
function FocusController({
  incidents,
  focusIncidentId,
  markerRefs,
}: {
  incidents: Incident[]
  focusIncidentId?: string | null
  markerRefs: React.RefObject<Record<string, CircleMarkerInstance>>
}) {
  const map = useMap()

  useEffect(() => {
    if (!focusIncidentId) return
    const incident = incidents.find((i) => i.id === focusIncidentId)
    if (!incident) return

    map.setView([incident.location.lat, incident.location.lng], 15)
    const marker = markerRefs.current[focusIncidentId]
    if (!marker) return
    const timer = setTimeout(() => marker.openPopup(), 200)
    return () => clearTimeout(timer)
  }, [focusIncidentId, incidents, map, markerRefs])

  return null
}

export default function IncidentMap({
  incidents,
  center = [24.8607, 67.0011],
  heightClassName = 'h-[300px]',
  focusIncidentId,
}: IncidentMapProps) {
  const markerRefs = useRef<Record<string, CircleMarkerInstance>>({})
  const { t } = useLanguage()

  return (
    // `relative z-0` creates a stacking context so Leaflet's internal panes
    // (z-index 200-1000) can't paint over floating UI (chat widget, dropdowns).
    <div className={`relative z-0 w-full ${heightClassName} overflow-hidden rounded-card`}>
      <MapContainer center={center} zoom={12} scrollWheelZoom={false} style={{ height: '100%', width: '100%', background: '#16100f' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {incidents.map((incident) => (
          <CircleMarker
            key={incident.id}
            ref={(marker) => {
              if (marker) markerRefs.current[incident.id] = marker
            }}
            center={[incident.location.lat, incident.location.lng]}
            radius={incident.trapped !== 'no' ? 11 : 9}
            pathOptions={{
              color: SEVERITY_COLOR[incident.severityLevel],
              fillColor: SEVERITY_COLOR[incident.severityLevel],
              fillOpacity: 0.85,
              weight: 2,
            }}
          >
            <Popup>
              <div className="min-w-[190px] space-y-1.5">
                <div className="text-sm font-semibold">{incident.title}</div>
                <div className="flex items-center gap-1.5 text-xs">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ background: SEVERITY_COLOR[incident.severityLevel] }}
                  />
                  {t(SEVERITY_LABEL_KEY[incident.severityLevel])} · {t('map.score')} {incident.severityScore}
                </div>
                <div className="text-xs opacity-80">
                  {t('map.trappedLabel')}: {t(TRAPPED_LABEL_KEY[incident.trapped])} · {incident.peopleAffected} {t('map.affected')}
                </div>
                <div className="text-xs opacity-70">
                  {incident.location.lat.toFixed(4)}, {incident.location.lng.toFixed(4)}
                </div>
                <Link
                  href={`/dashboard/response-list?incident=${incident.id}`}
                  className="text-xs font-semibold text-secondary hover:underline"
                >
                  {t('map.viewDetails')}
                </Link>
              </div>
            </Popup>
          </CircleMarker>
        ))}
        <FocusController incidents={incidents} focusIncidentId={focusIncidentId} markerRefs={markerRefs} />
      </MapContainer>
    </div>
  )
}
