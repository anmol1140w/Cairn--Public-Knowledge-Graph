import { NextResponse } from "next/server";
import { pool } from "@/server/storage";
import { authErrorResponse, requireAccount } from "@/server/auth";
export const runtime = "nodejs";
export async function GET() {
  try {
    const account = await requireAccount();
    const result = await pool().query(
      "SELECT r.id,q.query,r.created_at, jsonb_array_length(r.investigation->'evidence') AS evidence_count FROM search_runs r JOIN queries q ON q.id=r.id WHERE r.account_id=$1 AND r.status IN ('complete','empty') AND r.investigation IS NOT NULL ORDER BY r.created_at DESC LIMIT 12",
      [account.accountId],
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
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    return NextResponse.json(
      {
        error:
          "Saved investigations are unavailable. Your current graph remains accessible.",
      },
      { status: 503 },
    );
  }
}
