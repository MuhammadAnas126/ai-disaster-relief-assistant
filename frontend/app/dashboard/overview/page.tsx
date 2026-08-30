'use client'

import { Card, CardHeader, CardTitle } from '../../../components/ui/Card'
import { Badge } from '../../../components/ui/Badge'
import { EmptyState, ErrorState, StatSkeleton, Skeleton } from '../../../components/ui/States'
import { IncidentMapClient } from '../../../components/map/IncidentMapClient'
import { useIncidents } from '../../../hooks/useIncidents'
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
  const { data: incidents, isLoading, isError } = useIncidents()

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
              <div className="text-xs font-medium text-text-muted">People reached today</div>
              <div className="mt-1 text-3xl font-bold text-accent">{peopleReached.toLocaleString()}</div>
            </>
          )}
        </Card>
        <Card>
          {isLoading ? (
            <StatSkeleton />
          ) : (
            <>
              <div className="text-xs font-medium text-text-muted">Open incidents</div>
              <div className="mt-1 text-3xl font-bold text-text">{openIncidents}</div>
            </>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Live incident map</CardTitle>
          {incidents && incidents.length > 0 && (
            <span className="text-xs text-text-muted">{incidents.length} active markers</span>
          )}
        </CardHeader>
        {isLoading ? (
          <Skeleton className="h-[300px] w-full" />
        ) : isError ? (
          <ErrorState />
        ) : incidents && incidents.length > 0 ? (
          <>
            <IncidentMapClient incidents={incidents} />
            <div className="mt-3 flex gap-4 text-xs text-text-muted">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-accent" /> Critical
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-secondary" /> High
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-success" /> Medium
              </span>
            </div>
          </>
        ) : (
          <EmptyState message="No incidents reported yet" hint="New reports will appear here in real time." />
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Priority queue</CardTitle>
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
                  {incident.peopleAffected ? `, ${incident.peopleAffected} affected` : ''}
                </div>
                <div className={`mt-2 text-2xl font-bold ${SEVERITY_TEXT_COLOR[incident.severityLevel]}`}>
                  {incident.severityScore}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState message="No incidents reported yet" />
        )}
      </Card>
    </div>
  )
}
