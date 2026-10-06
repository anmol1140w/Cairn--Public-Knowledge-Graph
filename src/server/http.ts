import "server-only";
import { NextRequest } from "next/server";
export function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== request.headers.get("host"))
    throw new Error(
      "This endpoint accepts requests from the application’s origin.",
    );
}
export async function bodyJson(
  request: NextRequest,
  maxBytes = 100000,
): Promise<unknown> {
  if (Number(request.headers.get("content-length") ?? 0) > maxBytes)
    throw new Error("This request is too large.");
  const text = await request.text();
  if (Buffer.byteLength(text) > maxBytes)
    throw new Error("This request is too large.");
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("This request needs a valid JSON body.");
  }
}
