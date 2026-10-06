import { NextRequest, NextResponse } from "next/server";
import { deleteInvestigation, pool } from "@/server/storage";
import { authErrorResponse, requireAccount } from "@/server/auth";
import { sameOrigin } from "@/server/http";
import { capConfidence } from "@/server/graph-builder";
import type { Investigation } from "@/lib/types";
export const runtime = "nodejs";

type InvestigationRouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(
  request: NextRequest,
  context: InvestigationRouteContext,
) {
  void request;
  const { id } = await context.params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))
    return NextResponse.json(
      { error: "Investigation not found." },
      { status: 404 },
    );
  try {
    const account = await requireAccount();
    const result = await pool().query(
      "SELECT investigation FROM search_runs WHERE id=$1 AND account_id=$2 AND investigation IS NOT NULL",
      [id, account.accountId],
    );
    if (!result.rows[0])
      return NextResponse.json(
        { error: "Investigation not found." },
        { status: 404 },
      );
    const investigation = result.rows[0].investigation as Investigation;
    investigation.claims = investigation.claims.map((claim) =>
      capConfidence(claim, investigation.evidence),
    );
    investigation.entities = investigation.entities.map((entity) =>
      entity.id.startsWith("entity-")
        ? {
            ...entity,
            subtitle: "AI-extracted mention · inspect source",
            metadata: { ...entity.metadata, inferredEntity: true },
          }
        : entity,
    );
    investigation.relationships = investigation.relationships.map((edge) =>
      edge.explanation &&
      !edge.explanation.startsWith("Employer named") &&
      !edge.explanation.startsWith("Returned by a Google Scholar")
        ? { ...edge, inferred: true }
        : edge,
    );
    return NextResponse.json(
      { investigation },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    return NextResponse.json(
      { error: "Evidence storage is unavailable." },
      { status: 503 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: InvestigationRouteContext,
) {
  const { id } = await context.params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))
    return NextResponse.json(
      { error: "Investigation not found." },
      { status: 404 },
    );
  try {
    sameOrigin(request);
    const account = await requireAccount();
    if (!(await deleteInvestigation(id, account.accountId)))
      return NextResponse.json(
        { error: "Investigation not found." },
        { status: 404 },
      );
    return NextResponse.json({ deleted: true });
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    return NextResponse.json(
      { error: "Investigation could not be deleted." },
      { status: 503 },
    );
  }
}
