import { supabase } from "@/integrations/supabase/client";

/**
 * Creates a notification for all admin/manager/staff users.
 * Called from public forms (booking, quote) — uses anon insert policy.
 */
export const notifyAdminUsers = async (type: string, message: string, referenceId?: string, referenceType?: string) => {
  try {
    // We insert a notification with user_id = null.
    // The RLS policies for the notifications table should be configured to allow
    // admins to read notifications where user_id IS NULL or matches their own ID.
    await supabase.from("notifications").insert({
      type,
      message,
      reference_id: referenceId || null,
      reference_type: referenceType || null,
      user_id: null,
    } as any);
  } catch (e) {
    // Silent fail — notifications are non-critical
    console.error("Notification error:", e);
  }
};
