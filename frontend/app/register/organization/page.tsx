'use client'

import { useState, type FormEvent } from 'react'
import { AuthShell } from '../../../components/layout/AuthShell'
import { Label, Input, Select } from '../../../components/ui/Input'
import { Button } from '../../../components/ui/Button'
import { useRegisterOrganization } from '../../../hooks/useAuth'
import { CheckCircle2 } from 'lucide-react'

export default function RegisterOrganizationPage() {
  const register = useRegisterOrganization()
  const [form, setForm] = useState({
    organizationName: '',
    fullName: '',
    role: 'org_member',
    email: '',
    phone: '',
    password: '',
  })

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    register.mutate(form)
  }

  if (register.isSuccess) {
    return (
      <AuthShell title="Registration received">
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <CheckCircle2 size={36} className="text-success" />
          <p className="text-sm text-text-muted">
            Thanks — your organization&apos;s account is under review. You&apos;ll get access to the dashboard once
            an administrator approves it.
          </p>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell title="Sign up" subtitle="For NGOs, relief teams, and dispatch staff">
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <Label htmlFor="organizationName">Organization name</Label>
          <Input
            id="organizationName"
            required
            value={form.organizationName}
            onChange={(e) => update('organizationName', e.target.value)}
            placeholder="Relief Now Foundation"
          />
        </div>
        <div>
          <Label htmlFor="fullName">Your full name</Label>
          <Input
            id="fullName"
            required
            value={form.fullName}
            onChange={(e) => update('fullName', e.target.value)}
            placeholder="Zara Malik"
          />
        </div>
        <div>
          <Label htmlFor="role">Role</Label>
          <Select id="role" value={form.role} onChange={(e) => update('role', e.target.value)}>
            <option value="org_member">Organization member</option>
            <option value="dispatcher">Dispatcher</option>
            <option value="field_staff">Field staff</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            required
            value={form.email}
            onChange={(e) => update('email', e.target.value)}
            placeholder="you@organization.org"
          />
        </div>
        <div>
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            required
            value={form.phone}
            onChange={(e) => update('phone', e.target.value)}
            placeholder="+92 3XX XXXXXXX"
          />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            required
            value={form.password}
            onChange={(e) => update('password', e.target.value)}
            placeholder="••••••••"
          />
        </div>

        <Button type="submit" className="w-full" disabled={register.isPending}>
          {register.isPending ? 'Submitting…' : 'Submit for review'}
        </Button>
      </form>
    </AuthShell>
  )
}
