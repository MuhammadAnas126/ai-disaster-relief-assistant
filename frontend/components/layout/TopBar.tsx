'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutGrid,
  Package,
  MonitorPlay,
  Video,
  ListOrdered,
  MessageCircle,
  ShieldAlert,
  LogOut,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import type { User } from '../../types'

const NAV_ITEMS = [
  { to: '/dashboard/overview', icon: LayoutGrid, label: 'Overview' },
  { to: '/dashboard/inventory', icon: Package, label: 'Inventory' },
  { to: '/dashboard/check-in', icon: MonitorPlay, label: 'Check-in' },
  { to: '/dashboard/connect', icon: Video, label: 'Connect' },
  { to: '/dashboard/response-list', icon: ListOrdered, label: 'Response list' },
  { to: '/dashboard/assistant', icon: MessageCircle, label: 'Assistant' },
]

interface TopBarProps {
  user: User | null
  onSignOut: () => void
}

export function TopBar({ user, onSignOut }: TopBarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleSignOut() {
    setMenuOpen(false)
    onSignOut()
    router.push('/')
  }

  return (
    <header className="flex items-center justify-between border-b border-border bg-card px-6 py-3">
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-accent-foreground">
          <ShieldAlert size={18} />
        </div>
        <span className="text-base font-bold text-text">AI Disaster Relief</span>
      </div>

      <div className="flex items-center gap-4">
        <nav className="flex items-center gap-1.5" aria-label="Dashboard sections">
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => {
            const isActive = pathname === to
            return (
              <Link
                key={to}
                href={to}
                aria-label={label}
                title={label}
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-xl transition-colors',
                  isActive
                    ? 'bg-accent text-accent-foreground'
                    : 'bg-card text-text-muted hover:bg-white/5 hover:text-text',
                )}
              >
                <Icon size={18} />
              </Link>
            )
          })}
        </nav>

        <div className="h-6 w-px bg-border" aria-hidden />

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((open) => !open)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-sm font-bold text-accent-foreground transition-opacity hover:opacity-90"
            title={user?.fullName ?? 'Account'}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            {user?.initials ?? '—'}
          </button>

          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-11 z-50 w-56 overflow-hidden rounded-card border border-border bg-card shadow-lg"
            >
              <div className="border-b border-border px-4 py-3">
                <div className="truncate text-sm font-semibold text-text">{user?.fullName ?? 'Not signed in'}</div>
                {user?.email && <div className="truncate text-xs text-text-muted">{user.email}</div>}
              </div>
              <button
                role="menuitem"
                onClick={handleSignOut}
                className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium text-accent hover:bg-accent/10"
              >
                <LogOut size={15} />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
