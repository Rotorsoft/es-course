export function Toast({ message }: { message: string | null }) {
  if (!message) return null;
  return <div className="toast">{"\u2713"} {message}</div>;
}
