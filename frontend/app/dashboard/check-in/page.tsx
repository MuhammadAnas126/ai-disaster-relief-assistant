'use client'

import { Card } from '../../../components/ui/Card'
import { Badge } from '../../../components/ui/Badge'
import { Table, Thead, Th, Tr, Td } from '../../../components/ui/Table'
import { EmptyState, ErrorState, TableSkeleton } from '../../../components/ui/States'
import { useCheckIns } from '../../../hooks/useCheckIns'
import { ShieldCheck } from 'lucide-react'

export default function CheckInPage() {
  const { data, isLoading, isError } = useCheckIns()

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 rounded-card border border-border bg-card p-4 text-sm text-text-muted">
        <ShieldCheck size={18} className="mt-0.5 shrink-0 text-success" />
        <p>
          This only tracks motion, battery level, and check-in signal. Camera, microphone, and messages are never
          accessed passively.
        </p>
      </div>

      <Card>
        <h2 className="mb-4 text-base font-semibold text-text">Wellness status</h2>

        {isLoading ? (
          <TableSkeleton rows={3} cols={5} />
        ) : isError ? (
          <ErrorState />
        ) : data && data.length > 0 ? (
          <Table>
            <Thead>
              <Tr>
                <Th>Name</Th>
                <Th>Last motion</Th>
                <Th>Last check-in</Th>
                <Th>Battery</Th>
                <Th>Status</Th>
              </Tr>
            </Thead>
            <tbody>
              {data.map((row) => (
                <Tr key={row.id} className={row.status === 'flagged' ? 'bg-accent/5' : undefined}>
                  <Td className="font-medium">{row.name}</Td>
                  <Td className="text-text-muted">{row.lastMotion}</Td>
                  <Td className="text-text-muted">{row.lastCheckIn}</Td>
                  <Td className={row.batteryPercent < 20 ? 'text-accent font-medium' : 'text-text-muted'}>
                    {row.batteryPercent}%
                  </Td>
                  <Td>
                    <Badge tone={row.status === 'flagged' ? 'critical' : 'success'}>
                      {row.status === 'flagged' ? 'Flagged' : 'Normal'}
                    </Badge>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState message="No check-ins yet" hint="Field devices reporting in will appear here." />
        )}
      </Card>
    </div>
  )
}
