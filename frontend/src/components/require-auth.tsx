"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/context/auth-context";
import type { Role } from "@/lib/types";
import { ButtonLink } from "./ui/button";
import { Card } from "./ui/card";
import { LoadingState } from "./ui/spinner";

/**
 * Wrap a page that needs login (and optionally a role).
 * This only improves the user experience: the backend still checks login, roles and ownership (GEN-13).
 *
 *   <RequireAuth roles={["admin"]}> ...admin page... </RequireAuth>
 */
export function RequireAuth({ roles, children }: { roles?: Role[]; children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    else if (user.mustChangePassword && pathname !== "/change-password") router.replace("/change-password");
  }, [loading, user, pathname, router]);

  if (loading || !user) return <LoadingState />;

  if (roles && !roles.includes(user.role)) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12">
        <Card>
          <h1 className="text-xl font-semibold">Not allowed</h1>
          <p className="mt-2 text-slate-600">Your account does not have access to this page.</p>
          <ButtonLink href="/" variant="outline" className="mt-4">Back to home</ButtonLink>
        </Card>
      </div>
    );
  }
  return <>{children}</>;
}
