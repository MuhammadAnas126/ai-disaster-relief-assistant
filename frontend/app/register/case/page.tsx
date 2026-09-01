'use client'

import { useRef, useState, type FormEvent } from 'react'
import { AuthShell } from '../../../components/layout/AuthShell'
import { Label, Input, Textarea } from '../../../components/ui/Input'
import { Button } from '../../../components/ui/Button'
import { ChatWidget } from '../../../components/ui/ChatWidget'
import { PinDropMapClient } from '../../../components/map/PinDropMapClient'
import { useCreateIncident } from '../../../hooks/useIncidents'
import { useLiveShare, type LiveShareMetadata } from '../../../hooks/useLiveShare'
import { useUploadEvidence } from '../../../hooks/useEvidence'
import { evidenceMediaUrl } from '../../../lib/api'
import { extractAnalysisFrame } from '../../../lib/media'
import {
  CheckCircle2,
  LocateFixed,
  MapPin,
  Video,
  VideoOff,
  Radio,
  AlertTriangle,
  Camera,
  FileVideo,
  Loader2,
  Siren,
  UploadCloud,
} from 'lucide-react'
import type { AssistantContext, EvidenceRecord, LiveAnalysis, TrappedStatus } from '../../../types'
import { useLanguage } from '../../../lib/i18n'
import type { TranslationKey } from '../../../lib/dictionaries'
import { cn } from '../../../lib/utils'

const DEFAULT_LOCATION = { lat: 24.8607, lng: 67.0011 }

const TRAPPED_OPTIONS: { value: TrappedStatus; labelKey: TranslationKey }[] = [
  { value: 'no', labelKey: 'registerCase.trappedNo' },
  { value: 'partial', labelKey: 'registerCase.trappedPartial' },
  { value: 'yes', labelKey: 'registerCase.trappedYes' },
]

const ANALYSIS_STATUS_LABEL: Record<LiveAnalysis['status'], TranslationKey> = {
  standing: 'registerCase.analysisStanding',
  sitting: 'registerCase.analysisSitting',
  collapsed: 'registerCase.analysisCollapsed',
}

// Client-side cap mirroring what a victim on a mobile connection can send.
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024

/** One victim upload shown in the evidence list. */
interface EvidenceItem {
  id: string
  name: string
  state: 'uploading' | 'done' | 'error'
  record?: EvidenceRecord
  error?: string
}

const DISASTER_LABEL: Record<string, TranslationKey> = {
  flood: 'disaster.flood',
  earthquake: 'disaster.earthquake',
  fire: 'disaster.fire',
  building_collapse: 'disaster.building_collapse',
  landslide: 'disaster.landslide',
  storm: 'disaster.storm',
  other: 'disaster.other',
}

const STATUS_LABEL: Record<string, TranslationKey> = {
  standing: 'registerCase.analysisStanding',
  sitting: 'registerCase.analysisSitting',
  collapsed: 'registerCase.analysisCollapsed',
}

/** Translate a Qwen-VL disaster type; unknown values fall back to a readable raw string. */
function formatDisasterType(type: string | null | undefined, t: (key: TranslationKey) => string): string {
  if (!type) return '—'
  return DISASTER_LABEL[type] ? t(DISASTER_LABEL[type]) : type.replace(/_/g, ' ')
}

function formatVictimStatus(status: string | null | undefined, t: (key: TranslationKey) => string): string {
  if (!status) return '—'
  return STATUS_LABEL[status] ? t(STATUS_LABEL[status]) : status
}

