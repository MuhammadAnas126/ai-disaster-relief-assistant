'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  FileVideo,
  Images,
  Radio,
  UploadCloud,
  Video as VideoIcon,
  VideoOff,
  X,
} from 'lucide-react'
import { Card } from '../../../components/ui/Card'
import { Label, Select } from '../../../components/ui/Input'
import { Button } from '../../../components/ui/Button'
import { EmptyState, ErrorState, Skeleton } from '../../../components/ui/States'
import { useDeleteEvidence, useEvidenceGallery } from '../../../hooks/useEvidence'
import { evidenceMediaUrl } from '../../../lib/api'
import { useLanguage } from '../../../lib/i18n'
import { cn, timeAgo } from '../../../lib/utils'
import type { TranslationKey } from '../../../lib/dictionaries'
import type { EvidenceRecord } from '../../../types'

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

/** One gallery tile: thumbnail/preview plus its AI triage summary. */
function EvidenceTile({ record, onDelete }: { record: EvidenceRecord; onDelete?: () => void }) {
  const { t, language } = useLanguage()
  const media = evidenceMediaUrl(record.mediaUrl)
  const thumb = evidenceMediaUrl(record.thumbnailUrl ?? record.mediaUrl)
  const analysis = record.analysis
  const trapped = record.trapped === 'yes' || record.trapped === 'partial'

  return (
    <div className="relative block overflow-hidden rounded-xl border border-border bg-bg/50 transition-colors hover:border-secondary/60">
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          className="absolute right-1.5 top-1.5 z-10 rounded bg-black/70 p-1 text-white transition-colors hover:bg-red-600"
          aria-label={t('connect.deleteEvidence')}
          title={t('connect.deleteEvidence')}
        >
          <X size={12} />
        </button>
      )}
      <a
        href={media ?? undefined}
        target="_blank"
        rel="noopener noreferrer"
        title={t('connect.openMedia')}
        className="block"
      >
        <div className="relative aspect-video bg-black/40">
          {thumb ? (
            // eslint-disable-next-line @next/next/no-img-element -- evidence media is served by the backend's /media mount
            <img src={thumb} alt={record.id} className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Images size={20} className="text-text-faint" />
            </div>
          )}
          <span className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white">
            {record.source === 'stream' ? <Radio size={10} /> : <UploadCloud size={10} />}
            {record.source === 'stream' ? t('connect.sourceStream') : t('connect.sourceUpload')}
          </span>
          {record.mediaType === 'video' && (
            <span className="absolute inset-0 flex items-center justify-center">
              <FileVideo size={22} className="text-white/90 drop-shadow" />
            </span>
          )}
          {trapped && (
            <span className="absolute right-1.5 top-7 rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
              {t('connect.trappedFlag')}
            </span>
          )}
        </div>
        <div className="space-y-1 p-2.5">
          {analysis ? (
            <>
              <p className="text-xs font-semibold text-text">
                {formatDisasterType(analysis.disasterType, t)} · {formatVictimStatus(analysis.status, t)}
                <span className="ml-1 font-normal text-text-faint">
                  ({Math.round(analysis.confidence * 100)}%)
                </span>
              </p>
              {analysis.hazards.length > 0 && (
                <p className="truncate text-[11px] text-text-faint" title={analysis.hazards.join(', ')}>
                  {analysis.hazards.join(', ')}
                </p>
              )}
            </>
          ) : (
            <p className="text-[11px] text-text-faint">{t('connect.noAnalysis')}</p>
          )}
          <p className="text-[10px] text-text-faint">
            {timeAgo(record.receivedAt, language)}
            {record.caseId ? ` · ${t('connect.linkedCase')} ${record.caseId}` : ''}
          </p>
        </div>
      </a>
    </div>
  )
}

