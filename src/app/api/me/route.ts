import { NextRequest, NextResponse } from "next/server";
import {
  authErrorResponse,
  authenticationConfigured,
  currentAccount,
  requireAccount,
} from "@/server/auth";
import { sameOrigin } from "@/server/http";
import { deleteAccount } from "@/server/storage";

export const runtime = "nodejs";

export async function GET() {
  try {
    const account = await currentAccount();
    return NextResponse.json(
      {
        authenticated: Boolean(account),
        authConfigured: authenticationConfigured(),
        user: account
          ? {
              id: account.authUserId,
              name: account.name,
              email: account.email,
              image: account.image,
            }
          : null,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    return NextResponse.json(
      { error: "The account session could not be checked." },
      { status: 503 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    sameOrigin(request);
    const account = await requireAccount();
    await deleteAccount(account.accountId, account.authUserId);
    const response = NextResponse.json({ deleted: true });
    for (const name of [
      "authjs.session-token",
      "__Secure-authjs.session-token",
    ])
      response.cookies.set(name, "", { path: "/", maxAge: 0 });
    return response;
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    return NextResponse.json(
      { error: "Your account could not be deleted." },
      { status: 503 },
    );
  }
}