export default function RegisterCasePage() {
  const createIncident = useCreateIncident()
  const uploadEvidence = useUploadEvidence()
  const { t, language } = useLanguage()
  const [description, setDescription] = useState('')
  const [peopleAffected, setPeopleAffected] = useState('')
  const [trapped, setTrapped] = useState<TrappedStatus>('no')
  const [trappedDetails, setTrappedDetails] = useState('')
  const [location, setLocation] = useState(DEFAULT_LOCATION)
  const [geoStatus, setGeoStatus] = useState<'idle' | 'locating' | 'success' | 'error'>('idle')
  const [evidenceTab, setEvidenceTab] = useState<'upload' | 'stream'>('upload')
  const [evidenceItems, setEvidenceItems] = useState<EvidenceItem[]>([])
  const [uploadedEvidenceIds, setUploadedEvidenceIds] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const pendingCounterRef = useRef(0)

  // Victim details travel with every streamed frame so archived evidence can
  // answer admin queries like "trapped victims based on recent photos".
  const liveShareMetadata: LiveShareMetadata = {
    location: { lat: location.lat, lng: location.lng, label: t('registerCase.reportedLocation') },
    trapped,
    peopleAffected: Number(peopleAffected) || 0,
  }
  const liveShare = useLiveShare(liveShareMetadata)

  function useMyLocation() {
    if (!navigator.geolocation) {
      setGeoStatus('error')
      return
    }
    setGeoStatus('locating')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setGeoStatus('success')
      },
      () => setGeoStatus('error'),
      { enableHighAccuracy: true, timeout: 8000 },
    )
  }

  async function handleFilesSelected(files: FileList | null) {
    // Snapshot the selection before touching the input — e.target.files is a
    // live view of the input's selection, so resetting input.value first
    // empties this FileList too and silently drops every chosen file.
    const selected = Array.from(files ?? [])
    if (selected.length === 0) return
    // Allow picking the same file again after a failed upload.
    if (fileInputRef.current) fileInputRef.current.value = ''

    // Sequential uploads — one AI analysis at a time keeps the flow gentle on
    // weak mobile connections typical during disasters.
    for (const file of selected) {
      pendingCounterRef.current += 1
      const localId = `pending-${pendingCounterRef.current}`

      if (file.size > MAX_UPLOAD_BYTES) {
        setEvidenceItems((items) => [
          ...items,
          { id: localId, name: file.name, state: 'error', error: t('registerCase.fileTooLarge') },
        ])
        continue
      }

      setEvidenceItems((items) => [...items, { id: localId, name: file.name, state: 'uploading' }])
      try {
        // The backend analyzes a still JPEG, so videos need a poster frame and
        // photos a downscale — it doubles as the admin gallery thumbnail.
        const frame = await extractAnalysisFrame(file)
        const record = await uploadEvidence.mutateAsync({
          file,
          frame,
          source: 'upload',
          location: { lat: location.lat, lng: location.lng, label: t('registerCase.reportedLocation') },
          trapped,
          peopleAffected: Number(peopleAffected) || 0,
        })
        setEvidenceItems((items) =>
          items.map((it) => (it.id === localId ? { ...it, id: record.id, state: 'done', record } : it)),
        )
        setUploadedEvidenceIds((ids) => [...ids, record.id])
      } catch (err) {
        setEvidenceItems((items) =>
          items.map((it) =>
            it.id === localId
              ? {
                  ...it,
                  state: 'error',
                  error: err instanceof Error ? err.message : t('registerCase.evidenceFailed'),
                }
              : it,
          ),
        )
      }
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const fullDescription = [
      description,
      trapped !== 'no' && trappedDetails.trim() ? `${t('registerCase.trappedDetailsPrefix')}: ${trappedDetails.trim()}` : null,
    ]
      .filter(Boolean)
      .join('\n\n')
    // Link every photo/video/live frame the victim submitted to this SOS so
    // admins (and the AI assistant) can trace cases back to their evidence.
    const allEvidenceIds = [...uploadedEvidenceIds, ...liveShare.evidenceIds]
    createIncident.mutate({
      title: description.slice(0, 60) || t('registerCase.guestTitle'),
      description: fullDescription,
      peopleAffected: Number(peopleAffected) || 0,
      trapped,
      isGuestReport: true,
      location: { lat: location.lat, lng: location.lng, label: t('registerCase.reportedLocation') },
      evidenceIds: allEvidenceIds.length > 0 ? allEvidenceIds : undefined,
    })
  }

  // Live case context for the AI assistant — lets it personalize guidance
  // (flood → water safety, trapped → signaling/battery tips, etc.) and reply
  // in the victim's selected UI language.
  const chatContext: AssistantContext = {
    situation: description,
    location: `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`,
    trapped,
    peopleAffected: Number(peopleAffected) || 0,
    submitted: createIncident.isSuccess,
    language,
  }

  if (createIncident.isSuccess) {
    return (
      <AuthShell title={t('registerCase.receivedTitle')}>
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <CheckCircle2 size={36} className="text-success" />
          <p className="text-sm text-text-muted">{t('registerCase.receivedMessage')}</p>
        </div>
        {/* Assistant stays available while the victim waits for help */}
        <ChatWidget context={chatContext} />
      </AuthShell>
    )
  }

  return (
    <AuthShell title={t('registerCase.title')} subtitle={t('registerCase.subtitle')} wide>
      {/* Two-column layout: emergency form on the left, location & visual assessment on the right.
          Stacks vertically on mobile, side-by-side from lg upwards; columns stretch to equal height. */}
      <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-2">
        {/* LEFT — Emergency details */}
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div>
            <Label htmlFor="description">{t('registerCase.description')}</Label>
            <Textarea
              id="description"
              required
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('registerCase.descriptionPlaceholder')}
            />
          </div>

          <div>
            <Label htmlFor="peopleAffected">{t('registerCase.peopleAffected')}</Label>
            <Input
              id="peopleAffected"
              type="number"
              min={0}
              required
              value={peopleAffected}
              onChange={(e) => setPeopleAffected(e.target.value)}
              placeholder={t('registerCase.peopleAffectedPlaceholder')}
            />
          </div>

          <div>
            <Label>{t('registerCase.trapped')}</Label>
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={t('registerCase.trapped')}>
              {TRAPPED_OPTIONS.map(({ value, labelKey }) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={trapped === value}
                  onClick={() => setTrapped(value)}
                  className={cn(
                    'rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors',
                    trapped === value
                      ? value === 'no'
                        ? 'border-success bg-success/15 text-success'
                        : 'border-accent bg-accent/15 text-accent'
                      : 'border-border bg-bg text-text-muted hover:border-text-muted',
                  )}
                >
                  {t(labelKey)}
                </button>
              ))}
            </div>
            {trapped !== 'no' && (
              <div className="mt-3">
                <Label htmlFor="trappedDetails">{t('registerCase.trappedDetails')}</Label>
                <Textarea
                  id="trappedDetails"
                  rows={2}
                  value={trappedDetails}
                  onChange={(e) => setTrappedDetails(e.target.value)}
                  placeholder={t('registerCase.trappedDetailsPlaceholder')}
                />
              </div>
            )}
          </div>

          <Button type="submit" className="mt-auto w-full py-3" disabled={createIncident.isPending}>
            {createIncident.isPending ? (
              t('common.sending')
            ) : (
              <>
                <Siren size={18} /> {t('registerCase.sendSos')}
              </>
            )}
          </Button>
        </form>

        {/* RIGHT — Location & visual assessment */}
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-border bg-bg/50 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin size={16} className="text-secondary" />
                <span className="text-sm font-semibold text-text">{t('registerCase.location')}</span>
              </div>
              <span className="font-mono text-xs text-text-faint">
                {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
              </span>
            </div>
            <Button
              type="button"
              variant="secondary"
              className="mb-3 w-full"
              onClick={useMyLocation}
              disabled={geoStatus === 'locating'}
            >
              <LocateFixed size={15} />
              {geoStatus === 'locating' ? t('registerCase.locating') : t('registerCase.shareLocation')}
            </Button>
            <PinDropMapClient
              lat={location.lat}
              lng={location.lng}
              onChange={(lat, lng) => {
                setLocation({ lat, lng })
                setGeoStatus('idle')
              }}
              heightClassName="h-[240px]"
            />
            {geoStatus === 'success' && (
              <p className="mt-1.5 text-xs font-medium text-success">{t('registerCase.locationCaptured')}</p>
            )}
            {geoStatus === 'error' && (
              <p className="mt-1.5 text-xs text-accent">{t('registerCase.locationError')}</p>
            )}
            {(geoStatus === 'idle' || geoStatus === 'locating') && (
              <p className="mt-1.5 text-xs text-text-faint">{t('registerCase.tapMapHint')}</p>
            )}
          </div>

          {/* Evidence Submission — upload photos/videos or stream live, all analyzed by AI */}
          <div className="flex flex-1 flex-col rounded-xl border border-border bg-bg/50 p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Camera size={16} className="text-secondary" />
                <span className="text-sm font-semibold text-text">{t('registerCase.evidence')}</span>
              </div>
              <div
                className="flex rounded-lg border border-border bg-bg p-0.5"
                role="tablist"
                aria-label={t('registerCase.evidence')}
              >
                {(['upload', 'stream'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    role="tab"
                    aria-selected={evidenceTab === tab}
                    onClick={() => setEvidenceTab(tab)}
                    className={cn(
                      'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors',
                      evidenceTab === tab
                        ? 'bg-accent text-accent-foreground'
                        : 'text-text-muted hover:text-text',
                    )}
                  >
                    {tab === 'upload' ? <UploadCloud size={13} /> : <Radio size={13} />}
                    {tab === 'upload' ? t('registerCase.tabUpload') : t('registerCase.tabStream')}
                  </button>
                ))}
              </div>
            </div>
            <p className="mb-3 text-[11px] leading-relaxed text-text-faint">{t('registerCase.evidenceHint')}</p>

            {evidenceTab === 'upload' ? (
              <label className="flex min-h-[180px] flex-1 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-black/30 px-4 py-8 text-center transition-colors hover:border-secondary/60">
                <UploadCloud size={24} className="text-text-faint" />
                <span className="text-xs font-semibold text-text-muted">{t('registerCase.uploadButton')}</span>
                <span className="max-w-xs text-[11px] leading-relaxed text-text-faint">
                  {t('registerCase.uploadHint')}
                </span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  className="hidden"
                  onChange={(e) => void handleFilesSelected(e.target.files)}
                />
              </label>
            ) : (
              <div className="flex flex-1 flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Radio
                      size={14}
                      className={liveShare.isSharing ? 'animate-pulse text-red-500' : 'text-text-muted'}
                    />
                    <span className="text-xs font-semibold text-text-muted">{t('registerCase.liveShare')}</span>
                  </div>
                  <Button
                    type="button"
                    variant={liveShare.isSharing ? 'secondary' : 'primary'}
                    onClick={liveShare.isSharing ? liveShare.stopSharing : liveShare.startSharing}
                    className="text-xs"
                  >
                    {liveShare.isSharing ? (
                      <>
                        <VideoOff size={14} /> {t('registerCase.stop')}
                      </>
                    ) : (
                      <>
                        <Video size={14} /> {t('registerCase.startCamera')}
                      </>
                    )}
                  </Button>
                </div>

                {liveShare.isSharing ? (
                  <>
                    <div className="relative min-h-[180px] flex-1 overflow-hidden rounded-lg bg-black">
                      <video
                        ref={liveShare.videoRef}
                        autoPlay
                        muted
                        playsInline
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                      {liveShare.isAnalyzing && (
                        <div className="absolute bottom-2 right-2 rounded-full bg-red-600 px-2 py-0.5 text-xs font-medium text-white">
                          {t('registerCase.analyzing')}
                        </div>
                      )}
                      <canvas ref={liveShare.canvasRef} className="hidden" />
                    </div>

                    <Button
                      type="button"
                      variant="secondary"
                      className="w-full text-xs"
                      onClick={liveShare.captureNow}
                    >
                      <Camera size={14} /> {t('registerCase.snapPhoto')}
                    </Button>
                  </>
                ) : (
                  <div className="flex min-h-[180px] flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-black/30 px-4 py-8 text-center">
                    <Video size={24} className="text-text-faint" />
                    <p className="text-xs font-semibold text-text-muted">{t('registerCase.cameraPreview')}</p>
                    <p className="max-w-xs text-[11px] leading-relaxed text-text-faint">
                      {t('registerCase.cameraPreviewHint')}
                    </p>
                  </div>
                )}

                <p className="text-[11px] leading-relaxed text-text-faint">{t('registerCase.streamNote')}</p>
              </div>
            )}

            {/* Live AI read-out of the most recent stream frame */}
            {evidenceTab === 'stream' && liveShare.latestAnalysis && (
              <div className={cn(
                'mt-3 rounded-lg border px-3 py-2 text-sm',
                liveShare.latestAnalysis.status === 'collapsed'
                  ? 'border-red-500/40 bg-red-500/10 text-red-400'
                  : 'border-green-500/40 bg-green-500/10 text-green-400',
              )}>
                <div className="flex items-center gap-2">
                  {liveShare.latestAnalysis.status === 'collapsed' && <AlertTriangle size={14} />}
                  <span className="font-semibold">
                    {t('registerCase.aiPrefix')}: {t(ANALYSIS_STATUS_LABEL[liveShare.latestAnalysis.status])}
                  </span>
                  <span className="text-xs opacity-70">
                    ({Math.round(liveShare.latestAnalysis.confidence * 100)}% {t('registerCase.confidence')})
                  </span>
                </div>
                {liveShare.latestAnalysis.disasterType && (
                  <p className="mt-1 text-xs">
                    {t('common.disaster')}: {formatDisasterType(liveShare.latestAnalysis.disasterType, t)}
                  </p>
                )}
                {liveShare.latestAnalysis.hazards.length > 0 && (
                  <p className="mt-1 text-xs">
                    {t('registerCase.hazards')}: {liveShare.latestAnalysis.hazards.join(', ')}
                  </p>
                )}
              </div>
            )}

            {liveShare.error && (
              <p className="mt-2 text-xs text-accent">{liveShare.error}</p>
            )}

            {/* What the victim submitted so far — proof each item was received and understood */}
            {evidenceItems.length > 0 && (
              <div className="mt-3 space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-text-faint">
                  {t('registerCase.submissions')}
                </p>
                <ul className="space-y-2">
                  {evidenceItems.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center gap-3 rounded-lg border border-border bg-bg px-2.5 py-2"
                    >
                      <div className="h-11 w-11 shrink-0 overflow-hidden rounded-md bg-black/40">
                        {item.state === 'done' && item.record?.thumbnailUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element -- backend-served evidence thumbnail
                          <img
                            src={evidenceMediaUrl(item.record.thumbnailUrl) ?? ''}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : item.state === 'uploading' ? (
                          <div className="flex h-full w-full items-center justify-center">
                            <Loader2 size={16} className="animate-spin text-text-faint" />
                          </div>
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <AlertTriangle size={16} className="text-accent" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-text">{item.name}</p>
                        <p className="truncate text-[11px] text-text-faint">
                          {item.state === 'uploading' && t('registerCase.uploading')}
                          {item.state === 'error' && (item.error ?? t('registerCase.evidenceFailed'))}
                          {item.state === 'done' && item.record?.analysis && (
                            <>
                              {formatDisasterType(item.record.analysis.disasterType, t)} ·{' '}
                              {formatVictimStatus(item.record.analysis.status, t)} ·{' '}
                              {Math.round(item.record.analysis.confidence * 100)}% —{' '}
                              {t('registerCase.evidenceReceived')}
                            </>
                          )}
                          {item.state === 'done' && !item.record?.analysis && t('registerCase.evidenceStored')}
                        </p>
                      </div>
                      {item.state === 'done' && item.record?.mediaType === 'video' && (
                        <FileVideo size={14} className="shrink-0 text-text-faint" />
                      )}
                      {item.state === 'done' && item.record?.analysis && (
                        <CheckCircle2 size={14} className="shrink-0 text-success" />
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {liveShare.evidenceIds.length > 0 && (
              <p className="mt-2 text-[11px] text-text-faint">
                {t('registerCase.streamSaved')} — {liveShare.evidenceIds.length}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Floating AI assistant — only available inside the Register Your Case module */}
      <ChatWidget context={chatContext} />
    </AuthShell>
  )
}