export default function ConnectPage() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const { t } = useLanguage()
  const [sharing, setSharing] = useState(false)
  const [shareWith, setShareWith] = useState('Dispatch team')
  const [error, setError] = useState<string | null>(null)

  const evidenceQuery = useEvidenceGallery()
  const evidence = useMemo(() => evidenceQuery.data ?? [], [evidenceQuery.data])
  const deleteEvidence = useDeleteEvidence()

  const stats = useMemo(
    () => ({
      uploads: evidence.filter((e) => e.source === 'upload').length,
      streams: evidence.filter((e) => e.source === 'stream').length,
      trapped: evidence.filter((e) => e.trapped === 'yes' || e.trapped === 'partial').length,
    }),
    [evidence],
  )

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop())
    }
  }, [])

  async function startSharing() {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream
      setSharing(true)
    } catch {
      setError(t('connect.cameraError'))
    }
  }

  function stopSharing() {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setSharing(false)
  }

  return (
    <div className="grid grid-cols-1 gap-6">
      {/* Incoming evidence — every victim photo, video, and live-stream frame */}
      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-text">{t('connect.evidenceTitle')}</h2>
            <p className="mt-0.5 text-xs text-text-faint">{t('connect.evidenceHint')}</p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-lg border border-border bg-bg px-2.5 py-1 font-medium text-text-muted">
              {evidence.length} {t('connect.statTotal')}
            </span>
            <span className="rounded-lg border border-border bg-bg px-2.5 py-1 font-medium text-text-muted">
              {stats.uploads} {t('connect.statUploads')}
            </span>
            <span className="rounded-lg border border-border bg-bg px-2.5 py-1 font-medium text-text-muted">
              {stats.streams} {t('connect.statStreams')}
            </span>
            {stats.trapped > 0 && (
              <span className="rounded-lg border border-red-500/40 bg-red-500/10 px-2.5 py-1 font-semibold text-red-400">
                {stats.trapped} {t('connect.statTrapped')}
              </span>
            )}
          </div>
        </div>

        {evidenceQuery.isLoading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="aspect-video w-full" />
            ))}
          </div>
        ) : evidenceQuery.isError ? (
          <ErrorState />
        ) : evidence.length === 0 ? (
          <EmptyState message={t('connect.evidenceEmpty')} hint={t('connect.evidenceEmptyHint')} />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {evidence.map((record) => (
              <EvidenceTile
                key={record.id}
                record={record}
                onDelete={() => deleteEvidence.mutate(record.id)}
              />
            ))}
          </div>
        )}
      </Card>

      {/* Your own camera share with a dispatch team */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card className={cn('relative flex min-h-[320px] items-center justify-center overflow-hidden p-0')}>
          <span className="absolute left-4 top-4 rounded-lg bg-bg/80 px-2.5 py-1 text-xs font-medium text-text-muted">
            {t('connect.preview')}
          </span>
          {sharing ? (
            <video ref={videoRef} autoPlay muted playsInline className="h-full w-full object-cover" />
          ) : (
            <VideoOff size={40} className="text-text-faint" />
          )}
        </Card>

        <Card>
          <div>
            <Label htmlFor="shareWith">{t('connect.shareWith')}</Label>
            <Select id="shareWith" value={shareWith} onChange={(e) => setShareWith(e.target.value)}>
              <option>{t('connect.dispatchTeam')}</option>
              <option>{t('connect.medicalHub')}</option>
              <option>{t('connect.fieldCoordinator')}</option>
            </Select>
          </div>

          {error && (
            <div className="mt-4 rounded-xl border border-accent/30 bg-accent/10 px-3.5 py-3 text-sm text-accent">
              {error}
            </div>
          )}

          <Button
            className="mt-4 w-full"
            onClick={sharing ? stopSharing : startSharing}
            variant={sharing ? 'secondary' : 'primary'}
          >
            <VideoIcon size={16} />
            {sharing ? t('connect.stopSharing') : t('connect.startSharing')}
          </Button>

          <p className="mt-3 text-xs text-text-faint">{t('connect.privacy')}</p>
        </Card>
      </div>
    </div>
  )
}
