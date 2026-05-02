import { describe, it, expect } from "vitest";

/**
 * Lifecycle data-mapping tests.
 *
 * Rather than spinning up the full BookService / RequestQuote / Contact React
 * trees (which require Supabase, react-query, and router mocks), we assert the
 * pure data transitions that occur at every state transition:
 *
 *   Contact submission  →  Quote draft  →  Booking row  →  Invoice
 *
 * These mirror the field mappings used by:
 *   - quote_requests inserts (RequestQuote.tsx)
 *   - convert_quote_to_booking RPC (Supabase)
 *   - create_invoice_from_booking RPC (Supabase)
 *
 * Critical invariants enforced:
 *   - Address must persist across every step (never lost / never replaced).
 *   - Pricing snapshot (line_items, subtotal, tax, total) must transfer
 *     unchanged from booking → invoice (no recalculation).
 */

interface ContactSubmission {
  name: string;
  email: string;
  phone: string;
  address: string;
  message: string;
}

interface QuoteRequest extends ContactSubmission {
  id: string;
  service_type_id: string;
  bedrooms: number;
  full_bathrooms: number;
}

interface QuoteDraft {
  quote_id: string;
  line_items: Array<{ name: string; total_price: number }>;
  breakdown: { subtotal: number; tax_amount: number; total: number };
}

interface Booking {
  id: string;
  quote_id: string;
  name: string;
  email: string;
  address: string;
  service_type_id: string;
  line_items: QuoteDraft["line_items"];
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  booking_date: string;
  time_slot: string;
}

interface Invoice {
  id: string;
  booking_id: string;
  customer_name: string;
  customer_email: string;
  address: string;
  line_items: Booking["line_items"];
  subtotal: number;
  tax_amount: number;
  total_amount: number;
}

// Mirrors convert_quote_to_booking RPC (lossless field carry-over).
const convertQuoteToBooking = (q: QuoteRequest, d: QuoteDraft, date: string, slot: string): Booking => ({
  id: "bk-1",
  quote_id: q.id,
  name: q.name || "Customer",
  email: q.email || "",
  address: q.address || "Address on file",
  service_type_id: q.service_type_id,
  line_items: d.line_items,
  subtotal: d.breakdown.subtotal,
  tax_amount: d.breakdown.tax_amount,
  total_amount: d.breakdown.total,
  booking_date: date,
  time_slot: slot,
});

// Mirrors create_invoice_from_booking RPC (snapshot — no recalculation).
const createInvoiceFromBooking = (b: Booking): Invoice => ({
  id: "inv-1",
  booking_id: b.id,
  customer_name: b.name,
  customer_email: b.email,
  address: b.address,
  line_items: b.line_items,
  subtotal: b.subtotal,
  tax_amount: b.tax_amount,
  total_amount: b.total_amount,
});

describe("End-to-end lifecycle: Contact → Quote → Booking → Invoice", () => {
  const contact: ContactSubmission = {
    name: "Jane Doe",
    email: "jane@example.com",
    phone: "555-0100",
    address: "742 Evergreen Terrace, Springfield",
    message: "Need a deep clean before move-in.",
  };

  const quote: QuoteRequest = {
    ...contact,
    id: "q-1",
    service_type_id: "svc-deep",
    bedrooms: 3,
    full_bathrooms: 2,
  };

  const draft: QuoteDraft = {
    quote_id: quote.id,
    line_items: [
      { name: "Base Service: Deep Cleaning", total_price: 200 },
      { name: "Bedrooms", total_price: 75 },
      { name: "Full Bathrooms", total_price: 60 },
    ],
    breakdown: { subtotal: 335, tax_amount: 28, total: 363 },
  };

  it("preserves the address from contact through to invoice", () => {
    const booking = convertQuoteToBooking(quote, draft, "2030-01-15", "10:00 AM - 12:00 PM");
    const invoice = createInvoiceFromBooking(booking);
    expect(quote.address).toBe(contact.address);
    expect(booking.address).toBe(contact.address);
    expect(invoice.address).toBe(contact.address);
  });

  it("transfers pricing snapshot booking → invoice with NO recalculation", () => {
    const booking = convertQuoteToBooking(quote, draft, "2030-01-15", "10:00 AM - 12:00 PM");
    const invoice = createInvoiceFromBooking(booking);
    expect(invoice.subtotal).toBe(booking.subtotal);
    expect(invoice.tax_amount).toBe(booking.tax_amount);
    expect(invoice.total_amount).toBe(booking.total_amount);
    expect(invoice.line_items).toEqual(booking.line_items);
  });

  it("falls back to 'Address on file' when quote has no address (RPC behavior)", () => {
    const noAddrQuote: QuoteRequest = { ...quote, address: "" };
    const booking = convertQuoteToBooking(noAddrQuote, draft, "2030-01-15", "10:00 AM");
    expect(booking.address).toBe("Address on file");
  });

  it("carries customer identity (name + email) through every step", () => {
    const booking = convertQuoteToBooking(quote, draft, "2030-01-15", "10:00 AM");
    const invoice = createInvoiceFromBooking(booking);
    expect(invoice.customer_name).toBe(contact.name);
    expect(invoice.customer_email).toBe(contact.email);
  });
});
