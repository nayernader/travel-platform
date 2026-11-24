"use client";

import { useEffect, useState } from "react";
import { api, errorMessages } from "@/lib/api";
import { useAuth } from "@/context/auth-context";

interface Country {
  _id: string;
  name: string;
  currency?: string;
}

export default function HomePage() {
  const { user } = useAuth();
  const [countries, setCountries] = useState<Country[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Integration check: reads public reference data from the backend through the /api proxy
  useEffect(() => {
    api
      .get<Country[]>("/reference/countries")
      .then(setCountries)
      .catch((e: unknown) => setError(errorMessages(e)[0]));
  }, []);

  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="text-3xl font-bold">Travel Platform</h1>
      <p className="mt-2 text-gray-600">
        {user ? `Welcome back, ${user.name}.` : "Plan trips, book flights and hotels, and share itineraries."}
      </p>

      <section className="mt-8 rounded-lg border bg-white p-4">
        <h2 className="font-semibold">Backend connection</h2>
        {error ? (
          <p className="mt-2 text-red-600">Backend not reachable: {error}. Is it running on port 3001?</p>
        ) : !countries ? (
          <p className="mt-2 text-gray-500">Checking…</p>
        ) : (
          <p className="mt-2 text-green-700">
            Connected. {countries.length} countries loaded: {countries.map((c) => c.name).join(", ")}
          </p>
        )}
      </section>
    </div>
  );
}
