/**
 * Centralized Supabase connection config.
 *
 * Swap the values here (or the env vars they read from) when migrating to a
 * self-hosted Supabase project. Do NOT hardcode the URL or anon key in other
 * files — always import from here (or from the auto-generated client.ts which
 * already reads the same env vars).
 */
export const SUPABASE_CONFIG = {
  url: import.meta.env.VITE_SUPABASE_URL as string,
  anonKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
  projectId: import.meta.env.VITE_SUPABASE_PROJECT_ID as string,
};
