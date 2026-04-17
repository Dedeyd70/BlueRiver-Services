import jsPDF from "jspdf";
import { format, addDays } from "date-fns";

interface QuoteData {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  address?: string | null;
  service_type?: string | null;
  description?: string | null;
  selected_addons?: any;
  created_at: string;
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
  settings: SettingsMap
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

  // Divider
  doc.setDrawColor(200);
  doc.line(margin, y, pageW - margin, y);
  y += 10;

  // Quote header
  const quoteNum = `Q-${format(new Date(quote.created_at), "yyyy")}-${quote.id.slice(0, 4).toUpperCase()}`;
  const issued = format(new Date(quote.created_at), "MMM d, yyyy");
  const validUntil = format(addDays(new Date(quote.created_at), 7), "MMM d, yyyy");

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
  if (quote.service_type) {
    doc.text(`• ${quote.service_type}`, margin + 2, y);
    y += 5;
  }
  if (quote.description) {
    const lines = doc.splitTextToSize(quote.description, pageW - margin * 2 - 4);
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

  const addons = Array.isArray(quote.selected_addons) ? quote.selected_addons : [];
  let subtotal = 0;

  doc.text("Base", margin + 2, y);
  doc.text("$0.00", pageW - margin, y, { align: "right" });
  y += 5;

  addons.forEach((a: any) => {
    const price = parsePrice(a.price);
    subtotal += price;
    doc.text(`Add-on: ${a.title}`, margin + 2, y);
    doc.text(`$${price.toFixed(2)}`, pageW - margin, y, { align: "right" });
    y += 5;
  });

  doc.setDrawColor(200);
  doc.line(margin, y, pageW - margin, y);
  y += 5;
  doc.setFont("helvetica", "bold");
  doc.text("Total", margin + 2, y);
  doc.text(`$${subtotal.toFixed(2)}`, pageW - margin, y, { align: "right" });
  y += 10;

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
  doc.text("This quote is valid for 7 days.", margin, y);
  y += 10;

  // Footer
  doc.setTextColor(0);
  doc.setFont("helvetica", "bold");
  doc.text("Thank you for choosing BlueRiver Services.", margin, y);

  doc.save(`quote-${quote.name.replace(/\s+/g, "-").toLowerCase()}-${quoteNum}.pdf`);
};
