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
}

interface BrandingMap {
  [key: string]: string;
}

interface SettingsMap {
  [key: string]: string;
}

const parsePrice = (p: any): number => {
  if (p == null) return 0;
  const num = parseFloat(String(p).replace(/[^0-9.]/g, ""));
  return isNaN(num) ? 0 : num;
};

export const generateQuotePdf = (
  quote: QuoteData,
  branding: BrandingMap,
  settings: SettingsMap,
  draft: QuoteDraft
) => {
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 20;
  let y = 20;

  // Header
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(branding.business_name || "BlueRiver Services LLC", margin, y);
  y += 6;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  const tagline = settings.footer_tagline || "Professional cleaning services";
  doc.text(tagline, margin, y);
  y += 5;
  const contactLine = [settings.phone, settings.email].filter(Boolean).join(" · ");
  if (contactLine) {
    doc.text(contactLine, margin, y);
    y += 6;
  }
  doc.setTextColor(0);

  doc.setDrawColor(200);
  doc.line(margin, y, pageW - margin, y);
  y += 10;

  // Quote header
  const validityDays = draft.validity_days ?? 7;
  const quoteNum = `Q-${format(new Date(quote.created_at), "yyyy")}-${quote.id.slice(0, 4).toUpperCase()}`;
  const issued = format(new Date(), "MMM d, yyyy");
  const validUntil = format(addDays(new Date(), validityDays), "MMM d, yyyy");

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(`QUOTE  #${quoteNum}`, margin, y);
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
  doc.text("Service Details", margin, y);
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

  // Pricing
  doc.setFont("helvetica", "bold");
  doc.text("Pricing", margin, y);
  y += 6;
  doc.setFont("helvetica", "normal");

  const base = Number(draft.base_price ?? 0);
  const addons = Array.isArray(draft.addons) ? draft.addons : [];
  const discount = Number(draft.discount ?? 0);
  const taxRate = Number(draft.tax_rate ?? 0);
  const conditionMult = Number(draft.condition_multiplier ?? 1);
  const manualAdj = Number(draft.manual_adjustment ?? 0);

  doc.text("Base", margin + 2, y);
  doc.text(`$${base.toFixed(2)}`, pageW - margin, y, { align: "right" });
  y += 5;

  const adjustedBase = base * conditionMult;
  if (conditionMult !== 1) {
    doc.text(`× Condition multiplier (${conditionMult})`, margin + 2, y);
    doc.text(`$${adjustedBase.toFixed(2)}`, pageW - margin, y, { align: "right" });
    y += 5;
  }

  let subtotal = adjustedBase;
  addons.forEach((a: any) => {
    const price = parsePrice(a.price);
    subtotal += price;
    doc.text(`Add-on: ${a.title || "Item"}`, margin + 2, y);
    doc.text(`$${price.toFixed(2)}`, pageW - margin, y, { align: "right" });
    y += 5;
  });

  if (manualAdj !== 0) {
    subtotal += manualAdj;
    const label = manualAdj >= 0 ? "Manual adjustment" : "Manual adjustment";
    doc.text(label, margin + 2, y);
    const sign = manualAdj >= 0 ? "" : "-";
    doc.text(`${sign}$${Math.abs(manualAdj).toFixed(2)}`, pageW - margin, y, { align: "right" });
    y += 5;
  }

  if (discount > 0) {
    subtotal -= discount;
    doc.text("Discount", margin + 2, y);
    doc.text(`-$${discount.toFixed(2)}`, pageW - margin, y, { align: "right" });
    y += 5;
  }

  doc.setDrawColor(220);
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
  doc.setDrawColor(200);
  doc.line(margin, y, pageW - margin, y);
  y += 5;
  doc.setFont("helvetica", "bold");
  doc.text("Total", margin + 2, y);
  doc.text(`$${total.toFixed(2)}`, pageW - margin, y, { align: "right" });
  y += 10;

  // Notes
  if (draft.notes) {
    doc.setFont("helvetica", "bold");
    doc.text("Notes", margin, y);
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
  doc.text("Availability", margin, y);
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
  doc.setTextColor(120);
  doc.text(`This quote is valid for ${validityDays} days.`, margin, y);
  y += 10;

  doc.setTextColor(0);
  doc.setFont("helvetica", "bold");
  doc.text("Thank you for choosing BlueRiver Services.", margin, y);

  doc.save(`quote-${quote.name.replace(/\s+/g, "-").toLowerCase()}-${quoteNum}.pdf`);
};
