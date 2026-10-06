"use client";

import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";

interface AccountUser {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

export function AccountControl() {
  const router = useRouter();
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [user, setUser] = useState<AccountUser | null>(null);
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let controller = new AbortController();
    const update = () => {
      controller.abort();
      controller = new AbortController();
      const requestController = controller;
      void fetch("/api/me", { signal: requestController.signal })
        .then(async (response) => {
          const data = (await response.json()) as {
            authConfigured?: boolean;
            user?: AccountUser | null;
          };
          setConfigured(Boolean(data.authConfigured));
          setUser(data.user ?? null);
        })
        .catch(() => {
          if (!requestController.signal.aborted) setConfigured(false);
        });
    };
    void update();
    const interval = window.setInterval(update, 60_000);
    window.addEventListener("focus", update);
    return () => {
      controller.abort();
      window.clearInterval(interval);
      window.removeEventListener("focus", update);
    };
  }, []);

  if (configured !== true) return null;

  const label = user?.name ?? user?.email ?? "Account";
  const deleteAccount = async () => {
    if (
      !window.confirm(
        "Delete your Cairn account and saved investigations? This cannot be undone.",
      )
    )
      return;
    setDeleting(true);
    const response = await fetch("/api/me", { method: "DELETE" });
    if (response.ok) router.push("/");
    else setDeleting(false);
  };

  if (!user)
    return (
      <form method="get" action="/api/auth/signin">
        <input type="hidden" name="provider" value="google" />
        <input type="hidden" name="callbackUrl" value="/" />
        <button className="account-button" type="submit">
          Sign in with Google
        </button>
      </form>
    );

  return (
    <div className="account-control">
      <button
        className="account-button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {label}
      </button>
      {open && (
        <div className="account-menu" role="menu">
          {user.email && <small>{user.email}</small>}
          <button
            role="menuitem"
            onClick={() => void signOut({ callbackUrl: "/" })}
          >
            Sign out
          </button>
          <button
            role="menuitem"
            onClick={() => void deleteAccount()}
            disabled={deleting}
          >
            {deleting ? "Deleting…" : "Delete account"}
          </button>
        </div>
      )}
    </div>
  );
}
