"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { FormErrors } from "@/components/form-errors";
import { AuthShell } from "@/components/auth-shell";
import { Button, Input, LoadingState } from "@/components/ui";
import { useAuth } from "@/context/auth-context";
import { errorMessages } from "@/lib/api";

function LoginForm() {
  const { login } = useAuth();
  const router = useRouter();
  const next = useSearchParams().get("next") ?? "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors([]);
    setBusy(true);
    try {
      const user = await login(email, password);
      // Only go to local pages (never an outside URL from the query string)
      router.push(user.mustChangePassword ? "/change-password" : next.startsWith("/") ? next : "/");
    } catch (err) {
      setErrors(errorMessages(err)); // wrong password, locked (ACC-05), suspended...
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <FormErrors messages={errors} />
      <Input label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
      <Input label="Password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
        autoComplete="current-password" />
      <Button type="submit" loading={busy} className="w-full">Log in</Button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <AuthShell title="Welcome back" subtitle="Log in to manage your bookings and trips.">
      <Suspense fallback={<LoadingState />}>
        <LoginForm />
      </Suspense>
      <p className="mt-6 text-sm text-slate-600">
        No account yet? <Link href="/register" className="font-medium text-brand-700 hover:underline">Create one</Link>
      </p>
    </AuthShell>
  );
}
