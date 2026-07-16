"use client";

import { LogIn, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export function AuthButton() {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return (
      <Button variant="ghost" size="sm" disabled>
        <span className="size-4 animate-pulse rounded-full bg-muted-foreground" />
      </Button>
    );
  }

  if (session?.user) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <User className="size-4" />
          <span className="max-w-[120px] truncate">{session.user.name}</span>
        </div>
        <Button variant="ghost" size="sm" onClick={() => authClient.signOut()}>
          <LogOut className="size-4" />
          <span className="sr-only">Sign out</span>
        </Button>
      </div>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() =>
        authClient.signIn.social({
          provider: "figma",
          callbackURL: "/",
        })
      }
    >
      <LogIn className="size-4 mr-1.5" />
      Sign in with Figma
    </Button>
  );
}
