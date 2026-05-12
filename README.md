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

## Stack

- **Frontend**: Next.js 14 (App Router) hosted on AWS Amplify
- **AR**: 8th Wall (cross-platform) or WebXR (Android only)
- **API**: API Gateway + Lambda (Python)
- **3D Generation**: InstantMesh/TripoSR on SageMaker (ml.g5.xlarge)
- **Storage**: S3 (uploads + GLB assets), DynamoDB (job metadata)
- **CDN**: CloudFront for 3D asset delivery

## Getting Started

```bash
# Frontend
cd frontend && npm install && npm run dev

# Infrastructure
cd infra && npm install && npx cdk deploy
```
