import { supabase } from "@/integrations/supabase/client";

/**
 * Creates a broadcast notification visible to all admin/manager/staff users.
 * user_id is null = broadcast to all admin roles.
 */
export const notifyAdmins = async (type: string, message: string, referenceId?: string, referenceType?: string) => {
  try {
    await supabase.from("notifications").insert({
      type,
      message,
      reference_id: referenceId ?? null,
      reference_type: referenceType ?? null,
      user_id: null,
    } as any);
  } catch (e) {
    console.error("Notification error:", e);
  }
};
