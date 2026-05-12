# AR Door Visualizer — Implementation Plan

## Current State

We have a **scaffold/skeleton** — UI code, Lambda handlers, CDK infra definitions, and documentation. Nothing is deployed or runnable yet.

### What exists:
- `frontend/` — Next.js app with upload form, status polling, AR viewer page
- `lambda/` — Python handlers for upload (presigned URLs), generate (calls SageMaker), status (polls DynamoDB)
- `infra/` — CDK stack defining S3, DynamoDB, API Gateway, Lambda, CloudFront
- `README.md` — Full docs with costs, assumptions, limitations, future plans

### What does NOT exist yet:
- No dependencies installed (`npm install` not run)
- No AWS resources deployed
- No SageMaker model endpoint
- No sample door GLB for testing
- No Next.js API routes for local development

---

## Development & Testing Plan

### Strategy: Build locally with mocks → Deploy on AWS → Test on phone

We build and iterate locally (desktop browser, no AR), then deploy to AWS for real phone/AR testing. AWS Amplify gives us free HTTPS automatically — required for camera/AR access on mobile.

---

### Step 1: Local Development with Mocks (no AWS, no phone needed)

**Goal:** Get the full UI flow working on desktop with fake data.

**What to do:**
1. Add Next.js API routes that mock the Lambda behavior (no AWS needed)
2. Place a sample door GLB in `frontend/public/sample-door.glb`
3. Run `npm run dev`, test upload → status → 3D viewer on desktop Chrome
4. The 3D model viewer (rotate/zoom) works on desktop; AR button won't work without phone

**Implementation:**
- Create `frontend/src/app/api/upload/route.ts` — mock, returns fake job ID
- Create `frontend/src/app/api/generate/route.ts` — mock, sets status to COMPLETE after 3s delay
- Create `frontend/src/app/api/status/[jobId]/route.ts` — mock, returns sample GLB URL
- Place a sample door GLB in `frontend/public/sample-door.glb` (grab from Sketchfab)

**What this proves:** UI flow works, model-viewer renders the GLB, everything wires up correctly.

---

### Step 2: Test 3D Generation Quality on SageMaker (~$2-5)

**Goal:** Verify that TripoSR/InstantMesh produces acceptable 3D door meshes from a single photo.

