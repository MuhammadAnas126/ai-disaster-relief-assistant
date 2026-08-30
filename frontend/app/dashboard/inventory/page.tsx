'use client'

import { Card, CardHeader, CardTitle } from '../../../components/ui/Card'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { Table, Thead, Th, Tr, Td } from '../../../components/ui/Table'
import { EmptyState, ErrorState, StatSkeleton, TableSkeleton } from '../../../components/ui/States'
import { useInventory, useMatchInventory } from '../../../hooks/useInventory'
import type { SupplyStatus } from '../../../types'
import { MoreHorizontal } from 'lucide-react'

const STATUS_TONE: Record<SupplyStatus, 'success' | 'high' | 'critical'> = {
  available: 'success',
  low_stock: 'high',
  out_of_stock: 'critical',
}

const STATUS_LABEL: Record<SupplyStatus, string> = {
  available: 'Available',
  low_stock: 'Low stock',
  out_of_stock: 'Out of stock',
}

export default function InventoryPage() {
  const { data, isLoading, isError } = useInventory()
  const match = useMatchInventory()

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          {isLoading ? (
            <StatSkeleton />
          ) : (
            <>
              <div className="text-3xl font-bold text-text">{data?.stats.totalUnits ?? 0}</div>
              <div className="mt-1 text-xs text-text-muted">Total units</div>
            </>
          )}
        </Card>
        <Card>
          {isLoading ? (
            <StatSkeleton />
          ) : (
            <>
              <div className="text-3xl font-bold text-success">{data?.stats.matched ?? 0}</div>
              <div className="mt-1 text-xs text-text-muted">Matched</div>
            </>
          )}
        </Card>
        <Card>
          {isLoading ? (
            <StatSkeleton />
          ) : (
            <>
              <div className="text-3xl font-bold text-accent">{data?.stats.unmetNeeds ?? 0}</div>
              <div className="mt-1 text-xs text-text-muted">Unmet needs</div>
            </>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Supply list</CardTitle>
          <div className="flex items-center gap-3">
            <Button variant="secondary" onClick={() => match.mutate()} disabled={match.isPending}>
              {match.isPending ? 'Matching…' : 'Run matching'}
            </Button>
            <button className="text-text-faint hover:text-text-muted" aria-label="More options">
              <MoreHorizontal size={18} />
            </button>
          </div>
        </CardHeader>

        {isLoading ? (
          <TableSkeleton />
        ) : isError ? (
          <ErrorState />
        ) : data && data.items.length > 0 ? (
          <Table>
            <Thead>
              <Tr>
                <Th>Item</Th>
                <Th>Quantity</Th>
                <Th>Location</Th>
                <Th>Status</Th>
              </Tr>
            </Thead>
            <tbody>
              {data.items.map((item) => (
                <Tr key={item.id}>
                  <Td className="font-medium">{item.item}</Td>
                  <Td>{item.quantity}</Td>
                  <Td className="text-text-muted">{item.location}</Td>
                  <Td>
                    <Badge tone={STATUS_TONE[item.status]}>{STATUS_LABEL[item.status]}</Badge>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState message="No inventory recorded yet" hint="Supplies added by relief camps will show up here." />
        )}
      </Card>
    </div>
  )
}
