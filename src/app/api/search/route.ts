import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { investigate } from "@/server/agent";
import { searchSchema } from "@/server/validation";
import {
  assertStorage,
  beginRun,
  failRun,
  saveInvestigation,
  finishSessionOnlyRun,
  usageSnapshot,
} from "@/server/storage";
import { bodyJson, sameOrigin } from "@/server/http";
import { authErrorResponse, requireAccount } from "@/server/auth";
import { config, publicError } from "@/server/config";
import type { ProgressEvent } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;
export async function POST(request: NextRequest) {
  let input;
  let account;
  const runId = randomUUID();
  try {
    sameOrigin(request);
    account = await requireAccount();
    input = searchSchema.parse(await bodyJson(request, 12000));
    if (!config.serpapiKey())
      return NextResponse.json(
        {
          error:
            "Live search needs a server-side SERPAPI_API_KEY. You can explore the labelled demo meanwhile.",
        },
        { status: 503 },
      );
    await assertStorage();
    await beginRun(runId, account.accountId, input.query);
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    return NextResponse.json({ error: publicError(error) }, { status: 400 });
  }
  const encoder = new TextEncoder();
  const abort = new AbortController();
  const combined = AbortSignal.any([
    request.signal,
    abort.signal,
    AbortSignal.timeout(290000),
  ]);
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const emit = (event: ProgressEvent) => {
        if (!closed && !combined.aborted) {
          try {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
            );
          } catch {
            closed = true;
          }
        }
      };
      const heartbeat = setInterval(() => {
        if (!closed && !combined.aborted) {
          try {
            controller.enqueue(encoder.encode(": evidence-stream\n\n"));
          } catch {
            closed = true;
          }
        }
      }, 15000);
      try {
        const result = await investigate(
          input,
          { accountId: account.accountId, runId, signal: combined },
          emit,
        );
        result.usage = await Promise.resolve()
          .then(() => usageSnapshot())
          .catch(() => undefined);
        try {
          if (input.profile && !input.saveProfile)
            await finishSessionOnlyRun(runId, account.accountId);
          else await saveInvestigation(result, account.accountId);
        } catch {
          result.warnings.push(
            "The investigation completed, but its final snapshot could not be persisted. Export your evidence to keep a copy.",
          );
        }
        emit({ kind: "result", result });
      } catch (error) {
        await failRun(runId, account.accountId).catch(() => {});
        emit({ kind: "error", message: publicError(error) });
      } finally {
        clearInterval(heartbeat);
        if (!closed) {
          closed = true;
          try {
            controller.close();
          } catch {
            /* Client disconnected. */
          }
        }
      }
    },
    cancel() {
      abort.abort();
    },
  });
  const response = new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
      Connection: "keep-alive",
    },
  });
  return response;
}
