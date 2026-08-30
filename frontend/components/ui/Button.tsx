import type { ButtonHTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

type Variant = 'primary' | 'secondary' | 'ghost'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
}

const variantClasses: Record<Variant, string> = {
  primary: 'bg-accent text-accent-foreground hover:bg-accent/90 disabled:bg-accent/40',
  secondary: 'bg-card border border-border text-text hover:border-text-muted disabled:opacity-50',
  ghost: 'bg-transparent text-text-muted hover:text-text hover:bg-white/5 disabled:opacity-40',
}

export function Button({ variant = 'primary', className, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors',
        'disabled:cursor-not-allowed',
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  )
}
