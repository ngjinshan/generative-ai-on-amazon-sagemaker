"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api";

interface Props {
  jobId: string;
  onComplete: (modelUrl: string) => void;
}

export default function StatusTracker({ jobId, onComplete }: Props) {
  const [status, setStatus] = useState("PROCESSING");

  useEffect(() => {
    const interval = setInterval(async () => {
      const res = await fetch(`${API_URL}/status/${jobId}`);
      const data = await res.json();
      setStatus(data.status);
      if (data.status === "COMPLETE") {
        clearInterval(interval);
        onComplete(data.modelUrl);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [jobId, onComplete]);

  return (
    <div style={{ textAlign: "center", padding: "2rem" }}>
      <div style={{ fontSize: "2rem", marginBottom: "1rem" }}>⏳</div>
      <p>Generating 3D model of your door...</p>
      <p style={{ color: "#888", fontSize: "0.9rem", marginTop: "0.5rem" }}>
        Status: {status} • This takes ~30-60 seconds
      </p>
    </div>
  );
}
