'use client'

import { Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Crosshair, X } from 'lucide-react'
import { Card, CardHeader, CardTitle } from '../../../components/ui/Card'
import { Badge } from '../../../components/ui/Badge'
import { EmptyState, ErrorState, StatSkeleton, Skeleton } from '../../../components/ui/States'
import { IncidentMapClient } from '../../../components/map/IncidentMapClient'
import { useIncidents } from '../../../hooks/useIncidents'
import { useLanguage } from '../../../lib/i18n'
import type { Incident } from '../../../types'

const SEVERITY_TONE: Record<Incident['severityLevel'], 'critical' | 'high' | 'medium'> = {
  critical: 'critical',
  high: 'high',
  medium: 'medium',
}

const SEVERITY_TEXT_COLOR: Record<Incident['severityLevel'], string> = {
  critical: 'text-accent',
  high: 'text-secondary',
  medium: 'text-success',
}

export default function OverviewPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[400px] w-full" />}>
      <OverviewContent />
    </Suspense>
  )
}

function OverviewContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const focusIncidentId = searchParams.get('focus')
  const { data: incidents, isLoading, isError } = useIncidents()
  const { t } = useLanguage()

  const focusedIncident = incidents?.find((i) => i.id === focusIncidentId) ?? null

  const peopleReached = incidents?.reduce((sum, i) => sum + i.peopleAffected, 0) ?? 0
  const openIncidents = incidents?.filter((i) => i.status !== 'resolved').length ?? 0
  const topIncidents = [...(incidents ?? [])].sort((a, b) => b.severityScore - a.severityScore).slice(0, 3)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          {isLoading ? (
            <StatSkeleton />
          ) : (
            <>
              <div className="text-xs font-medium text-text-muted">{t('overview.peopleReached')}</div>
              <div className="mt-1 text-3xl font-bold text-accent">{peopleReached.toLocaleString()}</div>
            </>
          )}
        </Card>
        <Card>
          {isLoading ? (
            <StatSkeleton />
          ) : (
            <>
              <div className="text-xs font-medium text-text-muted">{t('overview.openIncidents')}</div>
              <div className="mt-1 text-3xl font-bold text-text">{openIncidents}</div>
            </>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('overview.liveMap')}</CardTitle>
          {incidents && incidents.length > 0 && (
            <span className="text-xs text-text-muted">{incidents.length} {t('overview.activeMarkers')}</span>
          )}
        </CardHeader>
        {focusedIncident && (
          <div className="mb-3 flex items-center justify-between rounded-xl border border-secondary/30 bg-secondary/10 px-3.5 py-2.5">
            <div className="flex items-center gap-2 text-sm text-text">
              <Crosshair size={15} className="text-secondary" />
              <span className="font-semibold">{focusedIncident.title}</span>
              <span className="text-xs text-text-muted">
                {focusedIncident.location.lat.toFixed(4)}, {focusedIncident.location.lng.toFixed(4)}
              </span>
            </div>
            <button
              onClick={() => router.push('/dashboard/overview')}
              className="flex items-center gap-1 text-xs font-medium text-text-muted hover:text-text"
            >
              <X size={13} /> {t('overview.clear')}
            </button>
          </div>
        )}
        {isLoading ? (
          <Skeleton className="h-[300px] w-full" />
        ) : isError ? (
          <ErrorState />
        ) : incidents && incidents.length > 0 ? (
          <>
            <IncidentMapClient incidents={incidents} focusIncidentId={focusIncidentId} />
            <div className="mt-3 flex gap-4 text-xs text-text-muted">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-accent" /> {t('common.severityCritical')}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-secondary" /> {t('common.severityHigh')}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-success" /> {t('common.severityMedium')}
              </span>
            </div>
          </>
        ) : (
          <EmptyState message={t('common.noIncidentsYet')} hint={t('overview.noIncidentsHint')} />
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('overview.priorityQueue')}</CardTitle>
        </CardHeader>
        {isLoading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : isError ? (
          <ErrorState />
        ) : topIncidents.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {topIncidents.map((incident) => (
              <div key={incident.id} className="rounded-xl border border-border bg-bg p-4">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-sm font-semibold text-text">{incident.title}</span>
                  <Badge tone={SEVERITY_TONE[incident.severityLevel]}>{incident.severityLevel}</Badge>
                </div>
                <div className="text-xs text-text-muted">
                  {incident.location.label}
                  {incident.peopleAffected ? `, ${incident.peopleAffected} ${t('overview.affected')}` : ''}
                </div>
                <div className={`mt-2 text-2xl font-bold ${SEVERITY_TEXT_COLOR[incident.severityLevel]}`}>
                  {incident.severityScore}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState message={t('common.noIncidentsYet')} />
        )}
      </Card>
    </div>
  )
}
