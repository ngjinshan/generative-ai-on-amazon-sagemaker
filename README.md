# AR Door Visualizer

Upload photos of your door → get a 3D model → see it in AR placed on any door frame.

## Architecture

```
Customer uploads door photos (front/back)
        │
        ▼
┌──────────────┐     ┌───────────────┐     ┌─────────────────┐
│  Next.js on  │────▶│ API Gateway + │────▶│ SageMaker       │
│  Amplify     │     │ Lambda        │     │ (Image-to-3D)   │
└──────────────┘     └───────┬───────┘     └────────┬────────┘
                             │                      │
                     ┌───────▼───────┐      ┌───────▼────────┐
                     │  DynamoDB     │      │  S3 + CloudFr  │
                     │  (metadata)   │      │  (GLB assets)  │
                     └───────────────┘      └────────────────┘
```

## User Flow

1. Upload front (+ optional back) photo of their door
2. System removes background, reconstructs 3D mesh, exports as GLB
3. Customer opens AR view on mobile
4. Points camera at a door frame → door model appears anchored in place
5. *(Future)* Tap "Open Door" → door swings open, walk around to view from inside/outside

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | Next.js 14 (App Router) on AWS Amplify | Web app + AR viewer |
| AR | 8th Wall or WebXR | Camera-based AR with wall detection |
| 3D Viewer | `<model-viewer>` / Three.js | Render GLB models in AR |
| API | API Gateway + Lambda (Python) | Orchestration |
| 3D Generation | InstantMesh/TripoSR on SageMaker | Image-to-3D reconstruction |
| Storage | S3 (uploads + GLB), DynamoDB (metadata) | Persistence |
| CDN | CloudFront | Low-latency 3D asset delivery |

## Cost Estimation

### Per-Request Costs (single door generation)

| Service | Usage | Est. Cost |
|---------|-------|-----------|
| Lambda (upload + generate + status) | ~3 invocations, <512MB, <60s total | ~$0.001 |
| S3 (upload 2 images + store GLB) | ~10MB stored, PUT/GET | ~$0.0003 |
| SageMaker Real-Time Endpoint (ml.g5.xlarge) | ~30s inference per door | ~$0.04* |
| DynamoDB (on-demand) | 3 writes, 5 reads | ~$0.00001 |
| CloudFront (serve GLB) | ~5MB transfer | ~$0.001 |
| **Total per door generation** | | **~$0.04** |

*\*SageMaker dominates cost. The ml.g5.xlarge endpoint costs ~$1.41/hr when running.*

### Monthly Infrastructure Costs (always-on)

| Service | Configuration | Est. Monthly Cost |
|---------|--------------|-------------------|
| SageMaker Endpoint (ml.g5.xlarge) | 24/7 real-time | ~$1,015/mo |
| SageMaker Endpoint (ml.g5.xlarge) | Serverless/async (scale to 0) | $0 idle + $0.04/request |
| Amplify Hosting | Build + serve | ~$5-15/mo |
| CloudFront | 100GB transfer | ~$8.50/mo |
| S3 | 50GB stored | ~$1.15/mo |
| DynamoDB | On-demand, low traffic | ~$1-5/mo |
| API Gateway | 100K requests | ~$3.50/mo |

### Cost Optimization Strategies

- **Use SageMaker Async Inference** instead of real-time endpoints — scales to zero when idle, pay only per inference
- **Use Serverless Inference** for low/bursty traffic (cold start ~1-2min for GPU)
- **Pre-generate popular door styles** and cache GLBs to avoid repeated inference
- **Set S3 lifecycle policies** to expire unused uploads after 30 days

### Estimated Monthly Cost by Scale

| Scale | Doors/month | Est. Monthly Cost |
|-------|-------------|-------------------|
| Demo/POC | 50 | ~$20 (async, scale-to-zero) |
| Small (pilot) | 500 | ~$40 |
| Medium | 5,000 | ~$220 |
| Production (always-on endpoint) | 10,000+ | ~$1,050+ |

## Assumptions

1. **Door geometry is relatively flat** — single-image 3D reconstruction works well for doors because they're planar objects with limited depth variation (handle, panels). Complex ornate doors with deep carvings may produce lower quality meshes.

2. **Standard door dimensions** — we assume standard residential door sizes (2030mm × 820mm × 40mm) for AR scaling. Users can optionally specify custom dimensions.

3. **Single image is sufficient** — TripoSR/InstantMesh can produce a usable 3D mesh from one front-facing photo. A back photo improves texture on the reverse side but isn't required.

