import { supabase } from "@/integrations/supabase/client";

/**
 * Creates an invoice automatically from a completed booking.
 * - If booking originates from a quote with a draft containing line_items, mirror those exactly.
 * - Otherwise, fall back to building services from booking.service_type + addons.
 * - Applies tax rate from site_settings.tax_rate (or quote draft tax_rate when applicable).
 */
export const createInvoiceFromBooking = async (booking: any, createdBy?: string | null) => {
  // Read tax rate (site default)
  const { data: settings } = await supabase
    .from("site_settings")
    .select("setting_key, setting_value")
    .in("setting_key", ["tax_rate"]);
  const siteTaxRate = Number(settings?.find((s) => s.setting_key === "tax_rate")?.setting_value || 0);

  let services: any[] = [];
  let subtotal = 0;
  let taxRate = siteTaxRate;

  // If booking is linked to a quote, prefer the prepared draft's line_items
  if (booking.quote_id) {
    const { data: draft } = await (supabase as any)
      .from("quote_drafts")
      .select("*")
      .eq("quote_id", booking.quote_id)
      .maybeSingle();

    if (draft && Array.isArray(draft.line_items) && draft.line_items.length > 0) {
      services = draft.line_items.map((i: any) => ({
        title: i.name,
        quantity: Number(i.quantity) || 1,
        unit_price: Number(i.unit_price) || 0,
        price: Number(i.total_price) || 0,
        type: i.type,
      }));
      subtotal = services.reduce((s, it) => s + Number(it.price || 0), 0);
      taxRate = Number(draft.tax_rate ?? siteTaxRate);
    }
  }

  // Fallback to legacy structure
  if (services.length === 0) {
    const addons = Array.isArray(booking.selected_addons) ? booking.selected_addons : [];
    services = [
      ...(booking.service_type ? [{ title: booking.service_type, price: 0 }] : []),
      ...addons.map((a: any) => ({ title: a.title || "", price: Number(a.price) || 0 })),
    ];
    subtotal = Number(booking.total_price) || services.reduce((sum, s) => sum + s.price, 0);
  }

  const taxAmount = +(subtotal * (taxRate / 100)).toFixed(2);
  const totalAmount = +(subtotal + taxAmount).toFixed(2);

  const { data, error } = await supabase
    .from("invoices")
    .insert({
      customer_name: booking.name,
      customer_email: booking.email,
      services: services as any,
      subtotal,
      tax_rate: taxRate,
      tax_amount: taxAmount,
      total_amount: totalAmount,
      booking_id: booking.id,
      quote_id: booking.quote_id ?? null,
      service_type_id: booking.service_type_id ?? null,
      payment_status: "unpaid",
      created_by: createdBy ?? null,
    } as any)
    .select()
    .single();

  if (error) throw error;
  return data;
};
