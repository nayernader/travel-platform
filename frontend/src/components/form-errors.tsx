import { Alert } from "./ui/alert";

/** Shows the backend's validation messages above a form. */
export function FormErrors({ messages }: { messages: string[] }) {
  if (!messages.length) return null;
  return (
    <Alert tone="error">
      <ul className={messages.length > 1 ? "list-disc pl-5" : ""}>
        {messages.map((m) => (
          <li key={m}>{m}</li>
        ))}
      </ul>
    </Alert>
  );
}
