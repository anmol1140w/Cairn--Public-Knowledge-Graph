import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { investigationSchema } from "@/server/validation";
import {
  citationReport,
  csvReport,
  markdownReport,
  pdfReport,
} from "@/server/export";
import { bodyJson, sameOrigin } from "@/server/http";
import { authErrorResponse, requireAccount } from "@/server/auth";
import { ownsInvestigation } from "@/server/storage";
import { publicError } from "@/server/config";
import { exportFilename } from "@/lib/brand";
export const runtime = "nodejs";
const schema = z.object({
  format: z.enum(["markdown", "pdf", "json", "csv", "citations"]),
  investigation: investigationSchema,
});
export async function POST(request: NextRequest) {
  try {
    sameOrigin(request);
    const { format, investigation } = schema.parse(
      await bodyJson(request, 2000000),
    );
    if (!investigation.demo) {
      const account = await requireAccount();
      if (
        !investigation.sessionOnly &&
        !(await ownsInvestigation(investigation.id, account.accountId))
      )
        return NextResponse.json(
          { error: "Investigation not found." },
          { status: 404 },
        );
    }
    let body: string | Uint8Array;
    let mime: string;
    let extension: string;
    if (format === "json") {
      body = JSON.stringify(investigation, null, 2);
      mime = "application/json";
      extension = "json";
    } else if (format === "csv") {
      body = csvReport(investigation);
      mime = "application/zip";
      extension = "zip";
    } else if (format === "pdf") {
      body = await pdfReport(investigation);
      mime = "application/pdf";
      extension = "pdf";
    } else if (format === "citations") {
      body = citationReport(investigation);
      mime = "text/plain; charset=utf-8";
      extension = "txt";
    } else {
      body = markdownReport(investigation);
      mime = "text/markdown; charset=utf-8";
      extension = "md";
    }
    return new NextResponse(
      typeof body === "string" ? body : new Uint8Array(body),
      {
        headers: {
          "Content-Type": mime,
          "Content-Disposition": `attachment; filename="${exportFilename(investigation.demo, extension)}"`,
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    return NextResponse.json({ error: publicError(error) }, { status: 400 });
  }
}
