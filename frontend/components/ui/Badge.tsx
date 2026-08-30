import type { HTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

type BadgeTone = 'critical' | 'high' | 'medium' | 'success' | 'neutral'

const toneClasses: Record<BadgeTone, string> = {
  critical: 'text-accent bg-accent/10 border-accent/30',
  high: 'text-secondary bg-secondary/10 border-secondary/30',
  medium: 'text-success bg-success/10 border-success/30',
  success: 'text-success bg-success/10 border-success/30',
  neutral: 'text-text-muted bg-text-muted/10 border-text-muted/20',
}

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone
}

export function Badge({ tone = 'neutral', className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide',
        toneClasses[tone],
        className,
      )}
      {...props}
    />
  )
}
