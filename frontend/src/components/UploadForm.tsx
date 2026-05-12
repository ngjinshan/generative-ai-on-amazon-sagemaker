"use client";

import { useState, useRef } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api";

interface Props {
  onJobCreated: (jobId: string) => void;
}

export default function UploadForm({ onJobCreated }: Props) {
  const [uploading, setUploading] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (files.length === 0) return;

    setUploading(true);
    try {
      // 1. Get presigned upload URLs
      const res = await fetch(`${API_URL}/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileNames: files.map((f) => f.name),
          fileTypes: files.map((f) => f.type),
        }),
      });
      const { jobId, uploadUrls } = await res.json();

      // 2. Upload files directly to S3
      await Promise.all(
        files.map((file, i) =>
          fetch(uploadUrls[i], { method: "PUT", body: file, headers: { "Content-Type": file.type } })
        )
      );

      // 3. Trigger 3D generation
      await fetch(`${API_URL}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });

      onJobCreated(jobId);
    } catch (err) {
      console.error("Upload failed:", err);
      alert("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <label
        style={{
          display: "block",
          border: "2px dashed #444",
          borderRadius: 12,
          padding: "3rem",
          textAlign: "center",
          cursor: "pointer",
          marginBottom: "1rem",
        }}
        onClick={() => inputRef.current?.click()}
      >
        {files.length > 0
          ? `${files.length} photo(s) selected`
          : "Tap to upload door photos (front + back)"}
      </label>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => setFiles(Array.from(e.target.files || []))}
      />
      <button
        type="submit"
        disabled={uploading || files.length === 0}
        style={{
          width: "100%",
          padding: "1rem",
          background: files.length > 0 ? "#ff9900" : "#333",
          color: files.length > 0 ? "#000" : "#666",
          border: "none",
          borderRadius: 8,
          fontSize: "1rem",
          fontWeight: "bold",
          cursor: files.length > 0 ? "pointer" : "not-allowed",
        }}
      >
        {uploading ? "Uploading..." : "Generate 3D Model"}
      </button>
    </form>
  );
}
