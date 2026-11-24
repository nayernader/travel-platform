"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormErrors } from "@/components/form-errors";
import { RequireAuth } from "@/components/require-auth";
import { useAuth } from "@/context/auth-context";
import { api, errorMessages } from "@/lib/api";

function ChangePasswordForm() {
  const { user, reloadUser } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ currentPassword: "", newPassword: "" });
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors([]);
    setBusy(true);
    try {
      await api.patch("/auth/change-password", form); // ACC-08, also ends a temporary password (ACC-13)
      await reloadUser();
      router.push("/");
    } catch (err) {
      setErrors(errorMessages(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm p-6">
      <h1 className="text-2xl font-bold">Change password</h1>
      {user?.mustChangePassword && (
        <p className="mt-2 rounded-md bg-amber-50 p-3 text-sm text-amber-800">
          An administrator reset your password. Choose a new one to continue.
        </p>
      )}
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <FormErrors messages={errors} />
        <label className="block">
          <span className="text-sm font-medium">Current password</span>
          <input type="password" required value={form.currentPassword}
            onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
            className="mt-1 w-full rounded-md border px-3 py-2" autoComplete="current-password" />
        </label>
        <label className="block">
          <span className="text-sm font-medium">New password</span>
          <input type="password" required value={form.newPassword}
            onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
            className="mt-1 w-full rounded-md border px-3 py-2" autoComplete="new-password" />
        </label>
        <button disabled={busy} className="w-full rounded-md bg-blue-600 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-60">
          {busy ? "Saving…" : "Change password"}
        </button>
      </form>
    </div>
  );
}

export default function ChangePasswordPage() {
  return (
    <RequireAuth>
      <ChangePasswordForm />
    </RequireAuth>
  );
}
