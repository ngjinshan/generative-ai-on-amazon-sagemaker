import { useRef, useState, useEffect, useCallback } from 'react'
import * as ort from 'onnxruntime-web'

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
  const sessionRef = useRef<ort.InferenceSession | null>(null)
  const animFrameRef = useRef<number>(0)
  const [streaming, setStreaming] = useState(false)
  const [modelLoaded, setModelLoaded] = useState(false)
  const [detected, setDetected] = useState<DetectedDoor | null>(null)
  const [capturing, setCapturing] = useState(false)

  // Load ONNX model
  useEffect(() => {
    async function loadModel() {
      ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.26.0/dist/'
      const session = await ort.InferenceSession.create('/doors.onnx', {
        executionProviders: ['wasm'],
      })
      sessionRef.current = session
      setModelLoaded(true)
      console.log('ONNX door model loaded')
    }
    loadModel().catch((err) => console.error('Model load failed:', err))
  }, [])

  // Start camera
  useEffect(() => {
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
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
  const detect = useCallback(async () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    const overlay = overlayRef.current
    const session = sessionRef.current

    if (!video || !canvas || !overlay || !session || video.readyState < 2) {
      animFrameRef.current = requestAnimationFrame(detect)
      return
    }

    // Prepare input: resize to 640x640
    const inputSize = 640
    canvas.width = inputSize
    canvas.height = inputSize
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(video, 0, 0, inputSize, inputSize)
    const imageData = ctx.getImageData(0, 0, inputSize, inputSize)

    // Convert to float32 tensor [1, 3, 640, 640] normalized to 0-1
    const input = new Float32Array(3 * inputSize * inputSize)
    for (let i = 0; i < inputSize * inputSize; i++) {
      input[i] = imageData.data[i * 4] / 255.0                     // R
      input[inputSize * inputSize + i] = imageData.data[i * 4 + 1] / 255.0  // G
      input[2 * inputSize * inputSize + i] = imageData.data[i * 4 + 2] / 255.0  // B
    }

    const tensor = new ort.Tensor('float32', input, [1, 3, inputSize, inputSize])

    try {
      const results = await session.run({ images: tensor })
      const output = results[Object.keys(results)[0]]
      const data = output.data as Float32Array
      const dims = output.dims // [1, N, 6] or [1, 25200, 6]

      // Parse YOLOv5 output: each detection is [cx, cy, w, h, conf, class_conf]
      const numDetections = dims[1]
      const videoW = video.videoWidth
      const videoH = video.videoHeight
      let bestDoor: DetectedDoor | null = null
      let bestConf = 0.4 // minimum threshold

      for (let i = 0; i < numDetections; i++) {
        const offset = i * dims[2]
        const conf = data[offset + 4]
        if (conf < bestConf) continue

        const cx = data[offset] / inputSize * videoW
        const cy = data[offset + 1] / inputSize * videoH
        const w = data[offset + 2] / inputSize * videoW
        const h = data[offset + 3] / inputSize * videoH

        // Door-like aspect ratio check
        const aspect = h / w
        if (aspect < 1.3 || aspect > 4.0) continue

        if (conf > bestConf) {
          bestConf = conf
          bestDoor = {
            x: cx - w / 2,
            y: cy - h / 2,
            width: w,
            height: h,
            confidence: conf,
          }
        }
      }

      // Draw overlay
      overlay.width = overlay.clientWidth
      overlay.height = overlay.clientHeight
      const octx = overlay.getContext('2d')!
      octx.clearRect(0, 0, overlay.width, overlay.height)

      if (bestDoor) {
        setDetected(bestDoor)
        const scaleX = overlay.width / videoW
        const scaleY = overlay.height / videoH
        octx.strokeStyle = '#00ff00'
        octx.lineWidth = 3
        octx.strokeRect(bestDoor.x * scaleX, bestDoor.y * scaleY, bestDoor.width * scaleX, bestDoor.height * scaleY)
        // Corner dots
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
    } catch (err) {
      console.error('Inference error:', err)
    }

    animFrameRef.current = requestAnimationFrame(detect)
  }, [])

  useEffect(() => {
    if (streaming && modelLoaded) {
      animFrameRef.current = requestAnimationFrame(detect)
    }
  }, [streaming, modelLoaded, detect])

  // Capture: crop to detected door bbox
  const handleCapture = () => {
    if (!detected || !videoRef.current) return
    setCapturing(true)

    const video = videoRef.current
    const fullCanvas = document.createElement('canvas')
    fullCanvas.width = video.videoWidth
    fullCanvas.height = video.videoHeight
    fullCanvas.getContext('2d')!.drawImage(video, 0, 0)

    // Crop to detected door with small padding
    const pad = 15
    const x = Math.max(0, Math.round(detected.x - pad))
    const y = Math.max(0, Math.round(detected.y - pad))
    const w = Math.min(fullCanvas.width - x, Math.round(detected.width + pad * 2))
    const h = Math.min(fullCanvas.height - y, Math.round(detected.height + pad * 2))

    const crop = document.createElement('canvas')
    crop.width = w
    crop.height = h
    crop.getContext('2d')!.drawImage(fullCanvas, x, y, w, h, 0, 0, w, h)

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
        {!modelLoaded && <p style={{ color: '#888' }}>Loading door detection model...</p>}
        {modelLoaded && (
          <p style={{ color: detected ? '#00cc00' : '#999', fontWeight: 600 }}>
            {detected ? `Door detected (${Math.round(detected.confidence * 100)}%)` : 'Point camera at a door...'}
          </p>
        )}
        <button
          onClick={handleCapture}
          disabled={!detected || capturing}
          className="btn btn-primary btn-large"
          style={{ marginTop: 8, opacity: detected ? 1 : 0.4 }}
        >
          {capturing ? 'Capturing...' : '📸 Capture Door'}
        </button>
      </div>
    </div>
  )
}
