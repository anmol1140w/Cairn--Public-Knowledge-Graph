import "server-only";
import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

export function session(request: NextRequest): { id: string; fresh: boolean } {
  const value = request.cookies.get("pkg-session")?.value;
  if (
    value &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  )
    return { id: value, fresh: false };
  return { id: randomUUID(), fresh: true };
}
export function sessionCookie(response: NextResponse, id: string) {
  response.cookies.set("pkg-session", id, {
    httpOnly: true,
    sameSite: "strict",
    secure:
      process.env.NODE_ENV === "production" && process.env.APP_HTTPS === "true",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}
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
