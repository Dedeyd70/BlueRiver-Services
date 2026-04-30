// Centralized mailto: helpers for admin email workflows.
// Templates use literal %0D%0A line breaks so they paste directly into the URL.

export interface MailtoVars {
  name?: string | null;
  service?: string | null;
  date?: string | null;
}

const fillTemplate = (template: string, vars: MailtoVars): string => {
  return template
    .replace(/\[Name\]/g, vars.name?.trim() || "there")
    .replace(/\[Service\]/g, vars.service?.trim() || "your cleaning service")
    .replace(/\[Date\]/g, vars.date?.trim() || "the scheduled date");
};

/**
 * Open the user's default mail client with a prefilled message.
 * Body templates may contain raw `%0D%0A` sequences (already URL-encoded line breaks).
 */
export const openMailto = (opts: {
  to: string | null | undefined;
  subject: string;
  bodyTemplate: string;
  vars: MailtoVars;
}) => {
  const filledBody = fillTemplate(opts.bodyTemplate, opts.vars);
  const filledSubject = fillTemplate(opts.subject, opts.vars);
  // The subject still needs encoding; the body template already contains %0D%0A
  // so we only encode the [Name]-substituted segments via encodeURIComponent
  // applied to the *whole* body, then restore the literal %0D%0A.
  const encodedBody = encodeURIComponent(filledBody).replace(/%2520/g, "%20");
  const url = `mailto:${opts.to ?? ""}?subject=${encodeURIComponent(filledSubject)}&body=${encodedBody}`;
  window.location.href = url;
};

// ---- Templates (verbatim per spec) -----------------------------------------

export const MAIL_TEMPLATES = {
  bookingConfirmed: {
    subject: "Booking Confirmed - BlueRiver Services",
    body:
      "Hi [Name],\r\n\r\nWe are thrilled to confirm your booking for [Service] on [Date]. We look forward to providing you with excellent service!\r\n\r\nThank you,\r\nBlueRiver Team",
  },
  quoteInProgress: {
    subject: "Quote Request Received - BlueRiver Services",
    body:
      "Hi [Name],\r\n\r\nWe have received your quote request for [Service]. Our team is currently reviewing your details and will get back to you with a customized quote within 24 hours.\r\n\r\nThank you,\r\nBlueRiver Team",
  },
  quoteSend: {
    subject: "Your Quote from BlueRiver Services",
    body:
      "Hi [Name],\r\n\r\nThank you for considering BlueRiver Services. Please find your detailed quote attached to this email.\r\n\r\nLet us know if you have any questions!\r\n\r\nBest,\r\nBlueRiver Team",
  },
  invoiceSend: {
    subject: "Invoice from BlueRiver Services",
    body:
      "Hi [Name],\r\n\r\nThank you for choosing BlueRiver. Please find your invoice for the completed service attached.\r\n\r\nBest,\r\nBlueRiver Team",
  },
} as const;
