# AR Door Visualizer

Take a photo of a door you like, view it in AR on any wall.

## Architecture

```
User uploads door photo
    |
    v
Background removal (rembg / Nova Canvas)
    |
    v
Generate normal map (Sobel-based depth estimation)
    |
    v
Create GLB (flat plane + texture + normal map)
    |
    v
model-viewer AR placement (wall mode)
```

## How it works

- **No GPU / SageMaker needed** — the door is inherently flat, so a textured plane with a normal map for panel depth illusion looks photorealistic from typical AR viewing angles
- **Normal map** gives the illusion of recessed panels, frame borders, and hardware depth
- **model-viewer** handles AR on both Android (WebXR/Scene Viewer) and iOS (Quick Look)

## Local testing

```bash
# 1. Generate GLB from a door photo
source .venv/bin/activate
python scripts/generate_door_glb.py samples/your-door.jpg frontend/public/sample-door.glb

# 2. Run frontend
cd frontend && npm run dev

# 3. Test AR on phone (needs HTTPS)
brew install cloudflared
cloudflared tunnel --url http://localhost:3000
# Open the cloudflare URL on your phone → upload → view in AR
```

## File structure

```
scripts/generate_door_glb.py   — pipeline: photo → bg removal → normal map → GLB
frontend/                      — Next.js app with model-viewer AR
  src/app/page.tsx             — main page (upload + preview)
  src/components/GenerateTab.tsx — upload flow + 3D viewer
  src/app/ar/page.tsx          — full-screen AR viewer
  src/app/api/                 — mock API routes (local dev)
  public/sample-door.glb      — pre-generated sample for testing
samples/                       — sample door photos
```

## Next steps

1. Wire up real API route that calls `generate_door_glb.py` server-side (or as a Lambda)
2. Add Nova Canvas background removal (Bedrock) as alternative to local rembg
3. Deploy frontend to Amplify for phone testing
4. Optional: add inpainting mode (paste door into photo of target wall)
