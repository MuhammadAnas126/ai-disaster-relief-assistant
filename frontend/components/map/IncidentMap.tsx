'use client'

import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
import type { Incident } from '../../types'

const SEVERITY_COLOR: Record<Incident['severityLevel'], string> = {
  critical: '#E24C3F',
  high: '#E2A63F',
  medium: '#7BAE7F',
}

interface IncidentMapProps {
  incidents: Incident[]
  center?: [number, number]
  heightClassName?: string
}

export default function IncidentMap({
  incidents,
  center = [24.8607, 67.0011],
  heightClassName = 'h-[300px]',
}: IncidentMapProps) {
  return (
    <div className={`w-full ${heightClassName} overflow-hidden rounded-card`}>
      <MapContainer
        center={center}
        zoom={12}
        scrollWheelZoom={false}
        style={{ height: '100%', width: '100%', background: '#16100f' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {incidents.map((incident) => (
          <CircleMarker
            key={incident.id}
            center={[incident.location.lat, incident.location.lng]}
            radius={9}
            pathOptions={{
              color: SEVERITY_COLOR[incident.severityLevel],
              fillColor: SEVERITY_COLOR[incident.severityLevel],
              fillOpacity: 0.85,
              weight: 2,
            }}
          >
            <Popup>
              <div style={{ color: '#120D0D' }}>
                <strong>{incident.title}</strong>
                <div>{incident.location.label}</div>
                <div>Score: {incident.severityScore}</div>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  )
}
