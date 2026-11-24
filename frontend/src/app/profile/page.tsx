"use client";

import { useState } from "react";
import { FormErrors } from "@/components/form-errors";
import { RequireAuth } from "@/components/require-auth";
import { useAuth } from "@/context/auth-context";
import { api, errorMessages } from "@/lib/api";
import { SUPPORTED_CURRENCIES, type User } from "@/lib/types";

function ProfileForm({ user }: { user: User }) {
  const { reloadUser } = useAuth();
  const [form, setForm] = useState({
    name: user.name,
    phone: user.phone ?? "",
    preferredCurrency: user.preferredCurrency ?? "USD",
  });
  const [errors, setErrors] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors([]);
    setSaved(false);
    setBusy(true);
    try {
      // ACC-09: only these three fields can change; empty phone is not sent
      await api.patch<User>("/users/me", {
        name: form.name,
        ...(form.phone ? { phone: form.phone } : {}),
        preferredCurrency: form.preferredCurrency,
      });
      await reloadUser();
      setSaved(true);
    } catch (err) {
      setErrors(errorMessages(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md p-6">
      <h1 className="text-2xl font-bold">My profile</h1>
      <p className="mt-1 text-sm text-gray-600">{user.email} · {user.role}</p>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <FormErrors messages={errors} />
        {saved && <p className="rounded-md bg-green-50 p-3 text-sm text-green-700">Saved.</p>}
        <label className="block">
          <span className="text-sm font-medium">Name</span>
          <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="mt-1 w-full rounded-md border px-3 py-2" />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Phone</span>
          <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="mt-1 w-full rounded-md border px-3 py-2" placeholder="+201001234567" />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Preferred currency</span>
          <select value={form.preferredCurrency} onChange={(e) => setForm({ ...form, preferredCurrency: e.target.value })}
            className="mt-1 w-full rounded-md border px-3 py-2">
            {SUPPORTED_CURRENCIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
        <button disabled={busy} className="rounded-md bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-60">
          {busy ? "Saving…" : "Save"}
        </button>
      </form>
    </div>
  );
}

function ProfileContent() {
  const { user } = useAuth();
  return user ? <ProfileForm key={user.id} user={user} /> : null;
}

export default function ProfilePage() {
  return (
    <RequireAuth>
      <ProfileContent />
    </RequireAuth>
  );
}
