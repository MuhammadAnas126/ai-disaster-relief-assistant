'use client'

import { Card } from '../../../components/ui/Card'
import { Badge } from '../../../components/ui/Badge'
import { Table, Thead, Th, Tr, Td } from '../../../components/ui/Table'
import { EmptyState, ErrorState, TableSkeleton } from '../../../components/ui/States'
import { useCheckIns } from '../../../hooks/useCheckIns'
import { useLanguage } from '../../../lib/i18n'
import { ShieldCheck } from 'lucide-react'

export default function CheckInPage() {
  const { data, isLoading, isError } = useCheckIns()
  const { t } = useLanguage()

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 rounded-card border border-border bg-card p-4 text-sm text-text-muted">
        <ShieldCheck size={18} className="mt-0.5 shrink-0 text-success" />
        <p>{t('checkIn.privacyNote')}</p>
      </div>

      <Card>
        <h2 className="mb-4 text-base font-semibold text-text">{t('checkIn.wellness')}</h2>

        {isLoading ? (
          <TableSkeleton rows={3} cols={5} />
        ) : isError ? (
          <ErrorState />
        ) : data && data.length > 0 ? (
          <Table>
            <Thead>
              <Tr>
                <Th>{t('common.name')}</Th>
                <Th>{t('checkIn.lastMotion')}</Th>
                <Th>{t('checkIn.lastCheckIn')}</Th>
                <Th>{t('checkIn.battery')}</Th>
                <Th>{t('common.status')}</Th>
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
                      {row.status === 'flagged' ? t('checkIn.flagged') : t('checkIn.normal')}
                    </Badge>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState message={t('checkIn.empty')} hint={t('checkIn.emptyHint')} />
        )}
      </Card>
    </div>
  )
}
