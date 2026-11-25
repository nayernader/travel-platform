"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormErrors } from "@/components/form-errors";
import { AuthShell } from "@/components/auth-shell";
import { Button, Checkbox, Input } from "@/components/ui";
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
    <AuthShell title="Create your account" subtitle="It takes less than a minute.">
        <form onSubmit={onSubmit} className="space-y-4">
          <FormErrors messages={errors} />
          <Input label="Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoComplete="name" />
          <Input label="Email" type="email" required value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="email" />
          <Input label="Password" type="password" required value={form.password} hint="At least 8 characters, with a letter and a digit"
            onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete="new-password" />
          <Checkbox label="I accept the terms and the privacy policy" checked={form.consentAccepted}
            onChange={(e) => setForm({ ...form, consentAccepted: e.target.checked })} />
          <Button type="submit" loading={busy} className="w-full">Register</Button>
        </form>
        <p className="mt-6 text-sm text-slate-600">
          Already registered? <Link href="/login" className="font-medium text-brand-700 hover:underline">Log in</Link>
        </p>
    </AuthShell>
  );
}
