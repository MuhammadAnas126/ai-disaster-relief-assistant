'use client'

import { useEffect, useState } from 'react'

/** Battery Status API (absent from TypeScript's DOM lib; Chromium only). */
interface BatteryManagerLike extends EventTarget {
  level: number
  charging: boolean
}

/** Network Information API (also absent from TypeScript's DOM lib). */
interface NetworkInformationLike extends EventTarget {
  effectiveType?: string
}

type NavigatorWithSensors = Navigator & {
  getBattery?: () => Promise<BatteryManagerLike>
  connection?: NetworkInformationLike
}

export type MotionStatus = 'active' | 'stationary'

export interface DeviceTelemetry {
  batteryPercent: number
  charging: boolean
  motion: MotionStatus
  online: boolean
  effectiveType: string | null
  /** ISO timestamp of the most recent telemetry ping; null before mount. */
  lastPingAt: string | null
  /** True while live sensors are unavailable and mock values are shown. */
  isMock: boolean
}

interface TelemetryState extends Omit<DeviceTelemetry, 'isMock'> {
  batteryMock: boolean
  motionMock: boolean
}

/** Mock battery level shown when the Battery Status API is missing. */
const MOCK_BATTERY_PERCENT = 78

/** |x| + |y| + |z| acceleration above which the device counts as moving. */
const MOTION_THRESHOLD = 1.5

/** Heartbeat that keeps the last-ping column fresh between sensor events. */
const PING_INTERVAL_MS = 30000

/** Standard gravity, stripped from combined readings so the threshold holds. */
const GRAVITY = 9.81

/**
 * |x| + |y| + |z| for a motion event. Prefers the gravity-free `acceleration`
 * reading; when a browser only fills `accelerationIncludingGravity`, gravity is
 * removed from the dominant axis so a resting device still reads ~0.
 */
function motionMagnitude(event: DeviceMotionEvent): number | null {
  const { acceleration } = event
  if (acceleration && (acceleration.x !== null || acceleration.y !== null || acceleration.z !== null)) {
    return Math.abs(acceleration.x ?? 0) + Math.abs(acceleration.y ?? 0) + Math.abs(acceleration.z ?? 0)
  }

  const combined = event.accelerationIncludingGravity
  if (!combined) return null

  const axes = [combined.x ?? 0, combined.y ?? 0, combined.z ?? 0]
  const dominant = axes.indexOf(
    axes.reduce((max, value) => (Math.abs(value) > Math.abs(max) ? value : max), 0),
  )
  axes[dominant] -= Math.sign(axes[dominant]) * GRAVITY
  return axes.reduce((sum, value) => sum + Math.abs(value), 0)
}

/**
 * Reads this device's live sensors — battery, motion, and network — and falls
 * back to mock values (battery 78%, "Stationary") wherever the browser doesn't
 * expose the API (Safari, Firefox, insecure contexts). The initial state is
 * the mock fallback so the server render and the first client render always
 * match; live readings then stream in from the mount effect.
 */
export function useDeviceTelemetry(): DeviceTelemetry {
  const [state, setState] = useState<TelemetryState>({
    batteryPercent: MOCK_BATTERY_PERCENT,
    charging: false,
    batteryMock: true,
    motion: 'stationary',
    motionMock: true,
    online: true,
    effectiveType: null,
    lastPingAt: null,
  })

  useEffect(() => {
    const nav = navigator as NavigatorWithSensors
    let cancelled = false
    let detachBattery: (() => void) | null = null

    /** Apply a telemetry patch and stamp it as the latest ping. */
    const ping = (patch: Partial<TelemetryState>) => {
      if (cancelled) return
      setState((prev) => ({ ...prev, ...patch, lastPingAt: new Date().toISOString() }))
    }

    // --- Battery: navigator.getBattery(), when it exists ---
    if (typeof nav.getBattery === 'function') {
      nav
        .getBattery()
        .then((manager) => {
          if (cancelled) return
          const syncBattery = () =>
            ping({
              batteryPercent: Math.round(manager.level * 100),
              charging: manager.charging,
              batteryMock: false,
            })
          syncBattery()
          manager.addEventListener('levelchange', syncBattery)
          manager.addEventListener('chargingchange', syncBattery)
          detachBattery = () => {
            manager.removeEventListener('levelchange', syncBattery)
            manager.removeEventListener('chargingchange', syncBattery)
          }
        })
        .catch(() => {
          // API exists but refused (e.g. insecure context) — keep mock values.
        })
    }

    // --- Motion: devicemotion events ---
    const onDeviceMotion = (event: DeviceMotionEvent) => {
      const magnitude = motionMagnitude(event)
      if (magnitude === null) return // event carried no usable readings
      const next: MotionStatus = magnitude > MOTION_THRESHOLD ? 'active' : 'stationary'
      // devicemotion fires at ~60 Hz — only surface actual status changes.
      setState((prev) =>
        prev.motion === next && !prev.motionMock
          ? prev
          : { ...prev, motion: next, motionMock: false, lastPingAt: new Date().toISOString() },
      )
    }
    window.addEventListener('devicemotion', onDeviceMotion)

    // --- Signal: navigator.onLine + connection.effectiveType ---
    const syncNetwork = () =>
      ping({
        online: nav.onLine,
        effectiveType: nav.connection?.effectiveType ?? null,
      })
    window.addEventListener('online', syncNetwork)
    window.addEventListener('offline', syncNetwork)
    nav.connection?.addEventListener('change', syncNetwork)

    // Initial ping picks up the real network state and stamps lastPingAt; the
    // heartbeat afterwards keeps this device's row visibly alive.
    syncNetwork()
    const heartbeat = setInterval(syncNetwork, PING_INTERVAL_MS)

    return () => {
      cancelled = true
      clearInterval(heartbeat)
      window.removeEventListener('devicemotion', onDeviceMotion)
      window.removeEventListener('online', syncNetwork)
      window.removeEventListener('offline', syncNetwork)
      nav.connection?.removeEventListener('change', syncNetwork)
      detachBattery?.()
    }
  }, [])

  return {
    batteryPercent: state.batteryPercent,
    charging: state.charging,
    motion: state.motion,
    online: state.online,
    effectiveType: state.effectiveType,
    lastPingAt: state.lastPingAt,
    isMock: state.batteryMock || state.motionMock,
  }
}
