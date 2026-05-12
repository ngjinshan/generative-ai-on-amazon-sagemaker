import { NextResponse } from "next/server";
import { randomUUID } from "crypto";

export async function POST() {
  const jobId = randomUUID();
  // Mock: no actual S3 upload, just return a job ID
  return NextResponse.json({ jobId, uploadUrls: ["/mock-upload", "/mock-upload"] });
}
