'use client'

import { useLanguage } from '../../lib/i18n'
import { cn } from '../../lib/utils'

export function LanguageToggle() {
  const { language, setLanguage } = useLanguage()

  const segmentClasses = (active: boolean) =>
    cn(
      'rounded-full px-3 py-1 text-xs font-semibold transition-colors',
      active ? 'bg-accent text-accent-foreground' : 'text-text-muted hover:text-text',
    )

  return (
    <div
      role="group"
      aria-label="Language selection"
      className="flex items-center gap-0.5 rounded-full border border-border bg-bg p-1"
    >
      <button
        type="button"
        onClick={() => setLanguage('en')}
        aria-pressed={language === 'en'}
        className={segmentClasses(language === 'en')}
      >
        EN
      </button>
      <span aria-hidden className="px-0.5 text-xs text-text-faint">
        |
      </span>
      <button
        type="button"
        onClick={() => setLanguage('ur')}
        aria-pressed={language === 'ur'}
        lang="ur"
        className={segmentClasses(language === 'ur')}
      >
        اردو
      </button>
    </div>
  )
}
