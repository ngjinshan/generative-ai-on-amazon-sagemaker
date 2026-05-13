'use client';
import { useRef, useState, useEffect, useCallback } from 'react';

interface DetectedDoor {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
}

declare global {
  interface Window {
    ObjectDetector: any;
    FilesetResolver: any;
  }
}

export default function DoorCamera({ onCapture }: { onCapture: (blob: Blob) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const detectorRef = useRef<any>(null);
  const animFrameRef = useRef<number>(0);
  const [streaming, setStreaming] = useState(false);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [detected, setDetected] = useState<DetectedDoor | null>(null);
  const [capturing, setCapturing] = useState(false);

  // Load MediaPipe Object Detection
  useEffect(() => {
    async function loadModel() {
      // Load MediaPipe vision WASM
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm/vision_bundle.mjs';
      script.type = 'module';

      // Use dynamic import for MediaPipe
      const vision = await import(
        /* webpackIgnore: true */
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest'
      );

      const { ObjectDetector, FilesetResolver } = vision;

      const fileset = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
      );

      detectorRef.current = await ObjectDetector.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/int8/latest/efficientdet_lite0.tflite',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        maxResults: 5,
        scoreThreshold: 0.3,
      });

      setModelLoaded(true);
    }
    loadModel().catch(console.error);
  }, []);

  // Start camera
  useEffect(() => {
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setStreaming(true);
        }
      } catch (err) {
        console.error('Camera access denied:', err);
      }
    }
    startCamera();
    return () => {
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      }
      cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  // Detection loop
  const detect = useCallback(() => {
    const video = videoRef.current;
    const overlay = overlayRef.current;
    const detector = detectorRef.current;

    if (!video || !overlay || !detector || video.readyState < 2) {
      animFrameRef.current = requestAnimationFrame(detect);
      return;
    }

    const octx = overlay.getContext('2d')!;
    overlay.width = overlay.clientWidth;
    overlay.height = overlay.clientHeight;
    octx.clearRect(0, 0, overlay.width, overlay.height);

    const scaleX = overlay.width / video.videoWidth;
    const scaleY = overlay.height / video.videoHeight;

    // Run detection
    const now = performance.now();
    const results = detector.detectForVideo(video, now);

    // Filter for door-like objects
    // EfficientDet-Lite0 (COCO) doesn't have "door" but has related classes
    // We look for: any tall vertical rectangle detection, or specific classes
    const doorLikeClasses = ['refrigerator', 'book', 'tv', 'cell phone', 'suitcase'];
    // Fallback: accept any detection that has door-like aspect ratio
    let bestDoor: DetectedDoor | null = null;
    let bestScore = 0;

    for (const det of results.detections) {
      const bbox = det.boundingBox;
      if (!bbox) continue;

      const aspect = bbox.height / bbox.width;
      const score = det.categories[0]?.score || 0;
      const category = det.categories[0]?.categoryName || '';

      // Accept if: door-like aspect ratio (1.5-3.5:1) AND reasonable size
      const isDoorShaped = aspect >= 1.5 && aspect <= 3.5;
      const isLargeEnough = bbox.height > video.videoHeight * 0.3;

      // Boost score for door-like classes
      const classBoost = doorLikeClasses.includes(category) ? 1.5 : 1.0;
      const finalScore = score * classBoost * (isDoorShaped ? 2 : 0.5) * (isLargeEnough ? 1.5 : 0.5);

      if (finalScore > bestScore && isDoorShaped && isLargeEnough) {
        bestScore = finalScore;
        bestDoor = {
          x: bbox.originX,
          y: bbox.originY,
          width: bbox.width,
          height: bbox.height,
          confidence: Math.min(1, score),
        };
      }
    }

    // If no ML detection, fall back to edge-based detection
    if (!bestDoor) {
      bestDoor = detectByEdges(video, canvasRef.current!);
    }

    if (bestDoor) {
      setDetected(bestDoor);
      octx.strokeStyle = '#00ff00';
      octx.lineWidth = 3;
      octx.strokeRect(
        bestDoor.x * scaleX, bestDoor.y * scaleY,
        bestDoor.width * scaleX, bestDoor.height * scaleY
      );
      // Corner dots
      const corners = [
        [bestDoor.x, bestDoor.y],
        [bestDoor.x + bestDoor.width, bestDoor.y],
        [bestDoor.x + bestDoor.width, bestDoor.y + bestDoor.height],
        [bestDoor.x, bestDoor.y + bestDoor.height],
      ];
      octx.fillStyle = '#00ff00';
      corners.forEach(([cx, cy]) => {
        octx.beginPath();
        octx.arc(cx * scaleX, cy * scaleY, 6, 0, Math.PI * 2);
        octx.fill();
      });
    } else {
      setDetected(null);
    }

    animFrameRef.current = requestAnimationFrame(detect);
  }, []);

  useEffect(() => {
    if (streaming && modelLoaded) {
      animFrameRef.current = requestAnimationFrame(detect);
    }
  }, [streaming, modelLoaded, detect]);

  // Capture
  const handleCapture = () => {
    if (!detected || !videoRef.current) return;
    setCapturing(true);

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(video, 0, 0);

    // Crop to detected region with padding
    const pad = 30;
    const x = Math.max(0, detected.x - pad);
    const y = Math.max(0, detected.y - pad);
    const w = Math.min(canvas.width - x, detected.width + pad * 2);
    const h = Math.min(canvas.height - y, detected.height + pad * 2);

    const crop = document.createElement('canvas');
    crop.width = w;
    crop.height = h;
    crop.getContext('2d')!.drawImage(canvas, x, y, w, h, 0, 0, w, h);

    crop.toBlob((blob) => {
      if (blob) onCapture(blob);
      setCapturing(false);
    }, 'image/jpeg', 0.92);
  };

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: 500, margin: '0 auto' }}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{ width: '100%', borderRadius: 12, display: 'block' }}
      />
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      <canvas
        ref={overlayRef}
        style={{
          position: 'absolute', top: 0, left: 0,
          width: '100%', height: '100%',
          pointerEvents: 'none', borderRadius: 12,
        }}
      />
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
            color: '#fff', border: 'none', borderRadius: 24,
            cursor: detected ? 'pointer' : 'default',
            marginTop: 8,
          }}
        >
          {capturing ? 'Capturing...' : '📸 Capture Door'}
        </button>
      </div>
    </div>
  );
}

