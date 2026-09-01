'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { useLanguage } from '../../lib/i18n'
import { cn } from '../../lib/utils'

export function AuthShell({
  title,
  subtitle,
  wide = false,
  children,
}: {
  title: string
  subtitle?: string
  wide?: boolean
  children: ReactNode
}) {
  const { t } = useLanguage()

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4 py-10">
      <div className={cn('w-full', wide ? 'max-w-7xl' : 'max-w-md')}>
        <Link href="/" className="mb-6 inline-flex items-center gap-1.5 text-xs font-medium text-text-muted hover:text-text">
          <ArrowLeft size={14} /> {t('common.back')}
        </Link>
        <div className="rounded-card border border-border bg-card p-6">
          <h1 className="text-lg font-bold text-text">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-text-muted">{subtitle}</p>}
          <div className="mt-5">{children}</div>
        </div>
      </div>
    </div>
  )
}
