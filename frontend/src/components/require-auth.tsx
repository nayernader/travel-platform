"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/context/auth-context";
import type { Role } from "@/lib/types";

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

  if (loading || !user) return <p className="p-6 text-gray-500">Loading…</p>;

  if (roles && !roles.includes(user.role)) {
    return (
      <div className="mx-auto max-w-xl p-6">
        <h1 className="text-xl font-semibold">Not allowed</h1>
        <p className="mt-2 text-gray-600">Your account does not have access to this page.</p>
      </div>
    );
  }
  return <>{children}</>;
}
