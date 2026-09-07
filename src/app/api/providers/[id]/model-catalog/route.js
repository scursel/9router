import { NextResponse } from "next/server";
import { getProviderConnectionById } from "@/models";
import { catalogStatus, getConnectionCatalog, syncConnectionCatalog } from "@/lib/modelSync/connectionCatalog.js";

export const dynamic = "force-dynamic";

function summarize(catalog) {
  const models = Array.isArray(catalog?.models) ? catalog.models : [];
  const counts = { free: 0, credits: 0, paid: 0, unknown: 0 };
  let unavailable = 0;
  let pending = 0;
  for (const model of models) {
    if (model?.availability === "unavailable") { unavailable++; continue; }
    if (model?.availability === "temporarily-absent") pending++;
    if (Object.hasOwn(counts, model?.tier)) counts[model.tier]++;
    else counts.unknown++;
  }
  return {
    total: models.length,
    available: models.length - unavailable,
    unavailable,
    pending,
    ...counts,
  };
}

export async function GET(_request, { params }) {
  const { id } = await params;
  const connection = await getProviderConnectionById(id);
  if (!connection) return NextResponse.json({ error: "Connection not found" }, { status: 404 });
  const catalog = getConnectionCatalog(connection);
  // No credentials or raw provider payloads leave this route: the stored
  // catalog holds only { id, name, tier, pricing, contextLength,
  // capabilities, kind, availability } per model.
  return NextResponse.json({
    connectionId: id,
    status: catalogStatus(connection),
    counts: summarize(catalog),
    ...catalog,
  });
}

export async function POST(_request, { params }) {
  const { id } = await params;
  const connection = await getProviderConnectionById(id);
  if (!connection) return NextResponse.json({ error: "Connection not found" }, { status: 404 });
  const result = await syncConnectionCatalog(connection);
  const fresh = result.updated ? getConnectionCatalog(await getProviderConnectionById(id)) : null;
  return NextResponse.json(
    { ...result, ...(fresh ? { status: catalogStatus({ modelCatalog: fresh }), counts: summarize(fresh), catalog: fresh } : {}) },
    { status: result.error ? 502 : 200 },
  );
}
