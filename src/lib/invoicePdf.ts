import jsPDF from "jspdf";
import { format } from "date-fns";

interface BrandingMap { [key: string]: string }
interface SettingsMap { [key: string]: string }

// ---- BlueRiver theme (defaults; brand color overridable via site_settings.brand_color_hex) ----
const NAVY: [number, number, number] = [15, 23, 42];       // #0F172A
const DEFAULT_PRIMARY: [number, number, number] = [30, 58, 138]; // #1E3A8A
const SLATE_300: [number, number, number] = [203, 213, 225];
const SLATE_500: [number, number, number] = [100, 116, 139];
const SLATE_100: [number, number, number] = [241, 245, 249];

const hexToRgb = (hex?: string): [number, number, number] | null => {
  if (!hex) return null;
  const m = hex.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(m)) return null;
  return [parseInt(m.slice(0, 2), 16), parseInt(m.slice(2, 4), 16), parseInt(m.slice(4, 6), 16)];
};

const resolvePrimary = (settings: SettingsMap): [number, number, number] =>
  hexToRgb(settings?.brand_color_hex) ?? DEFAULT_PRIMARY;

const drawLetterhead = (
  doc: jsPDF,
  pageW: number,
  branding: BrandingMap,
  settings: SettingsMap
): number => {
  const PRIMARY = resolvePrimary(settings);
  const bandH = 28;
  // Navy band
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pageW, bandH, "F");

  // Logo placeholder badge ("BR")
  const badgeX = 14;
  const badgeY = 6;
  const badgeSize = 16;
  doc.setFillColor(...PRIMARY);
  doc.roundedRect(badgeX, badgeY, badgeSize, badgeSize, 3, 3, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("BR", badgeX + badgeSize / 2, badgeY + badgeSize / 2 + 1.5, { align: "center" });

  // Business name
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(255, 255, 255);
  doc.text(branding.business_name || "BlueRiver Services LLC", badgeX + badgeSize + 6, 13);

  // Tagline + contact in slate-300
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...SLATE_300);
  const tagline = settings.footer_tagline || "Professional cleaning services";
  doc.text(tagline, badgeX + badgeSize + 6, 18.5);
  const contactLine = [settings.phone, settings.email, settings.company_address]
    .filter(Boolean)
    .join("  ·  ");
  if (contactLine) {
    doc.text(contactLine, badgeX + badgeSize + 6, 23);
  }

  // Reset text color for body
  doc.setTextColor(0, 0, 0);
  return bandH + 8; // y position for body content
};

/**
 * Branded invoice PDF builder. Returns the configured jsPDF instance so it
 * can be either saved to disk or exported as base64 for email attachment.
 *
 * NOTE (cost-efficiency): jsPDF is initialised with `compress: true` to keep
 * attachments small for the Resend free tier (<100KB target). If a raster
 * logo is ever added here, use `addImage(..., 'JPEG', ..., 'FAST')` with
 * quality ~0.6 to stay under that budget.
 */
