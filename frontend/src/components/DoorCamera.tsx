import { useRef, useState, useEffect, useCallback } from 'react'

interface DetectedDoor {
  x: number
  y: number
  width: number
  height: number
  confidence: number
}

export default function DoorCamera({ onCapture }: { onCapture: (blob: Blob) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const detectorRef = useRef<any>(null)
  const animFrameRef = useRef<number>(0)
  const [streaming, setStreaming] = useState(false)
  const [modelLoaded, setModelLoaded] = useState(false)
  const [detected, setDetected] = useState<DetectedDoor | null>(null)
  const [capturing, setCapturing] = useState(false)

  // Load MediaPipe via npm package
  useEffect(() => {
    async function loadModel() {
      const { ObjectDetector, FilesetResolver } = await import('@mediapipe/tasks-vision')

      const fileset = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
      )

      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)

      detectorRef.current = await ObjectDetector.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/int8/latest/efficientdet_lite0.tflite',
          delegate: isIOS ? 'CPU' : 'GPU',
        },
        runningMode: 'VIDEO',
        maxResults: 5,
        scoreThreshold: 0.3,
      })
      setModelLoaded(true)
      console.log('MediaPipe model loaded')
    }
    loadModel().catch((err) => console.error('MediaPipe load failed:', err))
  }, [])

  // Start camera
  useEffect(() => {
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
        })
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          setStreaming(true)
        }
      } catch (err) {
        console.error('Camera access denied:', err)
      }
    }
    startCamera()
    return () => {
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop())
      }
      cancelAnimationFrame(animFrameRef.current)
    }
  }, [])

  // Detection loop
  const detect = useCallback(() => {
    const video = videoRef.current
    const overlay = overlayRef.current
    const detector = detectorRef.current

    if (!video || !overlay || !detector || video.readyState < 2) {
      animFrameRef.current = requestAnimationFrame(detect)
      return
    }

    const octx = overlay.getContext('2d')!
    overlay.width = overlay.clientWidth
    overlay.height = overlay.clientHeight
    octx.clearRect(0, 0, overlay.width, overlay.height)

    const scaleX = overlay.width / video.videoWidth
    const scaleY = overlay.height / video.videoHeight

    // Run detection
    const results = detector.detectForVideo(video, performance.now())

    let bestDoor: DetectedDoor | null = null
    let bestScore = 0

    for (const det of results.detections) {
      const bbox = det.boundingBox
      if (!bbox) continue

      const aspect = bbox.height / bbox.width
      const score = det.categories[0]?.score || 0

      // Door-like: tall rectangle, large enough
      const isDoorShaped = aspect >= 1.5 && aspect <= 3.5
      const isLargeEnough = bbox.height > video.videoHeight * 0.3
      const finalScore = score * (isDoorShaped ? 2 : 0.3) * (isLargeEnough ? 1.5 : 0.5)

      if (finalScore > bestScore && isDoorShaped && isLargeEnough) {
        bestScore = finalScore
        bestDoor = {
          x: bbox.originX,
          y: bbox.originY,
          width: bbox.width,
          height: bbox.height,
          confidence: Math.min(1, score),
        }
      }
    }

    // Fallback: edge detection
    if (!bestDoor) {
      bestDoor = detectByEdges(video, canvasRef.current!)
    }

    if (bestDoor) {
      setDetected(bestDoor)
      octx.strokeStyle = '#00ff00'
      octx.lineWidth = 3
      octx.strokeRect(bestDoor.x * scaleX, bestDoor.y * scaleY, bestDoor.width * scaleX, bestDoor.height * scaleY)
      const corners = [
        [bestDoor.x, bestDoor.y],
        [bestDoor.x + bestDoor.width, bestDoor.y],
        [bestDoor.x + bestDoor.width, bestDoor.y + bestDoor.height],
        [bestDoor.x, bestDoor.y + bestDoor.height],
      ]
      octx.fillStyle = '#00ff00'
      corners.forEach(([cx, cy]) => {
        octx.beginPath()
        octx.arc(cx * scaleX, cy * scaleY, 6, 0, Math.PI * 2)
        octx.fill()
      })
    } else {
      setDetected(null)
    }

    animFrameRef.current = requestAnimationFrame(detect)
  }, [])

  useEffect(() => {
    if (streaming && modelLoaded) {
      animFrameRef.current = requestAnimationFrame(detect)
    }
  }, [streaming, modelLoaded, detect])

  // Capture
  const handleCapture = () => {
    if (!detected || !videoRef.current) return
    setCapturing(true)

    const video = videoRef.current
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')!.drawImage(video, 0, 0)

    const pad = 30
    const x = Math.max(0, detected.x - pad)
    const y = Math.max(0, detected.y - pad)
    const w = Math.min(canvas.width - x, detected.width + pad * 2)
    const h = Math.min(canvas.height - y, detected.height + pad * 2)

    const crop = document.createElement('canvas')
    crop.width = w
    crop.height = h
    crop.getContext('2d')!.drawImage(canvas, x, y, w, h, 0, 0, w, h)

    crop.toBlob((blob) => {
      if (blob) onCapture(blob)
      setCapturing(false)
    }, 'image/jpeg', 0.92)
  }

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', borderRadius: 12, display: 'block' }} />
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      <canvas ref={overlayRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', borderRadius: 12 }} />
      <div style={{ textAlign: 'center', marginTop: 16 }}>
        {!modelLoaded && <p style={{ color: '#666' }}>Loading detection model...</p>}
        {modelLoaded && (
          <p style={{ color: detected ? '#00cc00' : '#999', fontWeight: 600 }}>
            {detected ? `Door detected (${Math.round(detected.confidence * 100)}%)` : 'Point camera at a door...'}
          </p>
        )}
        <button
          onClick={handleCapture}
          disabled={!detected || capturing}
          style={{
            padding: '14px 40px', fontSize: 16, fontWeight: 700,
            background: detected ? '#00cc00' : '#ddd',
            color: '#fff', border: 'none', borderRadius: 24, cursor: detected ? 'pointer' : 'default',
          }}
        >
          {capturing ? 'Capturing...' : '📸 Capture Door'}
        </button>
      </div>
    </div>
  )
}