/** Fallback: edge-based door detection when ML model doesn't find anything */
function detectByEdges(video: HTMLVideoElement, canvas: HTMLCanvasElement): DetectedDoor | null {
  const w = video.videoWidth;
  const h = video.videoHeight;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(video, 0, 0, w, h);

  // Downsample
  const scale = 8;
  const sw = Math.floor(w / scale);
  const sh = Math.floor(h / scale);
  const small = document.createElement('canvas');
  small.width = sw;
  small.height = sh;
  small.getContext('2d')!.drawImage(canvas, 0, 0, sw, sh);
  const frame = small.getContext('2d')!.getImageData(0, 0, sw, sh);

  // Grayscale + Sobel
  const gray = new Uint8Array(sw * sh);
  for (let i = 0; i < sw * sh; i++) {
    const si = i * 4;
    gray[i] = (frame.data[si] * 0.299 + frame.data[si + 1] * 0.587 + frame.data[si + 2] * 0.114) | 0;
  }

  // Column edge strength
  const colStr = new Float32Array(sw);
  for (let y = 1; y < sh - 1; y++) {
    for (let x = 1; x < sw - 1; x++) {
      const idx = y * sw + x;
      const gx = Math.abs(gray[idx + 1] - gray[idx - 1]);
      if (gx > 20) colStr[x]++;
    }
  }

  // Find two strong vertical edges with door-like spacing
  const minW = sw * 0.15, maxW = sw * 0.65;
  let best = 0, bx = 0, bw = 0;
  for (let l = 0; l < sw * 0.7; l++) {
    if (colStr[l] < sh * 0.25) continue;
    for (let r = l + minW; r < Math.min(l + maxW, sw); r++) {
      if (colStr[r] < sh * 0.25) continue;
      const s = colStr[l] + colStr[r];
      if (s > best) { best = s; bx = l; bw = r - l; }
    }
  }

  if (best === 0) return null;

  const aspect = (sh * 0.8) / bw;
  if (aspect < 1.5 || aspect > 3.5) return null;

  return {
    x: bx * scale,
    y: h * 0.05,
    width: bw * scale,
    height: h * 0.85,
    confidence: Math.min(1, best / (sh * 2)),
  };
}