const buildInvoiceDoc = (
  inv: any,
  branding: BrandingMap,
  settings: SettingsMap
): jsPDF => {
  const doc = new jsPDF({ compress: true });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 20;
  const PRIMARY = resolvePrimary(settings);
  let y = drawLetterhead(doc, pageW, branding, settings);

  // Invoice header
  const invoiceNum = inv.invoice_number || `BR-${inv.id?.slice(0, 8).toUpperCase()}`;
  const issued = inv.issued_date
    ? format(new Date(inv.issued_date), "MMM d, yyyy")
    : format(new Date(), "MMM d, yyyy");
  const due = inv.due_date ? format(new Date(inv.due_date), "MMM d, yyyy") : "—";

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...PRIMARY);
  doc.text(`INVOICE  #${invoiceNum}`, margin, y);
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Issued: ${issued}`, pageW - margin, y - 4, { align: "right" });
  doc.text(`Due: ${due}`, pageW - margin, y + 2, { align: "right" });
  y += 12;

  // Bill to / Service location
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Bill to:", margin, y);
  doc.text("Service location:", pageW / 2, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.text(inv.customer_name || "—", margin, y);
  // Service location now reads from `invoices.address` (copied from booking
  // via create_invoice_from_booking RPC). Falls back to "—" when missing.
  const serviceAddress = String(inv.address || inv.service_address || "—");
  const addrLines = doc.splitTextToSize(serviceAddress, pageW / 2 - margin - 4);
  doc.text(addrLines, pageW / 2, y);
  y += 5;
  doc.text(inv.customer_email || "", margin, y);
  y += 10;

  // Itemized table — read from line_items first, fall back to legacy services
  const services: any[] =
    Array.isArray(inv.line_items) && inv.line_items.length > 0
      ? inv.line_items
      : Array.isArray(inv.services)
      ? inv.services
      : [];

  doc.setFont("helvetica", "bold");
  doc.setTextColor(...PRIMARY);
  doc.text("Itemized Breakdown", margin, y);
  doc.setTextColor(0, 0, 0);
  y += 6;

  const colItem = margin;
  const colQty = pageW - margin - 80;
  const colUnit = pageW - margin - 45;
  const colTotal = pageW - margin;

  doc.setFontSize(9);
  doc.setTextColor(...SLATE_500);
  doc.text("Item", colItem, y);
  doc.text("Qty", colQty, y, { align: "right" });
  doc.text("Unit", colUnit, y, { align: "right" });
  doc.text("Total", colTotal, y, { align: "right" });
  y += 2;
  doc.setDrawColor(...SLATE_300);
  doc.line(margin, y, pageW - margin, y);
  y += 4;
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  services.forEach((s: any) => {
    const qty = Number(s.quantity) || 1;
    const unit =
      s.unit_price != null && !isNaN(Number(s.unit_price))
        ? Number(s.unit_price)
        : Number(s.price) || 0;
    const total = Number(s.total_price) || Number(s.price) || qty * unit;
    // FIX: line items written by pricing engine use `name`. Legacy rows use `title`.
    const name = String(s.name || s.title || "Item");
    const nameLines = doc.splitTextToSize(name, colQty - colItem - 4);
    doc.text(nameLines[0], colItem, y);
    doc.text(String(qty), colQty, y, { align: "right" });
    doc.text(`$${unit.toFixed(2)}`, colUnit, y, { align: "right" });
    doc.text(`$${total.toFixed(2)}`, colTotal, y, { align: "right" });
    y += 5;
    for (let i = 1; i < nameLines.length; i++) {
      doc.text(nameLines[i], colItem, y);
      y += 5;
    }
  });

  doc.setDrawColor(...SLATE_300);
  doc.line(margin, y, pageW - margin, y);
  y += 5;

  // Totals — read directly from persisted row, never recalc
  const subtotal = Number(inv.subtotal) || 0;
  const taxRate = Number(inv.tax_rate) || 0;
  const taxAmount = Number(inv.tax_amount) || 0;
  const totalAmount = Number(inv.total_amount) || 0;
  const amountPaid = Number(inv.amount_paid) || 0;
  const balance = +(totalAmount - amountPaid).toFixed(2);

  doc.text("Subtotal", margin + 2, y);
  doc.text(`$${subtotal.toFixed(2)}`, colTotal, y, { align: "right" });
  y += 5;

  if (taxRate > 0 || taxAmount > 0) {
    doc.text(`Tax (${taxRate}%)`, margin + 2, y);
    doc.text(`$${taxAmount.toFixed(2)}`, colTotal, y, { align: "right" });
    y += 5;
  }

  // Total row — slate-100 fill behind navy bold text
  const totalRowY = y;
  doc.setFillColor(...SLATE_100);
  doc.rect(margin, totalRowY - 4, pageW - margin * 2, 8, "F");
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...PRIMARY);
  doc.text("Total", margin + 2, y + 1);
  doc.text(`$${totalAmount.toFixed(2)}`, colTotal, y + 1, { align: "right" });
  doc.setTextColor(0, 0, 0);
  y += 8;

  doc.setFont("helvetica", "normal");
  doc.text("Paid", margin + 2, y);
  doc.text(`$${amountPaid.toFixed(2)}`, colTotal, y, { align: "right" });
  y += 5;
  doc.setFont("helvetica", "bold");
  doc.text("Balance Due", margin + 2, y);
  doc.text(`$${balance.toFixed(2)}`, colTotal, y, { align: "right" });
  doc.setFont("helvetica", "normal");
  y += 10;

  // Payment details (when any payment recorded)
  if (inv.payment_status && inv.payment_status !== "unpaid") {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...PRIMARY);
    doc.text("Payment Details", margin, y);
    doc.setTextColor(0, 0, 0);
    y += 5;
    doc.setFont("helvetica", "normal");
    if (inv.payment_method) {
      doc.text(`Method: ${inv.payment_method}`, margin + 2, y);
      y += 5;
    }
    if (inv.payment_date) {
      doc.text(`Date Received: ${format(new Date(inv.payment_date), "MMM d, yyyy")}`, margin + 2, y);
      y += 5;
    }
    if (inv.payment_reference) {
      doc.text(`Reference #: ${inv.payment_reference}`, margin + 2, y);
      y += 5;
    }
    y += 5;
  }

  // Notes
  if (inv.notes) {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...PRIMARY);
    doc.text("Notes", margin, y);
    doc.setTextColor(0, 0, 0);
    y += 5;
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(String(inv.notes), pageW - margin * 2);
    lines.forEach((line: string) => {
      doc.text(line, margin, y);
      y += 5;
    });
    y += 5;
  }

  // Payment Instructions — sourced from site_settings.payment_methods (CMS-driven)
  const isPaid = inv.payment_status === "paid";
  if (!isPaid) {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...PRIMARY);
    doc.text("Payment Instructions", margin, y);
    doc.setTextColor(0, 0, 0);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const dynamicPay = String(
      settings.payment_methods ||
        "Pay via Zelle to info@blueriverservices.co. Cash also accepted on-site."
    );
    const payLines = [
      ...doc.splitTextToSize(dynamicPay, pageW - margin * 2),
      `Memo: Invoice #${invoiceNum}`,
    ];
    payLines.forEach((line: string) => {
      doc.text(line, margin, y);
      y += 5;
    });
    y += 4;
  }
  // Footer thank-you
  doc.setTextColor(...PRIMARY);
  doc.setFont("helvetica", "bold");
  doc.text("Thank you for choosing BlueRiver Services.", margin, Math.min(y + 4, pageH - 20));
  doc.setTextColor(0, 0, 0);

  // PAID watermark — applied LAST so it overlays content with low opacity
  if (inv.payment_status === "paid") {
    try {
      doc.saveGraphicsState();
      const GState = (doc as any).GState;
      if (GState) {
        doc.setGState(new GState({ opacity: 0.12 }));
      }
      doc.setTextColor(40, 130, 60);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(110);
      doc.text("PAID", pageW / 2, pageH / 2, { align: "center", angle: 30 });
      doc.restoreGraphicsState();
    } catch {
      // GState unsupported — skip watermark gracefully
    }
  }

  return doc;
};

export const generateInvoicePdf = (
  inv: any,
  branding: BrandingMap,
  settings: SettingsMap
) => {
  const doc = buildInvoiceDoc(inv, branding, settings);
  const invoiceNum = inv.invoice_number || `BR-${inv.id?.slice(0, 8).toUpperCase()}`;
  doc.save(`invoice-${invoiceNum}.pdf`);
};

/**
 * Builds the invoice PDF and returns a base64 string + filename suitable
 * for the `attachments` array of `send-transactional-email`.
 */
export const generateInvoicePdfBase64 = (
  inv: any,
  branding: BrandingMap,
  settings: SettingsMap
): { filename: string; base64: string } => {
  const doc = buildInvoiceDoc(inv, branding, settings);
  const idPart = (inv.invoice_number || inv.id?.slice(0, 8) || "INV").toString();
  const filename = `BlueRiver_Invoice_${idPart}.pdf`;
  const dataUri = doc.output("datauristring");
  const base64 = dataUri.split(",")[1] ?? "";
  return { filename, base64 };
};
