'use client'

import { useState } from 'react'
import { AlertTriangle, CheckCircle2, ImagePlus, ScanSearch } from 'lucide-react'
import { analyzeSafeSpots, fetchLiveSatelliteImage } from '../../lib/api'
import type { SafeSpotAnalysis } from '../../types'
import { Card } from '../ui/Card'

interface SafeSpotAnalyzerProps {
  position: [number, number]
}

export function SafeSpotAnalyzer({ position }: SafeSpotAnalyzerProps) {
  const [analysis, setAnalysis] = useState<SafeSpotAnalysis | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)

  async function analyzeFile(file: File) {
    setError(null)
    setAnalysis(null)
    setIsPending(true)
    try {
      setAnalysis(await analyzeSafeSpots(file))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Safe-spot analysis failed')
    } finally {
      setIsPending(false)
    }
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    await analyzeFile(file)
    event.target.value = ''
  }

  async function fetchLiveImagery() {
    setError(null)
    setAnalysis(null)
    setIsPending(true)
    try {
      await analyzeFile(await fetchLiveSatelliteImage(position))
    } catch (err) {
      setIsPending(false)
      setError(err instanceof Error ? err.message : 'Live satellite imagery failed')
    }
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-text"><ScanSearch size={18} className="text-accent" /><h2 className="font-semibold">Analyze safe spots</h2></div>
          <p className="mt-1 text-xs text-text-muted">Upload a satellite or drone image to identify landing areas and hazards.</p>
        </div>
        <label className="shrink-0">
          <input type="file" accept="image/*" className="sr-only" onChange={handleFileChange} disabled={isPending} />
          <span className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground transition-colors hover:bg-accent/90">
            <ImagePlus size={16} /> {isPending ? 'Analyzing...' : 'Upload image'}
          </span>
        </label>
      </div>
      <button type="button" onClick={fetchLiveImagery} disabled={isPending} className="mt-4 inline-flex items-center gap-2 rounded-xl border border-secondary px-4 py-2.5 text-sm font-semibold text-secondary transition-colors hover:bg-secondary/10 disabled:opacity-50">
        <ScanSearch size={16} /> {isPending ? 'Fetching and analyzing...' : 'Fetch live satellite imagery'}
      </button>
      <p className="mt-2 text-xs text-text-muted">Current area: {position[0].toFixed(4)}, {position[1].toFixed(4)}</p>

      {error && <div className="mt-4 rounded-xl border border-accent/30 bg-accent/10 px-3 py-2 text-sm text-accent">{error}</div>}
      {analysis && <div className="mt-5 space-y-4">
        <p className="text-sm leading-6 text-text-muted">{analysis.overall_assessment}</p>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-success"><CheckCircle2 size={16} /> Safe spots</div>
            <ul className="space-y-2">{analysis.safe_spots.map((spot) => <li key={`${spot.location}-${spot.capacity}`} className="rounded-lg border border-success/25 bg-success/10 p-3 text-sm"><div className="font-semibold text-text">{spot.location}</div><div className="mt-1 text-text-muted">{spot.reason}</div><div className="mt-1 text-xs text-success">Capacity: {spot.capacity}</div></li>)}</ul>
          </div>
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-secondary"><AlertTriangle size={16} /> Hazard zones</div>
            <ul className="space-y-2">{analysis.hazard_zones.map((hazard) => <li key={`${hazard.location}-${hazard.threat}`} className="rounded-lg border border-secondary/25 bg-secondary/10 p-3 text-sm"><div className="font-semibold text-text">{hazard.location}</div><div className="mt-1 text-text-muted">Avoid: {hazard.threat}</div></li>)}</ul>
          </div>
        </div>
      </div>}
    </Card>
  )
}