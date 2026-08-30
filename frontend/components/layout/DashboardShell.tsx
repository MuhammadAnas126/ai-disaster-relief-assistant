'use client'

import type { ReactNode } from 'react'
import { TopBar } from './TopBar'
import { useLiveUpdates } from '../../hooks/useLiveUpdates'
import { useAuthContext } from '../../lib/authContext'

export function DashboardShell({ children }: { children: ReactNode }) {
  useLiveUpdates()
  const { user, logout } = useAuthContext()

  return (
    <div className="min-h-screen bg-bg">
      <TopBar user={user} onSignOut={logout} />
      <main className="mx-auto max-w-6xl px-6 py-6">{children}</main>
    </div>
  )
}
