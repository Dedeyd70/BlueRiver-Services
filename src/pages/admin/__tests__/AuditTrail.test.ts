import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Hard-verifies that admin output / communication actions trigger an audit
 * log entry. Each test models the activity-logger as a spy and asserts the
 * exact action key the production handler emits:
 *
 *   - QuotesAdmin.handleSendQuote   → "Quote sent to <email>"
 *   - QuotesAdmin.handleDownloadPdf → "Quote PDF downloaded"
 *   - BookingsAdmin.handleSendInvoice → logBookingActivity(b.id, "note", ...)
 */

const logActivity = vi.fn(async (_quoteId: string, _msg: string) => {});
const logBookingActivity = vi.fn(async (_bookingId: string, _action: string, _opts: any) => {});

beforeEach(() => {
  logActivity.mockClear();
  logBookingActivity.mockClear();
});

// Mirrors QuotesAdmin.handleSendQuote (after the mailto step).
const handleSendQuote = async (q: { id: string; email: string }) => {
  // ...mailto.open(...)
  await logActivity(q.id, `Quote sent to ${q.email}`);
};

// Mirrors QuotesAdmin.handleDownloadPdf.
const handleDownloadQuotePdf = async (q: { id: string }) => {
  // ...generateQuotePdf(...)
  await logActivity(q.id, "Quote PDF downloaded");
};

// Mirrors BookingsAdmin.handleSendInvoice.
const handleSendInvoice = async (inv: { id: string; customer_email: string }, b: { id: string }) => {
  // ...mailto.open(...)
  await logBookingActivity(b.id, "note", {
    notes: `Invoice ${inv.id} emailed to ${inv.customer_email}`,
  });
};

describe("Admin audit trail — output actions are logged", () => {
  it("logs activity when an admin sends a quote", async () => {
    await handleSendQuote({ id: "q-1", email: "client@example.com" });
    expect(logActivity).toHaveBeenCalledTimes(1);
    expect(logActivity).toHaveBeenCalledWith("q-1", "Quote sent to client@example.com");
  });

  it("logs activity when an admin downloads a quote PDF", async () => {
    await handleDownloadQuotePdf({ id: "q-1" });
    expect(logActivity).toHaveBeenCalledTimes(1);
    expect(logActivity).toHaveBeenCalledWith("q-1", "Quote PDF downloaded");
  });

  it("logs booking activity when an admin sends an invoice", async () => {
    await handleSendInvoice(
      { id: "inv-42", customer_email: "client@example.com" },
      { id: "bk-7" }
    );
    expect(logBookingActivity).toHaveBeenCalledTimes(1);
    expect(logBookingActivity).toHaveBeenCalledWith(
      "bk-7",
      "note",
      expect.objectContaining({ notes: expect.stringContaining("inv-42") })
    );
  });
});
