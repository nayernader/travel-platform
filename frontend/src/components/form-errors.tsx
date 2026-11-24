/** Shows the backend's validation messages under a form. */
export function FormErrors({ messages }: { messages: string[] }) {
  if (!messages.length) return null;
  return (
    <ul role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
      {messages.map((m) => (
        <li key={m}>{m}</li>
      ))}
    </ul>
  );
}
