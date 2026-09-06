'use client'

import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getSocket } from '../lib/socket'
import { incidentsKey } from './useIncidents'
import { alertsKey } from './useAlerts'
import { checkInsKey } from './useCheckIns'
import { evidenceKey } from './useEvidence'
import { rescueSessionsKey } from './useRescue'
import { pakistanWeatherKey } from './useWeather'

/**
 * Connects to the backend's Socket.io server once per dashboard mount and
 * keeps Overview stats, the Priority Queue, the Response List, and the Live
 * Share evidence gallery fresh by invalidating the relevant query caches as
 * events arrive. If the backend isn't reachable, the socket simply never
 * connects — no crash, no retries that block the UI.
 */
export function useLiveUpdates() {
  const queryClient = useQueryClient()

  useEffect(() => {
    const socket = getSocket()

    const onIncidentNew = () => queryClient.invalidateQueries({ queryKey: incidentsKey })
    const onIncidentUpdated = () => queryClient.invalidateQueries({ queryKey: incidentsKey })
    const onIncidentDeleted = () => queryClient.invalidateQueries({ queryKey: incidentsKey })
    const onAlertNew = () => queryClient.invalidateQueries({ queryKey: alertsKey })
    const onWeatherUpdated = () => queryClient.invalidateQueries({ queryKey: pakistanWeatherKey })
    const onCheckinUpdated = () => queryClient.invalidateQueries({ queryKey: checkInsKey })
    const onEvidenceNew = () => queryClient.invalidateQueries({ queryKey: evidenceKey })
    const onEvidenceUpdated = () => queryClient.invalidateQueries({ queryKey: evidenceKey })
    const onEvidenceDeleted = () => queryClient.invalidateQueries({ queryKey: evidenceKey })
    const onRescueGuidanceReady = () => queryClient.invalidateQueries({ queryKey: rescueSessionsKey })
    const onRescueAuthorityCalled = () => queryClient.invalidateQueries({ queryKey: rescueSessionsKey })

    socket.on('incident:new', onIncidentNew)
    socket.on('incident:updated', onIncidentUpdated)
    socket.on('incident:deleted', onIncidentDeleted)
    socket.on('alert:new', onAlertNew)
    socket.on('weather:updated', onWeatherUpdated)
    socket.on('checkin:updated', onCheckinUpdated)
    socket.on('evidence:new', onEvidenceNew)
    socket.on('evidence:updated', onEvidenceUpdated)
    socket.on('evidence:deleted', onEvidenceDeleted)
    socket.on('rescue:guidance_ready', onRescueGuidanceReady)
    socket.on('rescue:authority_called', onRescueAuthorityCalled)

    return () => {
      socket.off('incident:new', onIncidentNew)
      socket.off('incident:updated', onIncidentUpdated)
      socket.off('incident:deleted', onIncidentDeleted)
      socket.off('alert:new', onAlertNew)
      socket.off('weather:updated', onWeatherUpdated)
      socket.off('checkin:updated', onCheckinUpdated)
      socket.off('evidence:new', onEvidenceNew)
      socket.off('evidence:updated', onEvidenceUpdated)
      socket.off('evidence:deleted', onEvidenceDeleted)
      socket.off('rescue:guidance_ready', onRescueGuidanceReady)
      socket.off('rescue:authority_called', onRescueAuthorityCalled)
    }
  }, [queryClient])
}
