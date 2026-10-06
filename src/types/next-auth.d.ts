import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    legalAcceptedAt?: Date | null;
    termsVersion?: string | null;
    privacyVersion?: string | null;
  }
  interface Session {
    user: {
      id: string;
      legalAccepted: boolean;
    } & DefaultSession["user"];
  }
}
