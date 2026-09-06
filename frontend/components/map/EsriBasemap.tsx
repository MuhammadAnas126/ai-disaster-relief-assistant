 'use client'

import { useEffect } from 'react'
import { useMap } from 'react-leaflet'
import * as esriLeaflet from 'esri-leaflet'

export function EsriBasemap({ type = 'Imagery' }: { type?: 'Streets' | 'Imagery' }) {
  const map = useMap()

  useEffect(() => {
    const layer = esriLeaflet.basemapLayer(type, {
      token: process.env.NEXT_PUBLIC_ARCGIS_API_KEY,
      ignoreDeprecationWarning: true,
    })

    layer.addTo(map)

    return () => {
      map.removeLayer(layer)
    }
  }, [map, type])

  return null
}