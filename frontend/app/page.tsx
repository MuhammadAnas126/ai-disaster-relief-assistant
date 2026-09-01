'use client'

import Link from 'next/link'
import { LogIn, TriangleAlert, ChevronRight, ShieldAlert } from 'lucide-react'
import { LanguageToggle } from '../components/layout/LanguageToggle'
import { Badge } from '../components/ui/Badge'
import { useLanguage } from '../lib/i18n'
import type { TranslationKey } from '../lib/dictionaries'
import { cn } from '../lib/utils'

interface EntryOption {
  to: string
  icon: typeof LogIn
  titleKey: TranslationKey
  descriptionKey: TranslationKey
  emphasized?: boolean
}

const OPTIONS: EntryOption[] = [
  {
    to: '/register/case',
    icon: TriangleAlert,
    titleKey: 'landing.registerCase',
    descriptionKey: 'landing.registerCaseDesc',
    emphasized: true,
  },
  {
    to: '/sign-in',
    icon: LogIn,
    titleKey: 'landing.signIn',
    descriptionKey: 'landing.signInDesc',
  },
]

export default function EntrySelect() {
  const { t } = useLanguage()

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-bg">
      {/* Decorative backdrop: faint map grid + radial glow so wide screens don't feel empty */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 opacity-50 [background-image:linear-gradient(to_right,var(--color-border)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-border)_1px,transparent_1px)] [background-size:64px_64px] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_45%,black,transparent)]" />
        <div className="absolute left-1/2 top-1/2 h-[460px] w-[720px] max-w-[90vw] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/10 blur-3xl" />
        <div className="absolute -right-24 -top-24 h-[380px] w-[380px] rounded-full bg-secondary/5 blur-3xl" />
        <div className="absolute -bottom-28 -left-24 h-[380px] w-[380px] rounded-full bg-secondary/5 blur-3xl" />
      </div>

      <header className="relative z-10 flex items-center justify-between border-b border-border bg-card/80 px-6 py-3 backdrop-blur-sm">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-accent-foreground">
            <ShieldAlert size={18} />
          </div>
          <span className="text-base font-bold text-text">{t('common.appTitle')}</span>
        </div>
        <LanguageToggle />
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 flex flex-col items-center text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
              <ShieldAlert size={24} />
            </div>
            <h1 className="text-2xl font-bold text-text">{t('landing.heading')}</h1>
            <p className="mt-1 text-sm text-text-muted">{t('landing.subheading')}</p>
          </div>

          <div className="space-y-3">
            {OPTIONS.map(({ to, icon: Icon, titleKey, descriptionKey, emphasized }) => (
              <Link
                key={to}
                href={to}
                className={cn(
                  'flex items-center gap-4 rounded-card border px-4 transition-colors',
                  emphasized
                    ? 'border-accent bg-accent py-5 text-accent-foreground shadow-[0_12px_40px_-12px_var(--color-accent)] hover:bg-accent/90'
                    : 'border-border bg-card py-4 text-text hover:border-text-muted',
                )}
              >
                <div
                  className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                    emphasized ? 'animate-pulse-ring bg-black/20' : 'bg-bg',
                  )}
                >
                  <Icon size={18} />
                </div>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn('font-semibold', emphasized ? 'text-base font-bold' : 'text-sm')}>
                      {t(titleKey)}
                    </span>
                    {emphasized && (
                      <Badge
                        tone="critical"
                        className="border-black/20 bg-black/20 px-2 py-0.5 text-[10px] text-accent-foreground"
                      >
                        {t('landing.emergency')}
                      </Badge>
                    )}
                  </div>
                  <div className={cn('text-xs', emphasized ? 'text-accent-foreground/80' : 'text-text-muted')}>
                    {t(descriptionKey)}
                  </div>
                </div>
                <ChevronRight size={18} className={emphasized ? 'text-accent-foreground/80' : 'text-text-faint'} />
              </Link>
            ))}
          </div>

          <p className="mt-6 text-center text-xs text-text-faint">{t('landing.noAccountNeeded')}</p>
        </div>
      </main>
    </div>
  )
}
