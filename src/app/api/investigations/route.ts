import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/server/storage";
import { session } from "@/server/http";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  const user = session(request);
  if (user.fresh)
    return NextResponse.json(
      { investigations: [] },
      { headers: { "Cache-Control": "no-store" } },
    );
  try {
    const result = await pool().query(
      "SELECT r.id,q.query,r.created_at, jsonb_array_length(r.investigation->'evidence') AS evidence_count FROM search_runs r JOIN queries q ON q.id=r.id WHERE r.session_id=$1 AND r.status IN ('complete','empty') AND r.investigation IS NOT NULL ORDER BY r.created_at DESC LIMIT 12",
      [user.id],
    );
    return NextResponse.json(
      {
        investigations: result.rows.map((row) => ({
          id: row.id,
          query: row.query,
          date: row.created_at,
          evidenceCount: row.evidence_count,
        })),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      {
        error:
          "Saved investigations are unavailable. Your current graph remains accessible.",
      },
      { status: 503 },
    );
  }
}
