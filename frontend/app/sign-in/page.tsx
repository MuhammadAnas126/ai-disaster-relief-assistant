'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { AuthShell } from '../../components/layout/AuthShell'
import { Label, Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import { useLogin } from '../../hooks/useAuth'
import { useAuthContext } from '../../lib/authContext'

export default function SignInPage() {
  const router = useRouter()
  const login = useLogin()
  const { setUser } = useAuthContext()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pendingNotice, setPendingNotice] = useState(false)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setPendingNotice(false)
    login.mutate(
      { email, password },
      {
        onSuccess: (data) => {
          if (data.user.status === 'approved') {
            setUser(data.user)
            router.push('/dashboard/overview')
          } else {
            setPendingNotice(true)
          }
        },
      },
    )
  }

  return (
    <AuthShell title="Sign in" subtitle="Access your dispatch or organization dashboard">
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@organization.org"
          />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>

        {pendingNotice && (
          <div className="rounded-xl border border-secondary/30 bg-secondary/10 px-3.5 py-3 text-sm text-secondary">
            Your account is awaiting approval.
          </div>
        )}

        {login.isError && (
          <div className="rounded-xl border border-accent/30 bg-accent/10 px-3.5 py-3 text-sm text-accent">
            Couldn&apos;t sign in. Check your email and password and try again.
          </div>
        )}

        <Button type="submit" className="w-full" disabled={login.isPending}>
          {login.isPending ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </AuthShell>
  )
}
