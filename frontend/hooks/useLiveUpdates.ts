'use client'

import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getSocket } from '../lib/socket'
import { incidentsKey } from './useIncidents'
import { alertsKey } from './useAlerts'
import { checkInsKey } from './useCheckIns'

/**
 * Connects to the backend's Socket.io server once per dashboard mount and
 * keeps Overview stats, the Priority Queue, and the Response List fresh by
 * invalidating the relevant query caches as events arrive. If the backend
 * isn't reachable, the socket simply never connects — no crash, no retries
 * that block the UI.
 */
export function useLiveUpdates() {
  const queryClient = useQueryClient()

  useEffect(() => {
    const socket = getSocket()

    const onIncidentNew = () => queryClient.invalidateQueries({ queryKey: incidentsKey })
    const onIncidentUpdated = () => queryClient.invalidateQueries({ queryKey: incidentsKey })
    const onAlertNew = () => queryClient.invalidateQueries({ queryKey: alertsKey })
    const onCheckinUpdated = () => queryClient.invalidateQueries({ queryKey: checkInsKey })

    socket.on('incident:new', onIncidentNew)
    socket.on('incident:updated', onIncidentUpdated)
    socket.on('alert:new', onAlertNew)
    socket.on('checkin:updated', onCheckinUpdated)

    return () => {
      socket.off('incident:new', onIncidentNew)
      socket.off('incident:updated', onIncidentUpdated)
      socket.off('alert:new', onAlertNew)
      socket.off('checkin:updated', onCheckinUpdated)
    }
  }, [queryClient])
}
