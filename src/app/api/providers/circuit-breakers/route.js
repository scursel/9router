import { NextResponse } from "next/server";
import { getAllCircuitBreakerStatuses } from "open-sse/utils/circuitBreaker.js";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ breakers: getAllCircuitBreakerStatuses() });
}