**What to do:**
1. Open a SageMaker Notebook instance (ml.g5.xlarge, ~$1.41/hr)
2. Run TripoSR with a door photo as input
3. Download the output mesh, open in a 3D viewer (e.g., https://gltf-viewer.donmccurdy.com/)
4. Evaluate: Is the geometry clean? Is the texture recognizable? Are panels/glass visible?
5. **Stop the notebook when done** to avoid ongoing charges

**What this proves:** The ML model can produce usable door meshes on SageMaker infrastructure. If quality is bad, we try a different model.

**SageMaker Notebook test:**
```python
# In a SageMaker Notebook (ml.g5.xlarge kernel)
!pip install torch torchvision torchaudio
!git clone https://github.com/VAST-AI-Research/TripoSR.git
%cd TripoSR
!pip install -r requirements.txt

# Run inference on your door photo
!python run.py your_door_photo.png --output-dir output/ --model-save-format glb

# Download output/0/mesh.glb and inspect in 3D viewer
```

**If TripoSR quality is insufficient, try (in order):**
1. InstantMesh (better geometry, slower) — also deployable on SageMaker
2. Wonder3D (better textures)
3. Meshy API (3rd party, high quality, $0.10-0.50/generation — fallback only)

**Cost:** ~$2-5 total (1-3 hours of notebook time, stop when done)

---

### Step 3: Deploy to AWS & Test on Phone (HTTPS for free)

**Goal:** Get the app on a real HTTPS URL so you can test AR on your phone.

**Option A: Amplify Console (easiest, ~5-10 min)**
1. Go to [AWS Amplify Console](https://console.aws.amazon.com/amplify)
2. "New app" → "Host web app" → connect GitHub repo
3. Set build settings:
   - Base directory: `frontend`
   - Build command: `npm run build`
   - Output directory: `.next`
4. Deploy → get `https://main.d1234abcdef.amplifyapp.com`
5. Open on phone → test AR wall placement

**Option B: CDK full stack deploy (~30 min)**
```bash
cd infra
npm install
npx cdk bootstrap --region us-east-1   # first time only
npx cdk deploy
```
Outputs: HTTPS API Gateway URL, S3 buckets, CloudFront domain.
Then set `NEXT_PUBLIC_API_URL` in Amplify environment variables and redeploy.

**What this proves:** AR works on a real phone — camera access, wall detection, door placement all functional over HTTPS.

**Note:** At this stage, you can still use the mock API routes (no SageMaker needed). Just deploy the frontend with mocks to test AR. Swap to real backend later.

---

### Step 4: Deploy SageMaker Endpoint (1-2 hours)

**Goal:** Get the image-to-3D model running as a callable endpoint.

**What to do:**
1. Package TripoSR (or chosen model) into a SageMaker-compatible container
2. Create a `model.tar.gz` with model weights + inference script
3. Deploy as a SageMaker real-time or async endpoint
4. Update the `SAGEMAKER_ENDPOINT` env var in the CDK stack
5. Redeploy CDK

**Key decisions:**
- **Real-time endpoint** (~$1.41/hr always-on) vs **Async inference** (scale to zero, 1-2 min cold start)
- For demo/POC: use async or just keep endpoint running during demo hours
- For production: async with provisioned concurrency

---

### Step 5: End-to-End Test

**Goal:** Full flow works — upload photo → get 3D model → view in AR.

**What to do:**
1. Open the deployed Amplify app on your phone
2. Upload a door photo (front-facing, well-lit)
3. Wait 30-60s for processing
4. Tap "View in AR"
5. Point at a wall → your door appears

---

## Local vs AWS Testing Reference

| What you're testing | Where to test | HTTPS needed? |
|--------------------|--------------|----|
| UI flow (upload, status, viewer) | Local desktop (`npm run dev`) | No |
| 3D model rendering (rotate/zoom) | Local desktop | No |
| AR wall placement | Phone via Amplify (or ngrok/cloudflared tunnel) | **Yes** |
| Camera access | Phone via HTTPS | **Yes** |
| Full pipeline with SageMaker | AWS (Amplify + API GW + SageMaker) | Yes |

**Quick HTTPS for local testing (alternative to deploying):**
```bash
# Free, no account, instant HTTPS tunnel to your local dev server
brew install cloudflared
cloudflared tunnel --url http://localhost:3000
# Gives: https://random-words.trycloudflare.com → open on phone
```

---

## Key Architecture Decisions Still Needed

| Decision | Options | Recommendation |
|----------|---------|----------------|
| AR framework | WebXR (free, Android only) vs 8th Wall (paid, cross-platform) | Start with `<model-viewer>` (free, covers Android + iOS Quick Look). Add 8th Wall later if iOS wall-placement is critical. |
| Image-to-3D model | TripoSR vs InstantMesh vs Meshy API | Test TripoSR first (free, fast). Fall back to Meshy API if quality is insufficient. |
| SageMaker deployment type | Real-time vs Async vs Serverless | Async for POC (scale to zero). Real-time for demo day (no cold start). |
| Background removal | Pre-process before 3D generation? | Yes — use `rembg` (Python library) in the Lambda or as a SageMaker pre-processing step. Clean background significantly improves 3D output quality. |
| Door dimensions | Hardcoded standard vs user input | Hardcode standard (820×2030mm) for MVP. Add dimension picker in Phase 2. |

---

## Component Responsibilities (Clarification)

| Component | Responsibility | Does NOT do |
|-----------|---------------|-------------|
| **SageMaker** | Converts 2D door photo → 3D GLB mesh | Does NOT detect door frames |
| **AR viewer (phone)** | Detects walls/surfaces, places 3D model | Does NOT generate 3D models |
| **Lambda** | Orchestrates the flow (upload → trigger ML → store result) | Does NOT run ML inference directly |
| **CloudFront + S3** | Serves the GLB file to the phone quickly | Does NOT process anything |

---

## File Locations

| What | Where |
|------|-------|
| Project repo | `~/Documents/generative-ai-on-amazon-sagemaker/` |
| GitHub remote | `https://github.com/ngjinshan/generative-ai-on-amazon-sagemaker.git` |
| Frontend code | `frontend/src/` |
| Lambda handlers | `lambda/` |
| CDK infra | `infra/lib/stack.ts` |
| This plan | `PLAN.md` |

---

## Next Session Checklist

When starting a new session, tell Kiro:
1. "I'm working on the AR Door Visualizer at `~/Documents/generative-ai-on-amazon-sagemaker/`"
2. Pick up from whichever step you're on above
3. If testing locally: "Set up local mock with Next.js API routes and a sample door GLB"
4. If deploying: "Deploy the CDK stack and set up the SageMaker endpoint"
