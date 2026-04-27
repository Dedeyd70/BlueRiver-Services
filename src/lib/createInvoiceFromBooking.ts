import { supabase } from "@/integrations/supabase/client";

/**
 * SAFE-MODE: creates an invoice from a booking via the database RPC.
 *
 * The RPC `create_invoice_from_booking`:
 *   - Returns the existing invoice if one already exists for the booking (idempotent).
 *   - Otherwise INSERTs a new invoice using the booking's frozen line_items + total_price.
 *   - Generates the invoice_number via the database function (never client-side).
 *   - NEVER recalculates pricing.
 *
 * This wrapper preserves the legacy signature `(booking, createdBy?)` so existing
 * callers don't change. `createdBy` is currently unused because the RPC sets
 * created_by to NULL by design (financial records are owned by the system, not the actor).
 */
export const createInvoiceFromBooking = async (booking: any, _createdBy?: string | null) => {
  if (!booking?.id) throw new Error("Booking id is required");

  const { data, error } = await (supabase as any).rpc("create_invoice_from_booking", {
    p_booking_id: booking.id,
  });

  if (error) throw error;
  return data;
};
