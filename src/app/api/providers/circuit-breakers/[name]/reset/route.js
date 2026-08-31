import { NextResponse } from "next/server";
import { resetCircuitBreaker } from "open-sse/utils/circuitBreaker.js";

export const dynamic = "force-dynamic";

export async function POST(_req, { params }) {
  const { name } = await params;
  if (!name) return NextResponse.json({ error: "missing name" }, { status: 400 });
  resetCircuitBreaker(decodeURIComponent(name));
  return NextResponse.json({ ok: true });
}
