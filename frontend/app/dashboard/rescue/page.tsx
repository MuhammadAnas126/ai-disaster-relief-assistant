'use client'

import { useState } from 'react'
import { AlertTriangle, LocateFixed, MapPin, Navigation, Phone, ShieldAlert } from 'lucide-react'
import { Card } from '../../../components/ui/Card'
import { Button } from '../../../components/ui/Button'
import { Label, Select, Textarea } from '../../../components/ui/Input'
import { RescueGuidanceMapClient } from '../../../components/map/RescueGuidanceMapClient'
import { SafeSpotAnalyzer } from '../../../components/map/SafeSpotAnalyzer'
import { useCallAuthority, useRescueGuidance } from '../../../hooks/useRescue'
import { useLanguage } from '../../../lib/i18n'
import type { TrappedStatus } from '../../../types'

const DEFAULT_POSITION: [number, number] = [24.8607, 67.0011]

export default function RescuePage() {
  const { t, language } = useLanguage()
  const guidance = useRescueGuidance()
  const callAuthority = useCallAuthority()
  const [situation, setSituation] = useState('')
  const [trapped, setTrapped] = useState<TrappedStatus>('yes')
  const [disasterType, setDisasterType] = useState('')
  const [position, setPosition] = useState<[number, number]>(DEFAULT_POSITION)
  const [locationState, setLocationState] = useState<'idle' | 'loading' | 'shared' | 'error'>('idle')

  function shareLocation() {
    if (!navigator.geolocation) return setLocationState('error')
    setLocationState('loading')
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => { setPosition([coords.latitude, coords.longitude]); setLocationState('shared') },
      () => setLocationState('error'),
      { enableHighAccuracy: true, timeout: 8000 },
    )
  }

  function requestGuidance() {
    if (!situation.trim()) return
    guidance.mutate({ lat: position[0], lng: position[1], situation: situation.trim(), trapped, disasterType: disasterType || undefined, language })
  }

  function callForHelp() {
    callAuthority.mutate({ sessionId: guidance.data?.sessionId, lat: position[0], lng: position[1], situation: situation.trim() || undefined }, {
      onSuccess: (result) => { if (result.authorityPhone) window.location.href = `tel:${result.authorityPhone}` },
    })
  }

  const activeGuidance = guidance.data

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-accent"><ShieldAlert size={15} /> {t('common.appTitle')}</div>
          <h1 className="text-2xl font-bold text-text">{t('rescue.title')}</h1>
          <p className="mt-1 text-sm text-text-muted">{t('rescue.subtitle')}</p>
        </div>
        <Button type="button" variant="secondary" onClick={shareLocation} disabled={locationState === 'loading'}><LocateFixed size={16} />{locationState === 'shared' ? t('rescue.locationShared') : t('rescue.shareLocation')}</Button>
      </div>

      {locationState === 'error' && <div className="rounded-xl border border-secondary/30 bg-secondary/10 px-4 py-3 text-sm text-secondary">{t('rescue.noLocation')}</div>}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]">
        <Card className="h-fit">
          <div className="mb-5 flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent"><AlertTriangle size={19} /></div><div><h2 className="font-semibold text-text">{t('rescue.situation')}</h2><p className="mt-1 text-xs text-text-muted">{position[0].toFixed(4)}, {position[1].toFixed(4)}</p></div></div>
          <div className="mb-4 flex flex-wrap gap-2">
            {[[t('rescue.quickTrapped'), 'I am trapped'], [t('rescue.quickFlood'), 'Flood water is rising around me'], [t('rescue.quickEarthquake'), 'An earthquake damaged the building'], [t('rescue.quickFire'), 'There is a fire nearby']].map(([label, value]) => <button key={label} type="button" onClick={() => setSituation(value)} className="rounded-xl border border-border px-3 py-2 text-left text-xs font-medium text-text-muted transition-colors hover:border-secondary hover:text-text">{label}</button>)}
          </div>
          <Label htmlFor="rescue-situation">{t('rescue.situation')}</Label>
          <Textarea id="rescue-situation" value={situation} onChange={(event) => setSituation(event.target.value)} rows={5} placeholder={t('registerCase.descriptionPlaceholder')} />
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div><Label htmlFor="rescue-trapped">{t('registerCase.trapped')}</Label><Select id="rescue-trapped" value={trapped} onChange={(event) => setTrapped(event.target.value as TrappedStatus)}><option value="yes">{t('registerCase.trappedYes')}</option><option value="partial">{t('registerCase.trappedPartial')}</option><option value="no">{t('registerCase.trappedNo')}</option></Select></div>
            <div><Label htmlFor="rescue-disaster">{t('common.disaster')}</Label><Select id="rescue-disaster" value={disasterType} onChange={(event) => setDisasterType(event.target.value)}><option value="">{t('disaster.unknown')}</option><option value="flood">{t('disaster.flood')}</option><option value="earthquake">{t('disaster.earthquake')}</option><option value="fire">{t('disaster.fire')}</option><option value="building_collapse">{t('disaster.building_collapse')}</option><option value="other">{t('disaster.other')}</option></Select></div>
          </div>
          <Button type="button" className="mt-5 w-full" onClick={requestGuidance} disabled={!situation.trim() || guidance.isPending}><Navigation size={17} /> {guidance.isPending ? t('rescue.generating') : t('rescue.getGuidance')}</Button>
          <Button type="button" variant="secondary" className="mt-3 w-full border-accent/40 text-accent hover:border-accent" onClick={callForHelp} disabled={callAuthority.isPending}><Phone size={17} /> {callAuthority.isPending ? t('rescue.callingAuthority') : t('rescue.callAuthority')}</Button>
          {callAuthority.data && <p className="mt-3 text-center text-xs text-success">{t('rescue.notificationSent')} · {callAuthority.data.authorityPhone}</p>}
        </Card>

        <div className="space-y-4">
          <Card className="overflow-hidden p-0"><RescueGuidanceMapClient position={position} safePoint={activeGuidance?.safePoint ?? null} />{!activeGuidance && <div className="flex items-center gap-2 border-t border-border px-5 py-3 text-xs text-text-muted"><MapPin size={14} /> {t('rescue.noLocation')}</div>}</Card>
          {guidance.isError && <div className="rounded-xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-accent">{t('states.error')}</div>}
          {activeGuidance && <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2"><Card className="p-4"><div className="text-xs text-text-muted">{t('rescue.safePoint')}</div><div className="mt-1 font-semibold text-text">{activeGuidance.safePoint?.label ?? t('rescue.noLocation')}</div></Card><Card className="p-4"><div className="text-xs text-text-muted">{t('rescue.estimatedTime')}</div><div className="mt-1 font-semibold text-text">{activeGuidance.estimatedTimeMinutes ? `${activeGuidance.estimatedTimeMinutes} ${t('rescue.minutes')}` : '—'}</div></Card></div>
            {activeGuidance.warnings.length > 0 && <div className="rounded-xl border border-secondary/30 bg-secondary/10 p-4"><div className="mb-2 flex items-center gap-2 text-sm font-semibold text-secondary"><AlertTriangle size={16} /> {t('rescue.warning')}</div><ul className="space-y-1 text-sm text-text">{activeGuidance.warnings.map((warning) => <li key={warning}>• {warning}</li>)}</ul></div>}
            <Card><div className="mb-4 flex items-center justify-between"><h2 className="font-semibold text-text">{t('rescue.title')}</h2><span className="text-xs text-text-muted">{activeGuidance.steps.length} {t('rescue.stepPrefix')}</span></div><ol className="space-y-4">{activeGuidance.steps.map((step) => <li key={step.order} className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground">{step.order}</span><div><div className="text-sm font-semibold text-text">{step.instruction}</div><div className="mt-1 text-sm leading-6 text-text-muted">{step.detail}</div></div></li>)}</ol><p className="mt-5 border-t border-border pt-4 text-xs text-text-faint">{t('rescue.disclaimer')}</p></Card>
          </div>}
        </div>
      </div>
      <SafeSpotAnalyzer />
    </div>
  )
}