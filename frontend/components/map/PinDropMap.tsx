'use client'

import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet'
import { useEffect } from 'react'
import L from 'leaflet'

const pinIcon = new L.DivIcon({
  className: '',
  html: `<div style="width:16px;height:16px;border-radius:50%;background:#E24C3F;border:3px solid #F0E8E6;box-shadow:0 0 0 2px #E24C3F55;"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
})

function ClickCatcher({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

function Recenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMapEvents({})
  useEffect(() => {
    map.setView([lat, lng], map.getZoom())
  }, [lat, lng, map])
  return null
}

interface PinDropMapProps {
  lat: number
  lng: number
  onChange: (lat: number, lng: number) => void
  heightClassName?: string
}

export default function PinDropMap({ lat, lng, onChange, heightClassName = 'h-[220px]' }: PinDropMapProps) {
  return (
    <div className={`w-full ${heightClassName} overflow-hidden rounded-xl border border-border`}>
      <MapContainer center={[lat, lng]} zoom={13} style={{ height: '100%', width: '100%', background: '#16100f' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={[lat, lng]} icon={pinIcon} />
        <ClickCatcher onPick={onChange} />
        <Recenter lat={lat} lng={lng} />
      </MapContainer>
    </div>
  )
}
