'use client'

import { Activity, Info, Pause, ShieldCheck, Smartphone, Wifi, WifiOff, Zap } from 'lucide-react'
import { Card } from '../../../components/ui/Card'
import { Badge } from '../../../components/ui/Badge'
import { Table, Thead, Th, Tr, Td } from '../../../components/ui/Table'
import { useDeviceTelemetry, type MotionStatus } from '../../../hooks/useDeviceTelemetry'
import { useLanguage } from '../../../lib/i18n'
import { cn, timeAgo } from '../../../lib/utils'
import type { TranslationKey } from '../../../lib/dictionaries'

/** One row of the telemetry monitoring table — this device or a field case. */
interface TelemetryRow {
  id: string
  /** Marks the live "THIS DEVICE (YOU)" row rendered with the pulse badge. */
  self?: boolean
  batteryPercent: number
  charging: boolean
  motion: MotionStatus
  online: boolean
  effectiveType: string | null
  lastPingAt: string | null
}

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60000).toISOString()

/** Mock field cases that keep the table populated with emergency data. */
const MOCK_CASES: TelemetryRow[] = [
  {
    id: 'SOS-104',
    batteryPercent: 64,
    charging: false,
    motion: 'active',
    online: true,
    effectiveType: '3g',
    lastPingAt: minutesAgo(2),
  },
  {
    id: 'SOS-108',
    batteryPercent: 9,
    charging: false,
    motion: 'active',
    online: true,
    effectiveType: '4g',
    lastPingAt: minutesAgo(6),
  },
  {
    id: 'SOS-112',
    batteryPercent: 37,
    charging: false,
    motion: 'stationary',
    online: false,
    effectiveType: null,
    lastPingAt: minutesAgo(24),
  },
  {
    id: 'SOS-117',
    batteryPercent: 81,
    charging: true,
    motion: 'active',
    online: true,
    effectiveType: '4g',
    lastPingAt: minutesAgo(1),
  },
]

const MOTION_LABEL: Record<MotionStatus, TranslationKey> = {
  active: 'checkIn.activeMoving',
  stationary: 'checkIn.stationary',
}

/** Escalation rule: critical when the battery is nearly drained or the case is stationary. */
function isCritical(row: TelemetryRow): boolean {
  return row.batteryPercent < 15 || row.motion === 'stationary'
}

function batteryTone(percent: number): string {
  if (percent < 15) return 'bg-accent'
  if (percent < 30) return 'bg-secondary'
  return 'bg-success'
}

/** Battery level bar with its percentage and a charging bolt. */
function BatteryBar({ row }: { row: TelemetryRow }) {
  const percent = Math.min(100, Math.max(0, Math.round(row.batteryPercent)))
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-16 shrink-0 overflow-hidden rounded-full bg-border">
        <div className={cn('h-full rounded-full', batteryTone(percent))} style={{ width: `${percent}%` }} />
      </div>
      <span className={cn('text-xs font-medium', percent < 15 ? 'text-accent' : 'text-text-muted')}>
        {percent}%
      </span>
      {row.charging && <Zap size={13} className="shrink-0 text-secondary" />}
    </div>
  )
}

export default function CheckInPage() {
  const { t, language } = useLanguage()
  const device = useDeviceTelemetry()
  // Relative times render only after the first telemetry ping lands (always
  // post-mount) so server-rendered markup and hydration always match.
  const timesReady = device.lastPingAt !== null

  const rows: TelemetryRow[] = [
    {
      id: 'this-device',
      self: true,
      batteryPercent: device.batteryPercent,
      charging: device.charging,
      motion: device.motion,
      online: device.online,
      effectiveType: device.effectiveType,
      lastPingAt: device.lastPingAt,
    },
    ...MOCK_CASES,
  ]

  const networkLabel = (row: TelemetryRow) =>
    row.online
      ? row.effectiveType
        ? t('checkIn.onlineWithType').replace('{type}', row.effectiveType.toUpperCase())
        : t('checkIn.onlineDefault')
      : t('checkIn.offline')

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 rounded-card border border-border bg-card p-4 text-sm text-text-muted">
        <ShieldCheck size={18} className="mt-0.5 shrink-0 text-success" />
        <p>{t('checkIn.privacyNote')}</p>
      </div>

      <Card>
        <h2 className="mb-4 text-base font-semibold text-text">{t('checkIn.wellness')}</h2>

        {device.isMock && (
          <p className="mb-4 flex items-center gap-1.5 text-xs text-text-faint">
            <Info size={13} className="shrink-0" />
            {t('checkIn.telemetryHint')}
          </p>
        )}

        <Table>
          <Thead>
            <Tr>
              <Th>{t('checkIn.deviceCase')}</Th>
              <Th>{t('checkIn.battery')}</Th>
              <Th>{t('checkIn.motionStatus')}</Th>
              <Th>{t('checkIn.network')}</Th>
              <Th>{t('checkIn.lastPing')}</Th>
              <Th>{t('checkIn.escalation')}</Th>
            </Tr>
          </Thead>
          <tbody>
            {rows.map((row) => {
              const critical = isCritical(row)
              return (
                <Tr key={row.id} className={critical ? 'bg-accent/10' : undefined}>
                  <Td>
                    {row.self ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <Smartphone size={15} className="shrink-0 text-text-muted" />
                        <span className="font-medium">{t('checkIn.thisDevice')}</span>
                        <Badge tone="success" className="gap-1.5">
                          <span className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
                          </span>
                          {t('checkIn.live')}
                        </Badge>
                      </div>
                    ) : (
                      <span className="font-medium">{row.id}</span>
                    )}
                  </Td>
                  <Td>
                    <BatteryBar row={row} />
                  </Td>
                  <Td>
                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5 text-xs font-medium',
                        row.motion === 'active' ? 'text-success' : 'text-text-muted',
                      )}
                    >
                      {row.motion === 'active' ? (
                        <Activity size={14} className="shrink-0" />
                      ) : (
                        <Pause size={14} className="shrink-0" />
                      )}
                      {t(MOTION_LABEL[row.motion])}
                    </span>
                  </Td>
                  <Td>
                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5 text-xs font-medium',
                        row.online ? 'text-text-muted' : 'text-accent',
                      )}
                    >
                      {row.online ? (
                        <Wifi size={14} className="shrink-0" />
                      ) : (
                        <WifiOff size={14} className="shrink-0" />
                      )}
                      {networkLabel(row)}
                    </span>
                  </Td>
                  <Td className="text-text-muted">
                    {timesReady && row.lastPingAt ? timeAgo(row.lastPingAt, language) : '—'}
                  </Td>
                  <Td>
                    <Badge tone={critical ? 'critical' : 'success'}>
                      {critical ? t('checkIn.critical') : t('checkIn.ok')}
                    </Badge>
                  </Td>
                </Tr>
              )
            })}
          </tbody>
        </Table>
      </Card>
    </div>
  )
}