function detectByEdges(video: HTMLVideoElement, canvas: HTMLCanvasElement): DetectedDoor | null {
  const w = video.videoWidth
  const h = video.videoHeight
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(video, 0, 0, w, h)

  const scale = 8
  const sw = Math.floor(w / scale)
  const sh = Math.floor(h / scale)
  const small = document.createElement('canvas')
  small.width = sw
  small.height = sh
  small.getContext('2d')!.drawImage(canvas, 0, 0, sw, sh)
  const frame = small.getContext('2d')!.getImageData(0, 0, sw, sh)

  const gray = new Uint8Array(sw * sh)
  for (let i = 0; i < sw * sh; i++) {
    const si = i * 4
    gray[i] = (frame.data[si] * 0.299 + frame.data[si + 1] * 0.587 + frame.data[si + 2] * 0.114) | 0
  }

  const colStr = new Float32Array(sw)
  for (let y = 1; y < sh - 1; y++) {
    for (let x = 1; x < sw - 1; x++) {
      const gx = Math.abs(gray[y * sw + x + 1] - gray[y * sw + x - 1])
      if (gx > 20) colStr[x]++
    }
  }

  const minW = sw * 0.15, maxW = sw * 0.65
  let best = 0, bx = 0, bw = 0
  for (let l = 0; l < sw * 0.7; l++) {
    if (colStr[l] < sh * 0.25) continue
    for (let r = l + minW; r < Math.min(l + maxW, sw); r++) {
      if (colStr[r] < sh * 0.25) continue
      const s = colStr[l] + colStr[r]
      if (s > best) { best = s; bx = l; bw = r - l }
    }
  }

  if (best === 0) return null
  const aspect = (sh * 0.8) / bw
  if (aspect < 1.5 || aspect > 3.5) return null

  return { x: bx * scale, y: h * 0.05, width: bw * scale, height: h * 0.85, confidence: Math.min(1, best / (sh * 2)) }
}
