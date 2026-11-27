"use client";

import { useState } from "react";
import { FormErrors } from "@/components/form-errors";
import {
  Alert,
  Button,
  Card,
  CardTitle,
  EmptyState,
  Input,
  LoadingState,
  PageHeader,
} from "@/components/ui";
import { useAuth } from "@/context/auth-context";
import { api, errorMessages } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import type { Airline } from "@/lib/types-airlines";

export default function ProfilePage() {
  const { user } = useAuth();
  const airlineId = user?.providerId;
  if (!airlineId) {
    return (
      <EmptyState
        title="No airline assigned"
        description="Ask an administrator to link your account to an airline."
      />
    );
  }
  return <ProfileLoader id={String(airlineId)} />;
}

function ProfileLoader({ id }: { id: string }) {
  const { data, errors, loading, reload } = useApi<Airline>(`/airlines/${id}`);
  if (loading) return <LoadingState />;
  if (errors) return <FormErrors messages={errors} />;
  if (!data) return null;
  return <ProfileForm airline={data} reload={reload} />;
}

function ProfileForm({ airline, reload }: { airline: Airline; reload: () => void }) {
  const [name, setName] = useState(airline.name);
  const [code, setCode] = useState(airline.code);
  const [description, setDescription] = useState(airline.description ?? "");
  const [errors, setErrors] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const [file, setFile] = useState<File | null>(null);
  const [logoErrors, setLogoErrors] = useState<string[]>([]);
  const [logoSaved, setLogoSaved] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErrors([]);
    setSaved(false);
    setBusy(true);
    try {
      await api.patch(`/airlines/${airline._id}`, {
        name,
        code: code.toUpperCase(),
        description,
      });
      setSaved(true);
      reload();
    } catch (err) {
      setErrors(errorMessages(err));
    } finally {
      setBusy(false);
    }
  }

  function pickFile(f: File | null) {
    setLogoErrors([]);
    setLogoSaved(false);
    if (f) {
      if (!["image/jpeg", "image/png"].includes(f.type)) {
        setLogoErrors(["Logo must be a JPG or PNG image."]);
        setFile(null);
        return;
      }
      if (f.size > 5 * 1024 * 1024) {
        setLogoErrors(["Logo must be 5 MB or smaller."]);
        setFile(null);
        return;
      }
    }
    setFile(f);
  }

  // Check: needs POST /api/airlines/:id/logo in Swagger (field name "file").
  async function uploadLogo() {
    if (!file) return;
    setLogoErrors([]);
    setLogoSaved(false);
    setLogoBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/airlines/${airline._id}/logo`, {
        method: "POST",
        body: form,
        credentials: "include",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const msg = body?.message;
        setLogoErrors(Array.isArray(msg) ? msg : [msg ?? "Upload failed."]);
        return;
      }
      setLogoSaved(true);
      setFile(null);
      reload();
    } catch {
      setLogoErrors(["Upload failed. Check your connection."]);
    } finally {
      setLogoBusy(false);
    }
  }

  const preview = file ? URL.createObjectURL(file) : airline.logoUrl;

  return (
    <>
      <PageHeader title="Airline profile" description="Name, code and logo of your airline" />
      <div className="space-y-6">
        <Card>
          <CardTitle>Details</CardTitle>
          <form onSubmit={save} className="mt-4 space-y-4">
            <FormErrors messages={errors} />
            {saved && <Alert tone="success">Profile saved.</Alert>}
            <Input label="Name" required value={name} onChange={(e) => setName(e.target.value)} />
            <Input
              label="Code (IATA, 2-3 letters)"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <Input
              label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <Button type="submit" loading={busy}>
              Save
            </Button>
          </form>
        </Card>

        <Card>
          <CardTitle>Logo</CardTitle>
          <div className="mt-4 space-y-4">
            <FormErrors messages={logoErrors} />
            {logoSaved && <Alert tone="success">Logo uploaded.</Alert>}
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="Airline logo" className="h-24 w-24 rounded-lg border object-contain" />
            ) : (
              <p className="text-sm">No logo yet.</p>
            )}
            <input
              type="file"
              accept="image/png,image/jpeg"
              onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
            />
            <Button type="button" loading={logoBusy} disabled={!file} onClick={uploadLogo}>
              Upload logo
            </Button>
          </div>
        </Card>
      </div>
    </>
  );
}