 'use client'

import { useEffect } from 'react'
import { useMap } from 'react-leaflet'
import * as esriLeaflet from 'esri-leaflet'

export function EsriBasemap() {
  const map = useMap()

  useEffect(() => {
    const layer = esriLeaflet.basemapLayer('Streets', {
      token: process.env.NEXT_PUBLIC_ARCGIS_API_KEY,
      ignoreDeprecationWarning: true,
    })

    layer.addTo(map)

    return () => {
      map.removeLayer(layer)
    }
  }, [map])

  return null
}