'use client'

import { Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Crosshair, Trash2, X } from 'lucide-react'
import { Card } from '../../../components/ui/Card'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { Table, Thead, Th, Tr, Td } from '../../../components/ui/Table'
import { EmptyState, ErrorState, Skeleton, TableSkeleton } from '../../../components/ui/States'
import { useDeleteIncident, useIncidents } from '../../../hooks/useIncidents'
import { useLanguage } from '../../../lib/i18n'
import { formatDateTime } from '../../../lib/utils'
import type { TranslationKey } from '../../../lib/dictionaries'
import type { DamageLevel, Incident, TrappedStatus } from '../../../types'

const TRAPPED_LABEL_KEY: Record<TrappedStatus, TranslationKey> = {
  yes: 'responseList.trappedYes',
  partial: 'responseList.trappedPartial',
  no: 'responseList.trappedNo',
}
const TRAPPED_TONE: Record<TrappedStatus, 'critical' | 'high' | 'success'> = {
  yes: 'critical',
  partial: 'high',
  no: 'success',
}
const DAMAGE_LABEL_KEY: Record<DamageLevel, TranslationKey> = {
  severe: 'responseList.damageSevere',
  moderate: 'responseList.damageModerate',
  minor: 'responseList.damageMinor',
}
const SEVERITY_TEXT: Record<Incident['severityLevel'], string> = {
  critical: 'text-accent',
  high: 'text-secondary',
  medium: 'text-success',
}

export default function ResponseListPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[400px] w-full" />}>
      <ResponseListContent />
    </Suspense>
  )
}

function ResponseListContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const filterIncidentId = searchParams.get('incident')
  const { data, isLoading, isError } = useIncidents()
  const deleteIncident = useDeleteIncident()
  const { t } = useLanguage()

  const allSorted = [...(data ?? [])].sort((a, b) => b.severityScore - a.severityScore)
  // ?incident=<id> filters the list to a single case (from the map popup's
  // "View details" link); without it, every incident is shown.
  const filteredIncident = filterIncidentId
    ? allSorted.find((i) => i.id === filterIncidentId) ?? null
    : null
  const sorted = filterIncidentId
    ? filteredIncident
      ? [filteredIncident]
      : []
    : allSorted

  /** Jump to the live map centered on this incident's exact location. */
  function viewOnMap(incidentId: string) {
    router.push(`/dashboard/overview?focus=${incidentId}`)
  }

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-text">
          {filterIncidentId ? t('responseList.incidentDetails') : t('responseList.allIncidents')}
        </h2>
        {filteredIncident && (
          <button
            onClick={() => router.push('/dashboard/response-list')}
            className="flex items-center gap-1 text-xs font-medium text-text-muted hover:text-text"
          >
            <X size={13} /> {t('responseList.clearFilter')}
          </button>
        )}
      </div>

      {deleteIncident.isError && (
        <div className="mb-4 rounded-xl border border-accent/30 bg-accent/10 px-3.5 py-3 text-sm text-accent">
          {t('responseList.deleteFailed')}
        </div>
      )}

      {isLoading ? (
        <TableSkeleton rows={5} cols={9} />
      ) : isError ? (
        <ErrorState />
      ) : sorted.length > 0 ? (
        <Table>
          <Thead>
            <Tr>
              <Th>#</Th>
              <Th>{t('responseList.incident')}</Th>
              <Th>{t('responseList.reported')}</Th>
              <Th>{t('responseList.affected')}</Th>
              <Th>{t('responseList.trapped')}</Th>
              <Th>{t('responseList.damage')}</Th>
              <Th>{t('responseList.score')}</Th>
              <Th>{t('common.location')}</Th>
              <Th></Th>
            </Tr>
          </Thead>
          <tbody>
            {sorted.map((incident, i) => {
              const isDeleting = deleteIncident.isPending && deleteIncident.variables === incident.id
              return (
                <Tr key={incident.id}>
                  <Td className="text-text-muted">{i + 1}</Td>
                  <Td>
                    <div className="font-medium">{incident.title}</div>
                    <div className="text-xs text-text-muted">{incident.location.label}</div>
                  </Td>
                  <Td className="whitespace-nowrap text-text-muted">{formatDateTime(incident.reportedAt)}</Td>
                  <Td>{incident.peopleAffected}</Td>
                  <Td>
                    <Badge tone={TRAPPED_TONE[incident.trapped]}>{t(TRAPPED_LABEL_KEY[incident.trapped])}</Badge>
                  </Td>
                  <Td className="text-text-muted">{t(DAMAGE_LABEL_KEY[incident.structuralDamage])}</Td>
                  <Td>
                    <span className={`text-lg font-bold ${SEVERITY_TEXT[incident.severityLevel]}`}>
                      {incident.severityScore}
                    </span>
                  </Td>
                  <Td>
                    <div className="flex flex-col gap-1.5">
                      <span className="font-mono text-xs text-text-muted">
                        {incident.location.lat.toFixed(4)}, {incident.location.lng.toFixed(4)}
                      </span>
                      <Button
                        type="button"
                        variant="secondary"
                        className="px-2.5 py-1 text-xs"
                        onClick={() => viewOnMap(incident.id)}
                      >
                        <Crosshair size={13} /> {t('responseList.getLocation')}
                      </Button>
                    </div>
                  </Td>
                  <Td>
                    <Button
                      type="button"
                      variant="secondary"
                      className="px-2.5 py-1 text-xs text-accent hover:border-accent/40"
                      onClick={() => deleteIncident.mutate(incident.id)}
                      disabled={deleteIncident.isPending}
                    >
                      <Trash2 size={13} />
                      {isDeleting ? t('responseList.deleting') : t('responseList.delete')}
                    </Button>
                  </Td>
                </Tr>
              )
            })}
          </tbody>
        </Table>
      ) : filterIncidentId ? (
        <EmptyState message={t('responseList.notFound')} hint={t('responseList.notFoundHint')} />
      ) : (
        <EmptyState message={t('common.noIncidentsYet')} hint={t('responseList.emptyHint')} />
      )}
    </Card>
  )
}
