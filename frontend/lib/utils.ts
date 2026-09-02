import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { dictionaries, type Language } from './dictionaries'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function timeAgo(iso: string, language: Language = 'en'): string {
  const t = (key: 'time.justNow' | 'time.minutesAgo' | 'time.hoursAgo' | 'time.daysAgo', n?: number) =>
    dictionaries[language][key].replace('{n}', String(n))

  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return t('time.justNow')
  if (mins < 60) return t('time.minutesAgo', mins)
  const hours = Math.floor(mins / 60)
  if (hours < 24) return t('time.hoursAgo', hours)
  const days = Math.floor(hours / 24)
  return t('time.daysAgo', days)
}

/**
 * Full, human-readable timestamp for tables — e.g. "Tue, Oct 24, 2023, 10:30 AM".
 * Pairs with timeAgo() when a column wants both precision and context.
 */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}
