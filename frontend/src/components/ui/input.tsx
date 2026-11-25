"use client";

import { useId } from "react";

const FIELD =
  "mt-1 block w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 shadow-sm " +
  "placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 " +
  "disabled:bg-slate-100 aria-[invalid=true]:border-red-500";

interface FieldProps {
  label: string;
  hint?: string;
  /** Error under the field (for example one of the backend's messages) */
  error?: string;
}

function FieldFooter({ id, hint, error }: { id: string; hint?: string; error?: string }) {
  if (error) return <p id={`${id}-msg`} className="mt-1 text-xs text-red-600">{error}</p>;
  if (hint) return <p id={`${id}-msg`} className="mt-1 text-xs text-slate-500">{hint}</p>;
  return null;
}

/** <Input label="Email" type="email" value={email} onChange={...} /> */
export function Input({ label, hint, error, id, className = "", ...props }: FieldProps & React.InputHTMLAttributes<HTMLInputElement>) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <div className={className}>
      <label htmlFor={fieldId} className="block text-sm font-medium text-slate-700">{label}</label>
      <input id={fieldId} aria-invalid={!!error} aria-describedby={`${fieldId}-msg`}
        className={`${FIELD} ${error ? "border-red-500" : "border-slate-300"}`} {...props} />
      <FieldFooter id={fieldId} hint={hint} error={error} />
    </div>
  );
}

/** <Select label="Currency" value={c} onChange={...}><option>USD</option></Select> */
export function Select({ label, hint, error, id, className = "", children, ...props }: FieldProps & React.SelectHTMLAttributes<HTMLSelectElement>) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <div className={className}>
      <label htmlFor={fieldId} className="block text-sm font-medium text-slate-700">{label}</label>
      <select id={fieldId} aria-invalid={!!error} aria-describedby={`${fieldId}-msg`}
        className={`${FIELD} ${error ? "border-red-500" : "border-slate-300"}`} {...props}>
        {children}
      </select>
      <FieldFooter id={fieldId} hint={hint} error={error} />
    </div>
  );
}

export function Textarea({ label, hint, error, id, className = "", ...props }: FieldProps & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <div className={className}>
      <label htmlFor={fieldId} className="block text-sm font-medium text-slate-700">{label}</label>
      <textarea id={fieldId} aria-invalid={!!error} aria-describedby={`${fieldId}-msg`}
        className={`${FIELD} min-h-24 ${error ? "border-red-500" : "border-slate-300"}`} {...props} />
      <FieldFooter id={fieldId} hint={hint} error={error} />
    </div>
  );
}

export function Checkbox({ label, id, className = "", ...props }: { label: React.ReactNode } & React.InputHTMLAttributes<HTMLInputElement>) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <div className={`flex items-start gap-2 ${className}`}>
      <input id={fieldId} type="checkbox" className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-brand-600" {...props} />
      <label htmlFor={fieldId} className="text-sm text-slate-700">{label}</label>
    </div>
  );
}
