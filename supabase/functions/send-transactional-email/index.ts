// Resend-powered transactional email sender for BlueRiver Services.
// Public endpoint (no JWT) so booking & quote forms can trigger emails.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const FROM = "BlueRiver Services <info@blueriverservices.co>";
const REPLY_TO = "info@blueriverservices.co";

type Payload = {
  type: "booking_confirmation" | "quote_received" | "custom";
  to: string;
  data?: Record<string, unknown>;
  subject?: string;
  html?: string;
};

const esc = (v: unknown) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const wrap = (title: string, inner: string) => `
<!doctype html><html><body style="margin:0;background:#f4f7fb;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
  <div style="max-width:560px;margin:0 auto;padding:32px 16px;">
    <div style="background:#1e40af;color:#fff;padding:20px 24px;border-radius:12px 12px 0 0;">
      <h1 style="margin:0;font-size:20px;font-weight:600;">BlueRiver Services</h1>
    </div>
    <div style="background:#fff;padding:28px 24px;border-radius:0 0 12px 12px;border:1px solid #e2e8f0;border-top:0;">
      <h2 style="margin:0 0 12px;font-size:18px;color:#0f172a;">${esc(title)}</h2>
      ${inner}
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;"/>
      <p style="margin:0;font-size:13px;color:#64748b;">Questions? Reply to this email or contact us at <a href="mailto:info@blueriverservices.co" style="color:#1e40af;">info@blueriverservices.co</a>.</p>
    </div>
    <p style="text-align:center;font-size:12px;color:#94a3b8;margin:16px 0 0;">© ${new Date().getFullYear()} BlueRiver Services</p>
  </div>
</body></html>`;

const detailRow = (k: string, v: unknown) =>
  v
    ? `<tr><td style="padding:6px 0;color:#64748b;font-size:14px;">${esc(k)}</td><td style="padding:6px 0;color:#0f172a;font-size:14px;font-weight:500;">${esc(v)}</td></tr>`
    : "";

function bookingTemplate(d: Record<string, unknown>) {
  const inner = `
    <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">Hi ${esc(d.name) || "there"}, thanks for booking with BlueRiver Services! We've received your request and will confirm shortly.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      ${detailRow("Service", d.service)}
      ${detailRow("Date", d.date)}
      ${detailRow("Time", d.timeSlot)}
      ${detailRow("Address", d.address)}
      ${d.total ? detailRow("Estimated total", `$${Number(d.total).toFixed(2)}`) : ""}
    </table>
    <p style="margin:16px 0 0;font-size:14px;color:#64748b;">A team member will reach out within 24 hours to confirm details.</p>`;
  return { subject: "Your BlueRiver booking request", html: wrap("Booking received", inner) };
}

function quoteTemplate(d: Record<string, unknown>) {
  const inner = `
    <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">Hi ${esc(d.name) || "there"}, thanks for requesting a quote from BlueRiver Services. We've got your details and will reply within 24 hours.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      ${detailRow("Service", d.service)}
      ${detailRow("Address", d.address)}
    </table>`;
  return { subject: "Your BlueRiver quote request", html: wrap("Quote request received", inner) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("RESEND_API_KEY");
    if (!apiKey) throw new Error("RESEND_API_KEY not configured");

    const body = (await req.json()) as Payload;
    if (!body?.to || !body?.type) {
      return new Response(JSON.stringify({ error: "Missing 'to' or 'type'" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let subject = body.subject ?? "";
    let html = body.html ?? "";
    const data = body.data ?? {};

    if (body.type === "booking_confirmation") {
      const t = bookingTemplate(data);
      subject ||= t.subject;
      html ||= t.html;
    } else if (body.type === "quote_received") {
      const t = quoteTemplate(data);
      subject ||= t.subject;
      html ||= t.html;
    }

    if (!subject || !html) {
      return new Response(JSON.stringify({ error: "Missing subject/html for custom type" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: [body.to],
        reply_to: REPLY_TO,
        subject,
        html,
      }),
    });

    const result = await res.json();
    if (!res.ok) {
      console.error("Resend error:", res.status, result);
      return new Response(JSON.stringify({ error: result }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ id: result?.id ?? null }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-transactional-email failed:", err);
    return new Response(JSON.stringify({ error: String(err?.message ?? err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
