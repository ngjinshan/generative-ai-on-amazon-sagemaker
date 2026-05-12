"use client";

import { useState, useRef } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api";

export default function GenerateTab() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "processing" | "complete">("idle");
  const [modelUrl, setModelUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(f: File) {
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setStatus("idle");
    setModelUrl(null);
  }

  async function handleGenerate() {
    if (!file) return;
    setStatus("uploading");

    try {
      // 1. Get presigned URL
      const res = await fetch(`${API_URL}/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileNames: [file.name], fileTypes: [file.type] }),
      });
      const { jobId, uploadUrls } = await res.json();

      // 2. Upload to S3 (or mock)
      if (uploadUrls[0] !== "/mock-upload") {
        await fetch(uploadUrls[0], { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      }

      // 3. Trigger generation
      setStatus("processing");
      await fetch(`${API_URL}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });

      // 4. Poll status
      const poll = setInterval(async () => {
        const statusRes = await fetch(`${API_URL}/status/${jobId}`);
        const data = await statusRes.json();
        if (data.status === "COMPLETE") {
          clearInterval(poll);
          setModelUrl(data.modelUrl);
          setStatus("complete");
        }
      }, 2000);
    } catch {
      setStatus("idle");
      alert("Generation failed. Please try again.");
    }
  }

  return (
    <div className="generate-panel">
      {/* Left: Upload + Controls */}
      <div>
        <div className="panel-section">
          <div className="panel-title">Upload Door Photo</div>

          <div
            className="upload-area"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); }}
          >
            {preview ? (
              <img src={preview} alt="Door preview" style={{ maxHeight: 180, maxWidth: "100%", borderRadius: 4 }} />
            ) : (
              <>
                <p style={{ marginBottom: "0.5rem" }}>📷 Drag and drop a door photo, or click to browse</p>
                <p style={{ fontSize: "0.8rem", color: "#666" }}>Front-facing, well-lit, door fills the frame</p>
              </>
            )}
          </div>
          <input ref={inputRef} type="file" accept="image/*" hidden onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />

          <div style={{ marginTop: "1rem" }}>
            <button
              className="btn btn-primary btn-large"
              style={{ width: "100%" }}
              disabled={!file || status === "uploading" || status === "processing"}
              onClick={handleGenerate}
            >
              {status === "idle" && "Generate 3D Model"}
              {status === "uploading" && "Uploading..."}
              {status === "processing" && "Generating 3D Model..."}
              {status === "complete" && "✓ Complete — Generate Again?"}
            </button>
          </div>
        </div>

        {status === "processing" && (
          <div className="panel-section" style={{ marginTop: "1rem", textAlign: "center" }}>
            <span className="status-badge status-processing">⏳ Processing</span>
            <p style={{ marginTop: "0.5rem", fontSize: "0.85rem", color: "#888" }}>
              Generating 3D model... This takes ~30-60 seconds.
            </p>
          </div>
        )}
      </div>

      {/* Right: 3D Preview */}
      <div>
        <div className="panel-section" style={{ height: "100%", minHeight: 400 }}>
          <div className="panel-title">3D Model Preview</div>
          {modelUrl ? (
            <div style={{ height: "calc(100% - 3rem)" }}>
              {/* @ts-ignore */}
              <model-viewer
                src={modelUrl}
                ar
                ar-modes="webxr scene-viewer quick-look"
                ar-scale="fixed"
                camera-controls
                auto-rotate
                style={{ width: "100%", height: "100%", minHeight: 300, borderRadius: 8 }}
                ar-placement="wall"
              >
                <button
                  slot="ar-button"
                  className="btn btn-primary"
                  style={{ position: "absolute", bottom: "1rem", left: "50%", transform: "translateX(-50%)" }}
                >
                  👁 View in AR
                </button>
              {/* @ts-ignore */}
              </model-viewer>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "calc(100% - 3rem)", color: "#555" }}>
              <span style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>🚪</span>
              <p style={{ fontSize: "0.85rem" }}>Upload a door photo and generate to preview the 3D model here</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
