'use client'

import { Inbox } from 'lucide-react'
import { useLanguage } from '../../lib/i18n'
import { cn } from '../../lib/utils'

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-border/60', className)} />
}

export function TableSkeleton({ rows = 4, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2.5 py-1">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  )
}

export function StatSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-8 w-16" />
    </div>
  )
}

export function EmptyState({ message, hint }: { message: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      <Inbox size={28} className="text-text-faint" />
      <p className="text-sm font-medium text-text-muted">{message}</p>
      {hint && <p className="text-xs text-text-faint">{hint}</p>}
    </div>
  )
}

export function ErrorState({ message }: { message?: string }) {
  const { t } = useLanguage()
  return (
    <div className="flex flex-col items-center justify-center gap-1 py-10 text-center">
      <p className="text-sm font-medium text-accent">{message ?? t('states.error')}</p>
      <p className="text-xs text-text-faint">{t('states.errorHint')}</p>
    </div>
  )
}
