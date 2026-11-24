"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormErrors } from "@/components/form-errors";
import { api, errorMessages } from "@/lib/api";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "", consentAccepted: false });
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Quick checks for a nicer form; the backend checks the same rules again (ACC-01, GEN-13)
    const local: string[] = [];
    if (!/^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(form.password)) {
      local.push("Password must have at least 8 characters, including a letter and a digit");
    }
    if (!form.consentAccepted) local.push("You must accept the terms and privacy policy");
    setErrors(local);
    if (local.length) return;

    setBusy(true);
    try {
      await api.post("/auth/register", form);
      router.push("/login");
    } catch (err) {
      setErrors(errorMessages(err)); // e.g. 409 email already registered
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm p-6">
      <h1 className="mb-6 text-2xl font-bold">Create an account</h1>
      <form onSubmit={onSubmit} className="space-y-4">
        <FormErrors messages={errors} />
        <label className="block">
          <span className="text-sm font-medium">Name</span>
          <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="mt-1 w-full rounded-md border px-3 py-2" autoComplete="name" />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Email</span>
          <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="mt-1 w-full rounded-md border px-3 py-2" autoComplete="email" />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Password</span>
          <input type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="mt-1 w-full rounded-md border px-3 py-2" autoComplete="new-password" />
          <span className="text-xs text-gray-500">At least 8 characters, with a letter and a digit</span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={form.consentAccepted}
            onChange={(e) => setForm({ ...form, consentAccepted: e.target.checked })} className="mt-1" />
          <span>I accept the terms and the privacy policy</span>
        </label>
        <button disabled={busy} className="w-full rounded-md bg-blue-600 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-60">
          {busy ? "Creating…" : "Register"}
        </button>
      </form>
      <p className="mt-4 text-sm text-gray-600">
        Already registered? <Link href="/login" className="text-blue-700 hover:underline">Log in</Link>
      </p>
    </div>
  );
}
