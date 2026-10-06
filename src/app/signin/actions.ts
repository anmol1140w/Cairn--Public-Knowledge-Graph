"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn } from "../../../auth";
import { authenticationConfigured } from "@/server/auth";

export async function googleSignIn() {
  if (!authenticationConfigured()) redirect("/signin?error=unavailable");
  try {
    await signIn("google", { redirectTo: "/" });
  } catch (error) {
    if (error instanceof AuthError) redirect("/signin?error=unavailable");
    throw error;
  }
}
