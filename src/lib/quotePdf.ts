import jsPDF from "jspdf";
import { format, addDays } from "date-fns";

interface QuoteData {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  address?: string | null;
  created_at: string;
}

export interface QuoteDraft {
  service_type?: string | null;
  scope?: string | null;
  base_price?: number | null;
  addons?: any;
  discount?: number | null;
  tax_rate?: number | null;
  notes?: string | null;
  validity_days?: number | null;
  condition_multiplier?: number | null;
  manual_adjustment?: number | null;
  breakdown?: any;
  line_items?: any;
}

interface BrandingMap { [key: string]: string }
interface SettingsMap { [key: string]: string }

// ---- BlueRiver theme (defaults; brand color overridable via site_settings.brand_color_hex) ----
const NAVY: [number, number, number] = [15, 23, 42];
const DEFAULT_PRIMARY: [number, number, number] = [30, 58, 138];
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
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pageW, bandH, "F");

  const badgeX = 14;
  const badgeY = 6;
  const badgeSize = 16;
  doc.setFillColor(...PRIMARY);
  doc.roundedRect(badgeX, badgeY, badgeSize, badgeSize, 3, 3, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("BR", badgeX + badgeSize / 2, badgeY + badgeSize / 2 + 1.5, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(255, 255, 255);
  doc.text(branding.business_name || "BlueRiver Services LLC", badgeX + badgeSize + 6, 13);

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

  doc.setTextColor(0, 0, 0);
  return bandH + 8;
};

/**
 * Branded quote PDF builder. Returns the configured jsPDF instance.
 *
 * NOTE (cost-efficiency): `compress: true` keeps attachments small for the
 * Resend free tier. If a raster logo is added later, use
 * `addImage(..., 'JPEG', ..., 'FAST')` with quality ~0.6.
 */
const buildQuoteDoc = (
  quote: QuoteData,
  branding: BrandingMap,
  settings: SettingsMap,
  draft: QuoteDraft
): jsPDF => {
  const doc = new jsPDF({ compress: true });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 20;
  const PRIMARY = resolvePrimary(settings);
  let y = drawLetterhead(doc, pageW, branding, settings);

  // Quote header
  const validityDays = draft.validity_days ?? 7;
  const quoteNum = `Q-${format(new Date(quote.created_at), "yyyy")}-${quote.id.slice(0, 4).toUpperCase()}`;
  const issued = format(new Date(), "MMM d, yyyy");
  const validUntil = format(addDays(new Date(), validityDays), "MMM d, yyyy");

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...PRIMARY);
  doc.text(`QUOTE  #${quoteNum}`, margin, y);
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Issued: ${issued}`, pageW - margin, y - 4, { align: "right" });
  doc.text(`Valid until: ${validUntil}`, pageW - margin, y + 2, { align: "right" });
  y += 12;

  // Bill to / Service location
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Bill to:", margin, y);
  doc.text("Service location:", pageW / 2, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.text(quote.name, margin, y);
  doc.text(quote.address || "—", pageW / 2, y);
  y += 5;
  doc.text(quote.email, margin, y);
  if (quote.phone) {
    y += 5;
    doc.text(quote.phone, margin, y);
  }
  y += 10;

  // Service Details
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...PRIMARY);
  doc.text("Service Details", margin, y);
  doc.setTextColor(0, 0, 0);
  y += 6;
  doc.setFont("helvetica", "normal");
  if (draft.service_type) {
    doc.text(`• ${draft.service_type}`, margin + 2, y);
    y += 5;
  }
  if (draft.scope) {
    const lines = doc.splitTextToSize(draft.scope, pageW - margin * 2 - 4);
    lines.forEach((line: string) => {
      doc.text(line, margin + 2, y);
      y += 5;
    });
  }
  y += 5;

  const lineItems = Array.isArray(draft.line_items) ? draft.line_items : [];
  const taxRate = Number(draft.tax_rate ?? 0);

  if (lineItems.length > 0) {
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

    let subtotal = 0;
    lineItems.forEach((it: any) => {
      const qty = Number(it.quantity) || 0;
      const unit = Number(it.unit_price) || 0;
      const total = Number(it.total_price) || qty * unit;
      subtotal += total;
      // FIX: prefer engine-written `name`, fall back to legacy `title`.
      const name = String(it.name || it.title || "Item");
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
    doc.text("Subtotal", margin + 2, y);
    doc.text(`$${subtotal.toFixed(2)}`, colTotal, y, { align: "right" });
    y += 5;

    const taxAmount = subtotal * (taxRate / 100);
    if (taxRate > 0) {
      doc.text(`Tax (${taxRate}%)`, margin + 2, y);
      doc.text(`$${taxAmount.toFixed(2)}`, colTotal, y, { align: "right" });
      y += 5;
    }

    const total = subtotal + taxAmount;
    // Total row with slate-100 fill + navy bold text
    doc.setFillColor(...SLATE_100);
    doc.rect(margin, y - 4, pageW - margin * 2, 8, "F");
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...PRIMARY);
    doc.text("Total", margin + 2, y + 1);
    doc.text(`$${total.toFixed(2)}`, colTotal, y + 1, { align: "right" });
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "normal");
    y += 12;
  } else {
    // Legacy fallback (also fix label)
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...PRIMARY);
    doc.text("Pricing", margin, y);
    doc.setTextColor(0, 0, 0);
    y += 6;
    doc.setFont("helvetica", "normal");
    const base = Number(draft.base_price ?? 0);
    const addons = Array.isArray(draft.addons) ? draft.addons : [];
    const discount = Number(draft.discount ?? 0);
    doc.text("Base", margin + 2, y);
    doc.text(`$${base.toFixed(2)}`, pageW - margin, y, { align: "right" });
    y += 5;
    let subtotal = base;
    addons.forEach((a: any) => {
      const price = Number(a?.price) || 0;
      subtotal += price;
      doc.text(`Add-on: ${a.name || a.title || "Item"}`, margin + 2, y);
      doc.text(`$${price.toFixed(2)}`, pageW - margin, y, { align: "right" });
      y += 5;
    });
    if (discount > 0) {
      subtotal -= discount;
      doc.text("Discount", margin + 2, y);
      doc.text(`-$${discount.toFixed(2)}`, pageW - margin, y, { align: "right" });
      y += 5;
    }
    doc.line(margin, y, pageW - margin, y);
    y += 5;
    doc.text("Subtotal", margin + 2, y);
    doc.text(`$${subtotal.toFixed(2)}`, pageW - margin, y, { align: "right" });
    y += 5;
    const taxAmount = subtotal * (taxRate / 100);
    if (taxRate > 0) {
      doc.text(`Tax (${taxRate}%)`, margin + 2, y);
      doc.text(`$${taxAmount.toFixed(2)}`, pageW - margin, y, { align: "right" });
      y += 5;
    }
    const total = subtotal + taxAmount;
    doc.setFillColor(...SLATE_100);
    doc.rect(margin, y - 4, pageW - margin * 2, 8, "F");
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...PRIMARY);
    doc.text("Total", margin + 2, y + 1);
    doc.text(`$${total.toFixed(2)}`, pageW - margin, y + 1, { align: "right" });
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "normal");
    y += 12;
  }

  // Notes
  if (draft.notes) {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...PRIMARY);
    doc.text("Notes", margin, y);
    doc.setTextColor(0, 0, 0);
    y += 5;
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(draft.notes, pageW - margin * 2);
    lines.forEach((line: string) => {
      doc.text(line, margin, y);
      y += 5;
    });
    y += 5;
  }

  // Availability
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...PRIMARY);
  doc.text("Availability", margin, y);
  doc.setTextColor(0, 0, 0);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.text("Scheduling will be confirmed upon acceptance.", margin + 2, y);
  y += 10;

  // CTA
  doc.setFont("helvetica", "italic");
  const cta = doc.splitTextToSize(
    "To proceed, please reply to this message or confirm your booking with us.",
    pageW - margin * 2
  );
  cta.forEach((line: string) => {
    doc.text(line, margin, y);
    y += 5;
  });
  y += 4;

  doc.setFont("helvetica", "normal");
  doc.setTextColor(...SLATE_500);
  doc.text(`This quote is valid for ${validityDays} days.`, margin, y);
  y += 10;

  doc.setTextColor(...PRIMARY);
  doc.setFont("helvetica", "bold");
  doc.text("Thank you for choosing BlueRiver Services.", margin, y);
  doc.setTextColor(0, 0, 0);

  return doc;
};

export const generateQuotePdf = (
  quote: QuoteData,
  branding: BrandingMap,
  settings: SettingsMap,
  draft: QuoteDraft
) => {
  const doc = buildQuoteDoc(quote, branding, settings, draft);
  const validityDays = draft.validity_days ?? 7;
  const quoteNum = `Q-${format(new Date(quote.created_at), "yyyy")}-${quote.id.slice(0, 4).toUpperCase()}`;
  // validityDays referenced to mirror naming; not used in filename.
  void validityDays;
  doc.save(`quote-${quote.name.replace(/\s+/g, "-").toLowerCase()}-${quoteNum}.pdf`);
};

/**
 * Builds the quote PDF and returns a base64 string + filename for use in
 * the `attachments` array of `send-transactional-email`.
 */
export const generateQuotePdfBase64 = (
  quote: QuoteData,
  branding: BrandingMap,
  settings: SettingsMap,
  draft: QuoteDraft
): { filename: string; base64: string } => {
  const doc = buildQuoteDoc(quote, branding, settings, draft);
  const idPart = quote.id?.slice(0, 8).toUpperCase() ?? "QUOTE";
  const filename = `BlueRiver_Quote_${idPart}.pdf`;
  const dataUri = doc.output("datauristring");
  const base64 = dataUri.split(",")[1] ?? "";
  return { filename, base64 };
};