4. **Mobile device has AR capability** — Android devices with ARCore support, or iOS devices with ARKit. Fallback to 3D model viewer (non-AR) for unsupported devices.

5. **Well-lit, front-facing photo** — the image-to-3D model expects a clear, well-lit photo with the door as the primary subject. Poor lighting or extreme angles will degrade quality.

6. **Network connectivity** — GLB files are typically 2-10MB. Users need reasonable mobile data/WiFi to load the 3D model in the AR viewer.

7. **Processing time ~30-60 seconds** — users will wait for 3D generation. This is acceptable for a "generate once, view many times" flow.

## Limitations

### Current

- **No real-time generation** — 3D model generation takes 30-60 seconds; not instant
- **Texture quality varies** — reflective surfaces (glass panels, polished metal hardware) don't reconstruct well from single images
- **No door hardware separation** — handles, locks, and hinges are baked into the mesh, not separate interactive components
- **AR placement is semi-manual** — user taps to place the door; no automatic door frame detection
- **No occlusion** — the 3D door doesn't occlude real-world objects behind it (e.g., a person walking behind the door won't be hidden)
- **iOS AR limitations** — iOS Quick Look doesn't support wall placement natively; falls back to floor placement or 3D viewer only
- **Single door per session** — no side-by-side comparison of multiple doors in AR simultaneously

### Technical Constraints

- **SageMaker cold start** — if using serverless inference, first request after idle takes 1-2 minutes to spin up GPU
- **GLB file size** — high-poly meshes can be 10-20MB, impacting load time on mobile. We decimate to ~50K faces as a balance.
- **WebXR browser support** — full wall-anchoring AR only works on Chrome Android. Safari/iOS requires 8th Wall (paid) or falls back to Quick Look.

## Future Plans

### Phase 1: Core MVP (Current)
- Upload door photos → generate 3D model → view in AR on wall

### Phase 2: Interactive Door ("Open Door" Feature) 🚪
The door model becomes interactive in AR:

- **Open/Close animation** — user taps a button or gesture to swing the door open (animated hinge rotation)
- **Walk-around viewing** — once the door is open, user can physically walk around it in AR to see both the front and back faces
- **Inside/outside perspective** — step "through" the doorway to see what the door looks like from the other side
- **Adjustable swing angle** — slider or drag gesture to control how far the door opens (0° closed → 90° fully open)
- **Swing direction toggle** — left-hinge vs right-hinge opening

**Technical approach:**
- GLB model rigged with a hinge bone/pivot point at the door edge
- Three.js animation mixer triggers rotation on user input
- Back-face texture applied from the second uploaded photo (if provided)
- Physics-aware placement: door swing arc doesn't clip through detected walls

### Phase 3: Enhanced Realism
- **Automatic door frame detection** — CV model detects the door frame rectangle in camera feed, auto-places the 3D door without user tap
- **Lighting & shadow matching** — real-time environment lighting estimation for photorealistic integration
- **Occlusion support** — real-world objects in front of the door properly occlude the 3D model
- **Door hardware customization** — swap handles, locks, and hinges independently on the 3D model

### Phase 4: Catalog & Commerce
- **Door catalog** — pre-generated 3D models of popular door styles for instant AR preview (no upload/wait)
- **Measurement tool** — AR-based measurement of the existing door frame to recommend fitting doors
- **Side-by-side comparison** — place multiple door options in AR simultaneously
- **Purchase integration** — link to e-commerce for ordering the visualized door
- **Share AR view** — generate a shareable link/QR code so others can see the same door placement

## Getting Started

```bash
# Frontend
cd frontend && npm install && npm run dev

# Infrastructure
cd infra && npm install && npx cdk deploy

# Push to GitHub
git push origin main
```

## Project Structure

```
├── README.md
├── frontend/                # Next.js app (Amplify-hosted)
│   ├── src/app/
│   │   ├── page.tsx         # Upload flow + status tracking
│   │   └── ar/page.tsx      # AR viewer (model-viewer with wall placement)
│   └── src/components/
│       ├── UploadForm.tsx    # Presigned URL upload to S3
│       └── StatusTracker.tsx # Polls job status
├── lambda/
│   ├── upload/handler.py    # Generates presigned URLs, creates DynamoDB job
│   ├── generate/handler.py  # Calls SageMaker endpoint, stores GLB in S3
│   └── status/handler.py    # Returns job status + model URL
└── infra/
    └── lib/stack.ts         # CDK stack (S3, DynamoDB, Lambda, API GW, CloudFront)
```
