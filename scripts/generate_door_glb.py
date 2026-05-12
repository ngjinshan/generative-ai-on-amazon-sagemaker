"""
Generate a 3D door GLB from a photo by mapping it onto a flat box.
No GPU needed — works on CPU.

Usage:
    python generate_door_glb.py input_door.jpg output.glb
"""

import sys
import numpy as np
import trimesh
from PIL import Image
from rembg import remove


def create_door_glb(input_image_path: str, output_path: str, width=0.82, height=2.03, depth=0.04):
    """Create a GLB file of a door-shaped box textured with the input image."""
    
    # 1. Load and remove background
    img = Image.open(input_image_path)
    img_no_bg = remove(img)
    
    # 2. Add white background, resize to power-of-2 for texture
    white_bg = Image.new('RGBA', img_no_bg.size, (255, 255, 255, 255))
    white_bg.paste(img_no_bg, mask=img_no_bg.split()[3])
    texture_img = white_bg.convert('RGB').resize((1024, 2048))
    
    # 3. Create box mesh (door dimensions in meters)
    box = trimesh.creation.box(extents=[width, height, depth])
    
    # Move origin to bottom center (so door sits on floor in AR)
    box.apply_translation([0, height / 2, 0])
    
    # 4. Apply texture to front face
    # Create UV mapping - map front face to full texture
    # For a box, trimesh assigns UVs per-face. We'll create a simple material.
    material = trimesh.visual.material.PBRMaterial(
        baseColorTexture=texture_img,
        metallicFactor=0.0,
        roughnessFactor=0.8,
    )
    
    # Apply texture using simple UV projection
    # Project UVs from the front (XY plane)
    vertices = box.vertices
    uv = np.zeros((len(vertices), 2))
    uv[:, 0] = (vertices[:, 0] - vertices[:, 0].min()) / (vertices[:, 0].max() - vertices[:, 0].min())
    uv[:, 1] = (vertices[:, 1] - vertices[:, 1].min()) / (vertices[:, 1].max() - vertices[:, 1].min())
    
    # Create TextureVisuals
    box.visual = trimesh.visual.TextureVisuals(uv=uv, material=material)
    
    # 5. Export as GLB
    box.export(output_path, file_type='glb')
    print(f"✅ Created {output_path} ({box.vertices.shape[0]} vertices, {box.faces.shape[0]} faces)")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python generate_door_glb.py <input_image> <output.glb>")
        sys.exit(1)
    
    create_door_glb(sys.argv[1], sys.argv[2])
