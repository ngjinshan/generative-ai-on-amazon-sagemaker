import { NextResponse } from "next/server";

const jobs = globalThis as unknown as { __jobs?: Record<string, { status: string; createdAt: number }> };
if (!jobs.__jobs) jobs.__jobs = {};

export async function GET(_req: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const job = jobs.__jobs?.[jobId];

  if (!job) {
    // If no job found, treat as instant complete (for simple testing)
    return NextResponse.json({ jobId, status: "COMPLETE", modelUrl: "/sample-door.glb" });
  }

  // Simulate 3s processing time
  const elapsed = Date.now() - job.createdAt;
  if (elapsed > 3000) {
    return NextResponse.json({ jobId, status: "COMPLETE", modelUrl: "/sample-door.glb" });
  }

  return NextResponse.json({ jobId, status: "PROCESSING", modelUrl: null });
}
