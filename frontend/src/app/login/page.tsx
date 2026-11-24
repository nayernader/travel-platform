"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { FormErrors } from "@/components/form-errors";
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
      <label className="block">
        <span className="text-sm font-medium">Email</span>
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded-md border px-3 py-2" autoComplete="email" />
      </label>
      <label className="block">
        <span className="text-sm font-medium">Password</span>
        <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded-md border px-3 py-2" autoComplete="current-password" />
      </label>
      <button disabled={busy} className="w-full rounded-md bg-blue-600 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-60">
        {busy ? "Logging in…" : "Log in"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-sm p-6">
      <h1 className="mb-6 text-2xl font-bold">Log in</h1>
      <Suspense fallback={<p className="text-gray-500">Loading…</p>}>
        <LoginForm />
      </Suspense>
      <p className="mt-4 text-sm text-gray-600">
        No account yet? <Link href="/register" className="text-blue-700 hover:underline">Register</Link>
      </p>
    </div>
  );
}
