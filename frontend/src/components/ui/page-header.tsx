/** Title row at the top of a page: <PageHeader title="My bookings" actions={<ButtonLink ...>} /> */
export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-600">{description}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}

/** Centered page width used by most pages */
export function PageContainer({ size = "lg", children }: { size?: "sm" | "md" | "lg"; children: React.ReactNode }) {
  const width = { sm: "max-w-md", md: "max-w-3xl", lg: "max-w-6xl" }[size];
  return <div className={`mx-auto w-full ${width} px-4 py-8`}>{children}</div>;
}
