import Link from 'next/link'
import { LogIn, Building2, TriangleAlert, ChevronRight, ShieldAlert } from 'lucide-react'
import { cn } from '../lib/utils'

interface EntryOption {
  to: string
  icon: typeof LogIn
  title: string
  description: string
  emphasized?: boolean
}

const OPTIONS: EntryOption[] = [
  {
    to: '/sign-in',
    icon: LogIn,
    title: 'Sign in',
    description: 'Already have an account',
  },
  {
    to: '/register/organization',
    icon: Building2,
    title: 'Sign up',
    description: 'NGOs, relief teams, dispatch staff',
  },
  {
    to: '/register/case',
    icon: TriangleAlert,
    title: 'Register your case',
    description: 'I need help — report my situation now',
    emphasized: true,
  },
]

export default function EntrySelect() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
            <ShieldAlert size={26} />
          </div>
          <h1 className="text-2xl font-bold text-text">AI Disaster Relief</h1>
          <p className="mt-1 text-sm text-text-muted">How would you like to continue?</p>
        </div>

        <div className="space-y-3">
          {OPTIONS.map(({ to, icon: Icon, title, description, emphasized }) => (
            <Link
              key={to}
              href={to}
              className={cn(
                'flex items-center gap-4 rounded-card border px-4 py-4 transition-colors',
                emphasized
                  ? 'border-accent bg-accent text-accent-foreground hover:bg-accent/90'
                  : 'border-border bg-card text-text hover:border-text-muted',
              )}
            >
              <div
                className={cn(
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                  emphasized ? 'bg-black/15' : 'bg-bg',
                )}
              >
                <Icon size={18} />
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold">{title}</div>
                <div className={cn('text-xs', emphasized ? 'text-accent-foreground/80' : 'text-text-muted')}>
                  {description}
                </div>
              </div>
              <ChevronRight size={18} className={emphasized ? 'text-accent-foreground/80' : 'text-text-faint'} />
            </Link>
          ))}
        </div>

        <p className="mt-6 text-center text-xs text-text-faint">
          Registering a case never requires an account or password
        </p>
      </div>
    </div>
  )
}
