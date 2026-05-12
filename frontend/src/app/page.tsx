"use client";

import { useState } from "react";
import UploadForm from "@/components/UploadForm";
import StatusTracker from "@/components/StatusTracker";

export default function Home() {
  const [jobId, setJobId] = useState<string | null>(null);
  const [modelUrl, setModelUrl] = useState<string | null>(null);

  return (
    <main style={{ maxWidth: 600, margin: "0 auto", padding: "2rem" }}>
      <h1 style={{ fontSize: "1.8rem", marginBottom: "0.5rem" }}>🚪 AR Door Visualizer</h1>
      <p style={{ color: "#888", marginBottom: "2rem" }}>
        Upload photos of your door, then view it in AR on any door frame.
      </p>

      {!jobId && <UploadForm onJobCreated={setJobId} />}

      {jobId && !modelUrl && (
        <StatusTracker jobId={jobId} onComplete={setModelUrl} />
      )}

      {modelUrl && (
        <div>
          <h2 style={{ marginBottom: "1rem" }}>✅ Your door is ready!</h2>
          <a
            href={`/ar?model=${encodeURIComponent(modelUrl)}`}
            style={{
              display: "inline-block",
              padding: "1rem 2rem",
              background: "#ff9900",
              color: "#000",
              borderRadius: 8,
              textDecoration: "none",
              fontWeight: "bold",
            }}
          >
            View in AR →
          </a>
        </div>
      )}
    </main>
  );
}
