"use client";

import GenerateTab from "@/components/GenerateTab";

export default function Home() {
  return (
    <>
      <header className="header">
        <div className="header-logo">AR Door Visualizer</div>
      </header>

      <div className="pipeline">
        <span className="pipeline-step active">1. Upload Photo</span>
        <span className="pipeline-arrow">&rarr;</span>
        <span className="pipeline-step">2. Generate Model</span>
        <span className="pipeline-arrow">&rarr;</span>
        <span className="pipeline-step">3. View in AR</span>
      </div>

      <main>
        <GenerateTab />
      </main>
    </>
  );
}
