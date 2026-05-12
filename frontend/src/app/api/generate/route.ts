import { NextResponse } from "next/server";

// In-memory job store (mock)
const jobs = globalThis as unknown as { __jobs?: Record<string, { status: string; createdAt: number }> };
if (!jobs.__jobs) jobs.__jobs = {};

export async function POST(req: Request) {
  const { jobId } = await req.json();
  jobs.__jobs![jobId] = { status: "PROCESSING", createdAt: Date.now() };
  return NextResponse.json({ jobId, status: "PROCESSING" });
}
