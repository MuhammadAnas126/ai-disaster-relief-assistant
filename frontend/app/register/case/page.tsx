'use client'

import { useState, type FormEvent } from 'react'
import { AuthShell } from '../../../components/layout/AuthShell'
import { Label, Input, Select, Textarea } from '../../../components/ui/Input'
import { Button } from '../../../components/ui/Button'
import { PinDropMapClient } from '../../../components/map/PinDropMapClient'
import { useCreateIncident } from '../../../hooks/useIncidents'
import { CheckCircle2, LocateFixed } from 'lucide-react'
import type { TrappedStatus } from '../../../types'

const DEFAULT_LOCATION = { lat: 24.8607, lng: 67.0011 }

export default function RegisterCasePage() {
  const createIncident = useCreateIncident()
  const [description, setDescription] = useState('')
  const [peopleAffected, setPeopleAffected] = useState('')
  const [trapped, setTrapped] = useState<TrappedStatus>('no')
  const [location, setLocation] = useState(DEFAULT_LOCATION)
  const [locating, setLocating] = useState(false)

  function useMyLocation() {
    if (!navigator.geolocation) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setLocating(false)
      },
      () => setLocating(false),
      { timeout: 8000 },
    )
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    createIncident.mutate({
      title: description.slice(0, 60) || 'Guest-reported incident',
      description,
      peopleAffected: Number(peopleAffected) || 0,
      trapped,
      isGuestReport: true,
      location: { lat: location.lat, lng: location.lng, label: 'Reported location' },
    })
  }

  if (createIncident.isSuccess) {
    return (
      <AuthShell title="Report received">
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <CheckCircle2 size={36} className="text-success" />
          <p className="text-sm text-text-muted">
            Your situation has been logged and prioritized for response. A dispatch team has been notified — no
            further action is needed from you right now.
          </p>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell title="Register your case" subtitle="No account or password needed">
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <Label htmlFor="description">What&apos;s happening?</Label>
          <Textarea
            id="description"
            required
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe your situation — what happened, where, and who needs help"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="peopleAffected">People affected</Label>
            <Input
              id="peopleAffected"
              type="number"
              min={0}
              required
              value={peopleAffected}
              onChange={(e) => setPeopleAffected(e.target.value)}
              placeholder="0"
            />
          </div>
          <div>
            <Label htmlFor="trapped">Anyone trapped?</Label>
            <Select id="trapped" value={trapped} onChange={(e) => setTrapped(e.target.value as TrappedStatus)}>
              <option value="no">No</option>
              <option value="partial">Partially</option>
              <option value="yes">Yes</option>
            </Select>
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <Label className="mb-0">Location</Label>
            <button
              type="button"
              onClick={useMyLocation}
              className="flex items-center gap-1 text-xs font-medium text-secondary hover:underline"
            >
              <LocateFixed size={13} /> {locating ? 'Locating…' : 'Use my location'}
            </button>
          </div>
          <PinDropMapClient lat={location.lat} lng={location.lng} onChange={(lat, lng) => setLocation({ lat, lng })} />
          <p className="mt-1.5 text-xs text-text-faint">Tap the map to drop or move the pin if it isn&apos;t exact.</p>
        </div>

        <Button type="submit" className="w-full" disabled={createIncident.isPending}>
          {createIncident.isPending ? 'Sending…' : 'Send my report'}
        </Button>
      </form>
    </AuthShell>
  )
}
