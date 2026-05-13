import { useState } from "react"
import BrowseTab from "./components/BrowseTab"
import GenerateTab from "./components/GenerateTab"
import GeneratedTab from "./components/GeneratedTab"
import DoorCamera from "./components/DoorCamera"
import "./index.css"

const TABS = ["Browse Doors", "My Doors", "Scan New", "Upload New"] as const;
type Tab = (typeof TABS)[number];

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>("Browse Doors");
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);

  return (
    <>
      <header className="header">
        <div className="header-logo">🚪 AR Door Visualizer</div>
      </header>

      <div className="tabs">
        {TABS.map((tab) => (
          <div
            key={tab}
            className={`tab ${activeTab === tab ? "active" : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </div>
        ))}
      </div>

      <div className="pipeline">
        <span className="pipeline-step active">1. Capture/Upload Photo</span>
        <span className="pipeline-arrow">→</span>
        <span className="pipeline-step">2. Generate 3D Model</span>
        <span className="pipeline-arrow">→</span>
        <span className="pipeline-step">3. View in AR</span>
      </div>

      <main>
        {activeTab === "Browse Doors" && <BrowseTab />}
        {activeTab === "My Doors" && <GeneratedTab />}
        {activeTab === "Scan New" && (
          <div style={{ padding: "2rem", maxWidth: 540, margin: "0 auto" }}>
            {!capturedUrl ? (
              <DoorCamera onCapture={(blob) => setCapturedUrl(URL.createObjectURL(blob))} />
            ) : (
              <div style={{ textAlign: "center" }}>
                <div className="panel-section" style={{ marginBottom: 16 }}>
                  <img src={capturedUrl} alt="Captured door" style={{ width: "100%", borderRadius: 8, maxHeight: "55vh", objectFit: "contain" }} />
                </div>
                <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
                  <button className="btn btn-secondary" onClick={() => { URL.revokeObjectURL(capturedUrl); setCapturedUrl(null); }}>
                    ↩ Retake
                  </button>
                  <button className="btn btn-primary btn-large" onClick={() => alert("Next: send to Nova Canvas for bg removal")}>
                    Generate 3D Model →
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
        {activeTab === "Upload New" && <GenerateTab />}
      </main>

      <footer style={{ padding: "1rem 2rem", borderTop: "1px solid #2a2a2a", textAlign: "center", color: "#888", fontSize: "0.8rem" }}>
        © 2026 AR Door Visualizer. Powered by AWS Bedrock + SageMaker.
      </footer>
    </>
  );
}
