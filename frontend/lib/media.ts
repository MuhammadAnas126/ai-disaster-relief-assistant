/**
 * Client-side media helpers for evidence submission.
 *
 * The backend's Qwen-VL analysis needs a still JPEG, so every submission
 * carries one: photos are downscaled to keep the analysis input small, and
 * videos get a poster frame grabbed just past the start of the clip. The same
 * JPEG doubles as the thumbnail admins see in the Live Share gallery.
 */

const MAX_FRAME_DIM = 1280
const FRAME_QUALITY = 0.8
const POSTER_SEEK_S = 0.5
const POSTER_TIMEOUT_MS = 5000

function canvasToJpeg(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) =>
    canvas.toBlob((blob) => resolve(blob), 'image/jpeg', FRAME_QUALITY),
  )
}

/** Draw a still source onto a downscaled canvas and encode it as a JPEG blob. */
async function toJpegFrame(source: ImageBitmap | HTMLVideoElement): Promise<Blob | null> {
  const width = source instanceof HTMLVideoElement ? source.videoWidth : source.width
  const height = source instanceof HTMLVideoElement ? source.videoHeight : source.height
  if (!width || !height) return null

  const scale = Math.min(1, MAX_FRAME_DIM / Math.max(width, height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(width * scale)
  canvas.height = Math.round(height * scale)

  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height)
  return canvasToJpeg(canvas)
}

/** Downscale a photo to a JPEG blob suitable for AI analysis and thumbnails. */
export async function downscaleImage(file: File): Promise<Blob | null> {
  try {
    const bitmap = await createImageBitmap(file)
    try {
      return await toJpegFrame(bitmap)
    } finally {
      bitmap.close()
    }
  } catch {
    return null
  }
}

/** Grab a poster frame from a video file, seeking slightly past the first frame. */
export function extractVideoPoster(file: File): Promise<Blob | null> {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    video.muted = true
    video.playsInline = true
    video.preload = 'auto'

    const objectUrl = URL.createObjectURL(file)
    let settled = false
    const finish = (blob: Blob | null) => {
      if (settled) return
      settled = true
      URL.revokeObjectURL(objectUrl)
      resolve(blob)
    }

    // Some browsers stall on exotic codecs — never hang the upload flow.
    const timeout = setTimeout(() => finish(null), POSTER_TIMEOUT_MS)

    video.onerror = () => {
      clearTimeout(timeout)
      finish(null)
    }
    video.onloadeddata = () => {
      try {
        video.currentTime = Math.min(POSTER_SEEK_S, (video.duration || 1) / 2)
      } catch {
        // Seeking unsupported — analyze whatever frame decoded first.
        clearTimeout(timeout)
        void toJpegFrame(video).then(finish)
      }
    }
    video.onseeked = () => {
      clearTimeout(timeout)
      void toJpegFrame(video).then(finish)
    }

    video.src = objectUrl
  })
}

/** Produce the analysis frame for a photo or video submission (null when extraction fails). */
export async function extractAnalysisFrame(file: File): Promise<Blob | null> {
  if (file.type.startsWith('video/')) return extractVideoPoster(file)
  if (file.type.startsWith('image/')) return downscaleImage(file)
  return null
}
