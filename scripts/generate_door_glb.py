"""
Generate an AR-ready door GLB from a photo.

Pipeline:
  1. Background removal (Nova Canvas via Bedrock, or rembg fallback)
  2. Depth estimation (MiDaS) → normal map
  3. Build GLB (flat plane + texture + normal map)

Usage:
    python generate_door_glb.py input_door.jpg output.glb
    python generate_door_glb.py input_door.jpg output.glb --no-aws  # skip Bedrock, use rembg
"""

import sys
import argparse
import json
import base64
import numpy as np
import trimesh
from PIL import Image
import torch


def remove_background_nova(img: Image.Image) -> Image.Image:
    """Remove background using Nova Canvas (Bedrock)."""
    import boto3

    bedrock = boto3.client("bedrock-runtime", region_name="us-east-1")

    buf = __import__("io").BytesIO()
    img.convert("RGB").save(buf, format="PNG")
    img_b64 = base64.b64encode(buf.getvalue()).decode()

    response = bedrock.invoke_model(
        modelId="amazon.nova-canvas-v1:0",
        body=json.dumps({
            "taskType": "BACKGROUND_REMOVAL",
            "backgroundRemovalParams": {"image": img_b64},
        }),
    )

    result = json.loads(response["body"].read())
    img_bytes = base64.b64decode(result["images"][0])
    return Image.open(__import__("io").BytesIO(img_bytes)).convert("RGBA")


def remove_background_rembg(img: Image.Image) -> Image.Image:
    """Remove background using rembg (local CPU fallback)."""
    from rembg import remove
    return remove(img)


def estimate_depth_midas(img: Image.Image) -> np.ndarray:
    """Estimate depth map using MiDaS (runs on CPU/MPS)."""
    model_type = "DPT_Hybrid"
    midas = torch.hub.load("intel-isl/MiDaS", model_type, trust_repo=True)

    device = torch.device("mps" if torch.backends.mps.is_available() else "cpu")
    midas = midas.to(device).eval()

    midas_transforms = torch.hub.load("intel-isl/MiDaS", "transforms", trust_repo=True)
    transform = midas_transforms.dpt_transform

    img_rgb = img.convert("RGB")
    img_np = np.array(img_rgb)

    input_batch = transform(img_np).to(device)

    with torch.no_grad():
        prediction = midas(input_batch)
        prediction = torch.nn.functional.interpolate(
            prediction.unsqueeze(1),
            size=img_rgb.size[::-1],
            mode="bicubic",
            align_corners=False,
        ).squeeze()

    depth = prediction.cpu().numpy()
    # Normalize to 0-1
    depth = (depth - depth.min()) / (depth.max() - depth.min() + 1e-8)
    return depth


def depth_to_normal_map(depth: np.ndarray, strength: float = 1.0) -> Image.Image:
    """Convert depth map to a tangent-space normal map."""
    # Compute gradients
    dy, dx = np.gradient(depth)
    dx *= strength
    dy *= strength

    # Normal = normalize(-dx, -dy, 1)
    dz = np.ones_like(dx)
    length = np.sqrt(dx**2 + dy**2 + dz**2)
    nx = (-dx / length * 0.5 + 0.5) * 255
    ny = (-dy / length * 0.5 + 0.5) * 255
    nz = (dz / length * 0.5 + 0.5) * 255

    normal = np.stack([nx, ny, nz], axis=-1).astype(np.uint8)
    return Image.fromarray(normal)


def create_door_plane(texture: Image.Image, normal_map: Image.Image, width: float, height: float) -> trimesh.Trimesh:
    """Create a plane mesh with texture and normal map."""
    hw = width / 2
    vertices = np.array([
        [-hw, 0, 0],
        [hw, 0, 0],
        [hw, height, 0],
        [-hw, height, 0],
    ], dtype=np.float64)

    faces = np.array([[0, 1, 2], [0, 2, 3]])

    uvs = np.array([
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
    ], dtype=np.float64)

    material = trimesh.visual.material.PBRMaterial(
        baseColorTexture=texture,
        normalTexture=normal_map,
        metallicFactor=0.0,
        roughnessFactor=0.7,
    )

    visual = trimesh.visual.TextureVisuals(uv=uvs, material=material)
    mesh = trimesh.Trimesh(vertices=vertices, faces=faces, visual=visual, process=False)
    return mesh


def create_door_glb(input_image_path: str, output_path: str, width: float = 0.82, height: float = 2.03, use_aws: bool = True):
    """Full pipeline: background removal → depth → normal map → GLB."""
    print(f"Loading {input_image_path}...")
    img = Image.open(input_image_path)

    # Step 1: Background removal
    if use_aws:
        print("Removing background (Nova Canvas)...")
        try:
            img_no_bg = remove_background_nova(img)
        except Exception as e:
            print(f"  Nova Canvas failed ({e}), falling back to rembg...")
            img_no_bg = remove_background_rembg(img)
    else:
        print("Removing background (rembg)...")
        img_no_bg = remove_background_rembg(img)

    # Composite onto white background for texture
    white_bg = Image.new("RGBA", img_no_bg.size, (255, 255, 255, 255))
    white_bg.paste(img_no_bg, mask=img_no_bg.split()[3])
    texture = white_bg.convert("RGB").resize((1024, 2048), Image.LANCZOS)

    # Step 2: Depth estimation → normal map
    print("Estimating depth (MiDaS)...")
    depth = estimate_depth_midas(texture)
    normal_map = depth_to_normal_map(depth, strength=2.0)

    # Step 3: Build GLB
    print("Building GLB...")
    mesh = create_door_plane(texture, normal_map, width, height)
    mesh.export(output_path, file_type="glb")

    size_kb = len(open(output_path, "rb").read()) / 1024
    print(f"Done: {output_path} ({size_kb:.0f} KB)")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate AR door GLB from photo")
    parser.add_argument("input", help="Input door photo")
    parser.add_argument("output", help="Output .glb path")
    parser.add_argument("--width", type=float, default=0.82, help="Door width in meters")
    parser.add_argument("--height", type=float, default=2.03, help="Door height in meters")
    parser.add_argument("--no-aws", action="store_true", help="Skip Bedrock, use rembg for bg removal")
    args = parser.parse_args()

    create_door_glb(args.input, args.output, args.width, args.height, use_aws=not args.no_aws)
