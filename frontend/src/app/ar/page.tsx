"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function ARViewerInner() {
  const params = useSearchParams();
  const modelUrl = params.get("model");

  if (!modelUrl) return <p>No model URL provided.</p>;

  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      {/* 
        model-viewer handles AR natively on mobile.
        On Android: WebXR scene view. On iOS: Quick Look (USDZ).
        For full WebXR wall-anchoring, replace with custom Three.js + WebXR below.
      */}
      {/* @ts-ignore */}
      <model-viewer
        src={modelUrl}
        ar
        ar-modes="webxr scene-viewer quick-look"
        ar-scale="fixed"
        camera-controls
        style={{ width: "100%", height: "100%" }}
        ar-placement="wall"
      >
        <button
          slot="ar-button"
          style={{
            position: "absolute",
            bottom: "2rem",
            left: "50%",
            transform: "translateX(-50%)",
            padding: "1rem 2rem",
            background: "#ff9900",
            color: "#000",
            border: "none",
            borderRadius: 8,
            fontSize: "1.1rem",
            fontWeight: "bold",
            cursor: "pointer",
          }}
        >
          Place Door in AR
        </button>
      {/* @ts-ignore */}
      </model-viewer>
    </div>
  );
}

export default function ARPage() {
  return (
    <Suspense fallback={<p>Loading AR...</p>}>
      <ARViewerInner />
    </Suspense>
  );
}
