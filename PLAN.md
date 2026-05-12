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

## Testing Plan (Recommended Order)

### Step 1: Test AR Placement Locally (10 min, no AWS needed)

**Goal:** Verify that the AR viewer works on your phone with wall placement.

**What to do:**
1. Download a free door GLB model from Sketchfab (search "door glb")
2. Add Next.js API routes to serve it locally (mock the Lambda flow)
3. Run `npm run dev`, open on phone via local network (e.g., `http://192.168.x.x:3000`)
4. Test: does the door appear on the wall when you point your camera?

**What this proves:** The AR delivery pipeline works end-to-end (frontend → GLB → AR viewer → wall placement).

**Implementation:**
- Create `frontend/src/app/api/upload/route.ts` — mock, returns fake job ID
- Create `frontend/src/app/api/generate/route.ts` — mock, sets status to COMPLETE after 3s delay
- Create `frontend/src/app/api/status/[jobId]/route.ts` — mock, returns sample GLB URL
- Place a sample door GLB in `frontend/public/sample-door.glb`

---

### Step 2: Test 3D Generation Quality (30 min, free or ~$2)

**Goal:** Verify that TripoSR/InstantMesh produces acceptable 3D door meshes from a single photo.

**What to do:**
1. Open Google Colab (free GPU) or a SageMaker Notebook (ml.g5.xlarge, ~$1.41/hr)
2. Run TripoSR with a door photo as input
3. Download the output mesh, open in a 3D viewer (e.g., https://gltf-viewer.donmccurdy.com/)
4. Evaluate: Is the geometry clean? Is the texture recognizable? Are panels/glass visible?

**What this proves:** The ML model can produce usable door meshes. If quality is bad, we need a different model or multi-view approach.

**TripoSR Colab quick test:**
```python
# In Google Colab with T4 GPU
!pip install torch torchvision torchaudio
!git clone https://github.com/VAST-AI-Research/TripoSR.git
%cd TripoSR
!pip install -r requirements.txt

# Run inference
!python run.py your_door_photo.png --output-dir output/ --model-save-format glb
```

**Alternative models to try if TripoSR quality is insufficient:**
- InstantMesh (better geometry, slower)
- Wonder3D (better textures)
- Meshy API (3rd party, high quality, costs $0.10-0.50/generation)

---

### Step 3: Deploy AWS Infrastructure (30 min)

**Goal:** Get the real backend running.

**What to do:**
```bash
cd infra
npm install
npx cdk bootstrap --region us-east-1   # first time only
npx cdk deploy
```

**Outputs:** API Gateway URL, S3 bucket names, CloudFront domain.

**Then:** Set `NEXT_PUBLIC_API_URL` in frontend to the API Gateway URL.

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
2. Upload a door photo
3. Wait 30-60s for processing
4. Tap "View in AR"
5. Point at a wall → door appears

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
