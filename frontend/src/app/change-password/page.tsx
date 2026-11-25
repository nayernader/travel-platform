"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormErrors } from "@/components/form-errors";
import { RequireAuth } from "@/components/require-auth";
import { AuthShell } from "@/components/auth-shell";
import { Alert, Button, Input } from "@/components/ui";
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
    <AuthShell title="Change password">
        {user?.mustChangePassword && (
          <div className="mb-4">
            <Alert tone="warning">An administrator reset your password. Choose a new one to continue.</Alert>
          </div>
        )}
        <form onSubmit={onSubmit} className="space-y-4">
          <FormErrors messages={errors} />
          <Input label="Current password" type="password" required value={form.currentPassword}
            onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} autoComplete="current-password" />
          <Input label="New password" type="password" required value={form.newPassword} hint="At least 8 characters, with a letter and a digit"
            onChange={(e) => setForm({ ...form, newPassword: e.target.value })} autoComplete="new-password" />
          <Button type="submit" loading={busy} className="w-full">Change password</Button>
        </form>
    </AuthShell>
  );
}

export default function ChangePasswordPage() {
  return (
    <RequireAuth>
      <ChangePasswordForm />
    </RequireAuth>
  );
}
