'use client'

import { Card } from '../../../components/ui/Card'
import { Badge } from '../../../components/ui/Badge'
import { Table, Thead, Th, Tr, Td } from '../../../components/ui/Table'
import { EmptyState, ErrorState, TableSkeleton } from '../../../components/ui/States'
import { useIncidents } from '../../../hooks/useIncidents'
import type { DamageLevel, Incident, TrappedStatus } from '../../../types'

const TRAPPED_LABEL: Record<TrappedStatus, string> = { yes: 'Yes', partial: 'Partial', no: 'No' }
const TRAPPED_TONE: Record<TrappedStatus, 'critical' | 'high' | 'success'> = {
  yes: 'critical',
  partial: 'high',
  no: 'success',
}
const DAMAGE_LABEL: Record<DamageLevel, string> = { severe: 'Severe', moderate: 'Moderate', minor: 'Minor' }
const SEVERITY_TEXT: Record<Incident['severityLevel'], string> = {
  critical: 'text-accent',
  high: 'text-secondary',
  medium: 'text-success',
}

export default function ResponseListPage() {
  const { data, isLoading, isError } = useIncidents()
  const sorted = [...(data ?? [])].sort((a, b) => b.severityScore - a.severityScore)

  return (
    <Card>
      <h2 className="mb-4 text-base font-semibold text-text">All incidents, ranked by urgency</h2>

      {isLoading ? (
        <TableSkeleton rows={5} cols={6} />
      ) : isError ? (
        <ErrorState />
      ) : sorted.length > 0 ? (
        <Table>
          <Thead>
            <Tr>
              <Th>#</Th>
              <Th>Incident</Th>
              <Th>Affected</Th>
              <Th>Trapped</Th>
              <Th>Damage</Th>
              <Th>Score</Th>
            </Tr>
          </Thead>
          <tbody>
            {sorted.map((incident, i) => (
              <Tr key={incident.id}>
                <Td className="text-text-muted">{i + 1}</Td>
                <Td>
                  <div className="font-medium">{incident.title}</div>
                  <div className="text-xs text-text-muted">{incident.location.label}</div>
                </Td>
                <Td>{incident.peopleAffected}</Td>
                <Td>
                  <Badge tone={TRAPPED_TONE[incident.trapped]}>{TRAPPED_LABEL[incident.trapped]}</Badge>
                </Td>
                <Td className="text-text-muted">{DAMAGE_LABEL[incident.structuralDamage]}</Td>
                <Td>
                  <span className={`text-lg font-bold ${SEVERITY_TEXT[incident.severityLevel]}`}>
                    {incident.severityScore}
                  </span>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <EmptyState message="No incidents reported yet" hint="New reports from the field will be ranked here automatically." />
      )}
    </Card>
  )
}
