"use client";

// Sample doors for demo (replace with API call to /api/assets later)
const SAMPLE_DOORS = [
  { id: "modern-white", name: "Modern White Panel Door", desc: "Clean 4-panel design with smooth finish.", dimensions: "2030mm × 820mm", color: "White", material: "MDF" },
  { id: "oak-classic", name: "Classic Oak Door", desc: "Traditional solid oak with raised panels.", dimensions: "2030mm × 820mm", color: "Natural Oak", material: "Solid Wood" },
  { id: "glass-panel", name: "Frosted Glass Panel Door", desc: "Contemporary door with frosted glass inserts.", dimensions: "2030mm × 820mm", color: "Grey", material: "Wood + Glass" },
];

export default function BrowseTab() {
  return (
    <div>
      <div style={{ padding: "1.5rem 2rem 0" }}>
        <h2 style={{ fontSize: "1.2rem", marginBottom: "0.25rem" }}>Available Doors</h2>
        <p style={{ color: "#888", fontSize: "0.85rem" }}>{SAMPLE_DOORS.length} doors available</p>
      </div>
      <div className="grid">
        {SAMPLE_DOORS.map((door) => (
          <div key={door.id} className="card">
            <div className="card-preview">
              {/* model-viewer would go here with real GLB */}
              <span style={{ color: "#555", fontSize: "0.85rem" }}>3D Preview</span>
            </div>
            <div className="card-body">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                <div className="card-title">{door.name}</div>
              </div>
              <div className="card-desc">{door.desc}</div>
              <div style={{ fontSize: "0.8rem", color: "#666", marginBottom: "0.75rem" }}>
                {door.dimensions} · {door.color} · {door.material}
              </div>
              <div className="card-actions">
                <button className="btn btn-secondary">Details</button>
                <button className="btn btn-primary">View in AR</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
