"use client";

import Link from "next/link";
import { useState } from "react";
import { FormErrors } from "@/components/form-errors";
import { RequireAuth } from "@/components/require-auth";
import { Alert, Badge, Button, Card, Input, PageContainer, PageHeader, Select } from "@/components/ui";
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
      // ACC-09: only these three fields can change; an empty phone is not sent
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
    <PageContainer size="sm">
      <PageHeader title="My profile" description={user.email} actions={<Badge tone="brand">{user.role}</Badge>} />
      <Card>
        <form onSubmit={onSubmit} className="space-y-4">
          <FormErrors messages={errors} />
          {saved && <Alert tone="success">Saved.</Alert>}
          <Input label="Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label="Phone" value={form.phone} placeholder="+201001234567"
            onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Select label="Preferred currency" value={form.preferredCurrency}
            onChange={(e) => setForm({ ...form, preferredCurrency: e.target.value })}>
            {SUPPORTED_CURRENCIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
          <div className="flex items-center justify-between gap-3">
            <Button type="submit" loading={busy}>Save</Button>
            <Link href="/change-password" className="text-sm font-medium text-brand-700 hover:underline">Change password</Link>
          </div>
        </form>
      </Card>
    </PageContainer>
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
