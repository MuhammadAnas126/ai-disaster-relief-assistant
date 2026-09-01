'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { LIVE_STREAM_WS_URL } from '../lib/api'
import { useLanguage } from '../lib/i18n'
import type { LiveAnalysis } from '../types'

const FRAME_INTERVAL_MS = 3000 // Send a frame every 3 seconds

/** Victim details attached to every streamed frame so archived evidence stays queryable. */
export interface LiveShareMetadata {
  caseId?: string | null
  location?: { lat: number; lng: number; label?: string } | null
  trapped?: string
  peopleAffected?: number
}

export function useLiveShare(metadata?: LiveShareMetadata) {
  const { t } = useLanguage()
  const [isSharing, setIsSharing] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [latestAnalysis, setLatestAnalysis] = useState<LiveAnalysis | null>(null)
  const [error, setError] = useState<string | null>(null)
  /** Gallery ids of the frames the server archived from this stream. */
  const [evidenceIds, setEvidenceIds] = useState<string[]>([])

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const metadataRef = useRef<LiveShareMetadata>({})

  // Keep the latest victim details available to the frame sender without
  // reconnecting the stream whenever they change.
  useEffect(() => {
    metadataRef.current = metadata ?? {}
  }, [metadata])

  const captureAndSend = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    const ws = wsRef.current

    if (!video || !canvas || !ws || ws.readyState !== WebSocket.OPEN) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 480
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    canvas.toBlob(
      (blob) => {
        if (!blob || !ws || ws.readyState !== WebSocket.OPEN) return
        const reader = new FileReader()
        reader.onload = () => {
          if (!ws || ws.readyState !== WebSocket.OPEN) return
          setIsAnalyzing(true)
          // JSON payload (not raw binary) so the server can archive each frame
          // into the evidence gallery together with the victim's trapped
          // status and location.
          ws.send(
            JSON.stringify({
              image: String(reader.result).split(',')[1],
              metadata: metadataRef.current,
            }),
          )
        }
        reader.readAsDataURL(blob)
      },
      'image/jpeg',
      0.7,
    )
  }, [])

  const startSharing = useCallback(async () => {
    setError(null)
    setLatestAnalysis(null)
    setEvidenceIds([])

    try {
      // Get camera access
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }

      // Connect WebSocket
      const ws = new WebSocket(LIVE_STREAM_WS_URL)
      wsRef.current = ws

      ws.onopen = () => {
        setIsSharing(true)
        // Start sending frames periodically
        intervalRef.current = setInterval(captureAndSend, FRAME_INTERVAL_MS)
      }

      ws.onmessage = (event) => {
        setIsAnalyzing(false)
        try {
          const result = JSON.parse(event.data)
          if (result.success && result.data) {
            // The server archives stream frames (throttled) into the evidence
            // gallery — remember the ids so the case can link to them.
            const evidenceId =
              typeof result.evidence_id === 'string' ? result.evidence_id : undefined
            if (evidenceId) {
              setEvidenceIds((ids) => (ids.includes(evidenceId) ? ids : [...ids, evidenceId]))
            }
            setLatestAnalysis({
              status: result.data.status ?? 'standing',
              confidence: result.data.confidence ?? 0,
              hazards: result.data.hazards ?? [],
              timestamp: new Date().toISOString(),
              disasterType: result.data.disaster_type,
              evidenceId,
            })
          }
        } catch {
          // Ignore parse errors from non-JSON messages
        }
      }

      ws.onerror = () => {
        setError(t('liveShare.connectionError'))
        setIsAnalyzing(false)
      }

      ws.onclose = () => {
        setIsAnalyzing(false)
      }
    } catch {
      setError(t('liveShare.cameraError'))
    }
  }, [captureAndSend, t])

  const stopSharing = useCallback(() => {
    // Stop interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    // Stop camera
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }

    // Close WebSocket
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }

    setIsSharing(false)
    setIsAnalyzing(false)
  }, [])

  // Attach the camera stream once the <video> element mounts — it only renders
  // while sharing, so it isn't in the DOM yet when startSharing() grabs the stream.
  useEffect(() => {
    if (isSharing && streamRef.current && videoRef.current && !videoRef.current.srcObject) {
      videoRef.current.srcObject = streamRef.current
    }
  }, [isSharing])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      streamRef.current?.getTracks().forEach((track) => track.stop())
      if (wsRef.current) wsRef.current.close()
    }
  }, [])

  return {
    videoRef,
    canvasRef,
    isSharing,
    isAnalyzing,
    latestAnalysis,
    evidenceIds,
    error,
    startSharing,
    stopSharing,
    // Manually snap the current frame for immediate AI analysis
    captureNow: captureAndSend,
  }
}
