'use client';
import { useState } from 'react';
import DoorCamera from '@/components/DoorCamera';

export default function CapturePage() {
  const [captured, setCaptured] = useState<string | null>(null);

  const handleCapture = (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    setCaptured(url);
  };

  return (
    <div style={{ padding: 20, fontFamily: 'system-ui', maxWidth: 540, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, textAlign: 'center' }}>🚪 Door Scanner</h1>

      {!captured ? (
        <DoorCamera onCapture={handleCapture} />
      ) : (
        <div style={{ textAlign: 'center' }}>
          <img src={captured} alt="Captured door" style={{ width: '100%', borderRadius: 12 }} />
          <div style={{ marginTop: 16, display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button
              onClick={() => { URL.revokeObjectURL(captured); setCaptured(null); }}
              style={{ padding: '12px 24px', fontSize: 14, background: '#666', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}
            >
              ↩ Retake
            </button>
            <button
              onClick={() => alert('Next: send to Nova Canvas for bg removal')}
              style={{ padding: '12px 24px', fontSize: 14, background: '#0070f3', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}
            >
              ✓ Use this photo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
