'use client'

import { useEffect, useRef, useState } from 'react'
import { VideoOff, Video as VideoIcon } from 'lucide-react'
import { Card } from '../../../components/ui/Card'
import { Label, Select } from '../../../components/ui/Input'
import { Button } from '../../../components/ui/Button'

export default function ConnectPage() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [sharing, setSharing] = useState(false)
  const [shareWith, setShareWith] = useState('Dispatch team')
  const [error, setError] = useState<string | null>(null)

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
      setError("Couldn't access your camera or microphone. Check your browser permissions and try again.")
    }
  }

  function stopSharing() {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setSharing(false)
  }

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <Card className="relative flex min-h-[320px] items-center justify-center overflow-hidden p-0">
        <span className="absolute left-4 top-4 rounded-lg bg-bg/80 px-2.5 py-1 text-xs font-medium text-text-muted">
          Preview
        </span>
        {sharing ? (
          <video ref={videoRef} autoPlay muted playsInline className="h-full w-full object-cover" />
        ) : (
          <VideoOff size={40} className="text-text-faint" />
        )}
      </Card>

      <Card>
        <div>
          <Label htmlFor="shareWith">Share with</Label>
          <Select id="shareWith" value={shareWith} onChange={(e) => setShareWith(e.target.value)}>
            <option>Dispatch team</option>
            <option>Medical hub</option>
            <option>Field coordinator</option>
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
          {sharing ? 'Stop sharing' : 'Start sharing'}
        </Button>

        <p className="mt-3 text-xs text-text-faint">
          You control when sharing starts and stops. It never turns on by itself.
        </p>
      </Card>
    </div>
  )
}
