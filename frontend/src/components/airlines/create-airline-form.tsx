"use client";

import { useState } from "react";
import { FormErrors } from "@/components/form-errors";
import { Alert, Button, Card, CardTitle, Input } from "@/components/ui";
import { api, errorMessages } from "@/lib/api";

/** FLT-01 (admin): create an airline profile. Member 8 shows it on /admin/providers. */
export function CreateAirlineForm({ onCreated }: { onCreated?: () => void }) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErrors([]);
    setSaved(false);
    setBusy(true);
    try {
      await api.post("/airlines", {
        name,
        code: code.toUpperCase(),
        ...(description ? { description } : {}),
      });
      setSaved(true);
      setName("");
      setCode("");
      setDescription("");
      onCreated?.();
    } catch (err) {
      setErrors(errorMessages(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardTitle>Create airline</CardTitle>
      <form onSubmit={submit} className="mt-4 space-y-4">
        <FormErrors messages={errors} />
        {saved && <Alert tone="success">Airline created.</Alert>}
        <Input label="Name" required value={name} onChange={(e) => setName(e.target.value)} />
        <Input
          label="Code (IATA, 2-3 letters)"
          required
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <Input label="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
        <Button type="submit" loading={busy}>
          Create airline
        </Button>
      </form>
    </Card>
  );
}