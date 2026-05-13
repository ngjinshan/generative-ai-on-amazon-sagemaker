# AR Door Visualizer

Take a photo of a door you like, view it in AR on any wall.

## How it works

1. User photographs a door (showroom, existing door, catalog)
2. Background removal isolates the door
3. Normal map generated for panel/frame depth illusion
4. GLB created (textured plane + normal map)
5. `<model-viewer>` places it on a wall in AR

No GPU needed. The door is flat — a textured plane with depth from normal maps is indistinguishable from true 3D at typical AR viewing angles.

## Quick start

```bash
# Install Python deps
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Generate GLB from a door photo
python scripts/generate_door_glb.py samples/your-door.jpg frontend/public/sample-door.glb

# Run frontend
cd frontend && npm install && npm run dev
# Open http://localhost:3000

# Test AR on phone (needs HTTPS)
brew install cloudflared
cloudflared tunnel --url http://localhost:3000
# Open the URL on your phone
```

## Project structure

```
scripts/generate_door_glb.py    # photo -> bg removal -> normal map -> GLB
frontend/
  src/app/page.tsx              # main page
  src/components/GenerateTab.tsx # upload + 3D preview
  src/app/ar/page.tsx           # full-screen AR viewer
  src/app/api/                  # mock API routes (local dev)
  public/sample-door.glb       # pre-generated for testing
samples/                        # sample door photos
requirements.txt                # Python dependencies
```

## Cost

- **Local generation:** Free (rembg runs on CPU)
- **With Nova Canvas:** ~$0.08/image for background removal via Bedrock
- **No SageMaker endpoint needed**

## AR support

| Platform | Experience |
|----------|-----------|
| Android (Chrome) | WebXR wall placement |
| Android (other) | Scene Viewer |
| iOS (Safari) | Quick Look (floor placement) |
| Desktop | 3D viewer (rotate/zoom, no AR) |
