"use client";

import { Card, Input } from "@/components/ui";
import type { PassengerKind } from "@/lib/types-flights";

export interface PassengerForm {
  type: PassengerKind;
  fullName: string;
  dateOfBirth: string;
  passportNumber: string;
  extraBags: string;
  extraBagWeightKg: string;
}

export type PassengerErrors = Partial<
  Record<"fullName" | "dateOfBirth" | "passportNumber" | "extraBags" | "extraBagWeightKg", string>
>;

export const TYPE_LABEL: Record<PassengerKind, string> = {
  ADULT: "Adult (12+)",
  CHILD: "Child (2-11)",
  INFANT: "Infant (under 2)",
};

export function emptyPassenger(type: PassengerKind): PassengerForm {
  return { type, fullName: "", dateOfBirth: "", passportNumber: "", extraBags: "", extraBagWeightKg: "" };
}

/** Age in whole years on the flight's UTC date, or an error text (same rule as the backend). */
function ageOn(dob: string, departureIso: string): { age?: number; error?: string } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob);
  if (!m) return { error: "Enter the date of birth" };
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const check = new Date(Date.UTC(y, mo - 1, d));
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) {
    return { error: "This date does not exist" };
  }
  const dep = new Date(departureIso);
  const depDay = Date.UTC(dep.getUTCFullYear(), dep.getUTCMonth(), dep.getUTCDate());
  if (check.getTime() > depDay) return { error: "Date of birth cannot be after the flight date" };
  let age = dep.getUTCFullYear() - y;
  if (dep.getUTCMonth() + 1 < mo || (dep.getUTCMonth() + 1 === mo && dep.getUTCDate() < d)) age--;
  return { age };
}

function typeForAge(age: number): PassengerKind {
  if (age < 2) return "INFANT";
  if (age < 12) return "CHILD";
  return "ADULT";
}

/** FLT-12(b) + FLT-19 checks, same limits as the backend DTO. */
export function validatePassenger(p: PassengerForm, departureIso: string, maxBagWeightKg: number | null): PassengerErrors {
  const e: PassengerErrors = {};
  const name = p.fullName.trim();
  if (name.length < 2 || name.length > 100) e.fullName = "Full name must be 2 to 100 characters";
  if (!/^[A-Za-z0-9]{5,20}$/.test(p.passportNumber.trim())) {
    e.passportNumber = "Passport or ID must be 5 to 20 letters or digits";
  }

  const { age, error } = ageOn(p.dateOfBirth, departureIso);
  if (error) e.dateOfBirth = error;
  else if (age !== undefined && typeForAge(age) !== p.type) {
    e.dateOfBirth = `On the flight date this passenger is ${age}, so must be booked as ${TYPE_LABEL[typeForAge(age)]}`;
  }

  if (p.type !== "INFANT" && p.extraBags !== "") {
    const bags = Number(p.extraBags);
    if (!Number.isInteger(bags) || bags < 0 || bags > 10) e.extraBags = "Enter a whole number from 0 to 10";
    else if (bags > 0) {
      const w = Number(p.extraBagWeightKg);
      if (p.extraBagWeightKg === "" || !Number.isFinite(w) || w <= 0) {
        e.extraBagWeightKg = "Enter the weight of each extra bag";
      } else if (maxBagWeightKg !== null && w > maxBagWeightKg) {
        e.extraBagWeightKg = `At most ${maxBagWeightKg} kg per bag`;
      }
    }
  }
  return e;
}

export function PassengerFields({
  index,
  value,
  errors,
  maxBagWeightKg,
  onChange,
}: {
  index: number;
  value: PassengerForm;
  errors: PassengerErrors;
  maxBagWeightKg: number | null;
  onChange: (next: PassengerForm) => void;
}) {
  const set = (patch: Partial<PassengerForm>) => onChange({ ...value, ...patch });
  const today = new Date().toISOString().slice(0, 10);
  return (
    <Card>
      <h3 className="font-display text-lg font-semibold text-slate-900">
        Passenger {index + 1} · {TYPE_LABEL[value.type]}
      </h3>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input
          label="Full name"
          value={value.fullName}
          error={errors.fullName}
          onChange={(e) => set({ fullName: e.target.value })}
          autoComplete="off"
        />
        <Input
          label="Date of birth"
          type="date"
          max={today}
          value={value.dateOfBirth}
          error={errors.dateOfBirth}
          onChange={(e) => set({ dateOfBirth: e.target.value })}
        />
        <Input
          label="Passport / ID number"
          value={value.passportNumber}
          error={errors.passportNumber}
          onChange={(e) => set({ passportNumber: e.target.value })}
          autoComplete="off"
        />
      </div>

      {value.type === "INFANT" ? (
        <p className="mt-3 text-xs text-slate-500">Infants take no seat and have no extra baggage.</p>
      ) : (
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label="Extra bags (optional)"
            type="number"
            min={0}
            max={10}
            value={value.extraBags}
            error={errors.extraBags}
            hint="Beyond the free allowance. The fee is shown in the summary."
            onChange={(e) => set({ extraBags: e.target.value })}
          />
          <Input
            label="Weight of each extra bag (kg)"
            type="number"
            min={0}
            value={value.extraBagWeightKg}
            error={errors.extraBagWeightKg}
            hint={maxBagWeightKg !== null ? `Up to ${maxBagWeightKg} kg per bag` : undefined}
            onChange={(e) => set({ extraBagWeightKg: e.target.value })}
          />
        </div>
      )}
    </Card>
  );
}