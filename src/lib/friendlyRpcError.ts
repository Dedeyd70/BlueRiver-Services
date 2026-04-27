/**
 * Maps backend errors thrown by RPCs into clean, user-friendly toast messages.
 *
 * RPCs raise errors with the convention `NOT_AUTHORIZED: <human message>`.
 * Anything else falls back to the original message (or a generic one).
 */
export const friendlyRpcError = (e: unknown): string => {
  const raw = e instanceof Error ? e.message : typeof e === "string" ? e : "";
  if (!raw) return "Something went wrong. Please try again.";

  const notAuth = raw.match(/NOT_AUTHORIZED:\s*(.+)/i);
  if (notAuth) return notAuth[1].trim();

  // Postgres permission denied / RLS
  if (/permission denied|row-level security/i.test(raw)) {
    return "You don't have permission to do that.";
  }

  return raw;
};
