"use client";

import { useState } from "react";
import BrowseTab from "@/components/BrowseTab";
import GenerateTab from "@/components/GenerateTab";
import GeneratedTab from "@/components/GeneratedTab";

const TABS = ["Browse Doors", "My Doors", "Upload New"] as const;
type Tab = (typeof TABS)[number];

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("Browse Doors");

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
        <span className="pipeline-step active">1. Upload Photo</span>
        <span className="pipeline-arrow">→</span>
        <span className="pipeline-step">2. Generate 3D Model</span>
        <span className="pipeline-arrow">→</span>
        <span className="pipeline-step">3. View in AR</span>
      </div>

      <main>
        {activeTab === "Browse Doors" && <BrowseTab />}
        {activeTab === "My Doors" && <GeneratedTab />}
        {activeTab === "Upload New" && <GenerateTab />}
      </main>

      <footer style={{ padding: "1rem 2rem", borderTop: "1px solid #2a2a2a", textAlign: "center", color: "#888", fontSize: "0.8rem" }}>
        © 2026 AR Door Visualizer. Powered by AWS Bedrock + SageMaker.
      </footer>
    </>
  );
}
