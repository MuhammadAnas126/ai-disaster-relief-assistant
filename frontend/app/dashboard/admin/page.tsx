'use client'

import { Card } from '../../../components/ui/Card'
import { Button } from '../../../components/ui/Button'
import { Table, Thead, Th, Tr, Td } from '../../../components/ui/Table'
import { EmptyState, ErrorState, TableSkeleton } from '../../../components/ui/States'
import { usePendingUsers, useApproveUser } from '../../../hooks/useAdmin'
import { timeAgo } from '../../../lib/utils'

export default function AdminApprovalPage() {
  const { data, isLoading, isError } = usePendingUsers()
  const approve = useApproveUser()

  return (
    <Card>
      <h2 className="mb-4 text-base font-semibold text-text">Pending organization accounts</h2>

      {isLoading ? (
        <TableSkeleton rows={3} cols={5} />
      ) : isError ? (
        <ErrorState />
      ) : data && data.length > 0 ? (
        <Table>
          <Thead>
            <Tr>
              <Th>Name</Th>
              <Th>Organization</Th>
              <Th>Role</Th>
              <Th>Requested</Th>
              <Th></Th>
            </Tr>
          </Thead>
          <tbody>
            {data.map((user) => (
              <Tr key={user.id}>
                <Td className="font-medium">{user.fullName}</Td>
                <Td className="text-text-muted">{user.organizationName ?? '—'}</Td>
                <Td className="text-text-muted">{user.role.replace('_', ' ')}</Td>
                <Td className="text-text-muted">{timeAgo(user.requestedAt)}</Td>
                <Td>
                  <Button variant="secondary" onClick={() => approve.mutate(user.id)} disabled={approve.isPending}>
                    Approve
                  </Button>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <EmptyState message="No pending accounts" hint="New organization sign-ups awaiting review will appear here." />
      )}
    </Card>
  )
}
