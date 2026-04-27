import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { FileText, Plus, DollarSign, Download, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import HasPermission from "@/components/HasPermission";
import { useFocusHighlight } from "@/hooks/useFocusHighlight";
import { generateInvoicePdf } from "@/lib/invoicePdf";

const statusColors: Record<string, string> = {
  unpaid: "bg-amber-100 text-amber-800",
  partial: "bg-blue-100 text-blue-800",
  paid: "bg-green-100 text-green-800",
};

const PAYMENT_METHODS = ["Cash", "Check", "Bank Transfer", "Square", "Zelle", "Other"] as const;

interface InvoiceForm {
  booking_id: string;
  payment_method: string;
  notes: string;
  due_date: string;
}

const emptyForm: InvoiceForm = {
  booking_id: "",
  payment_method: "",
  notes: "",
  due_date: "",
};

interface PaymentTarget {
  id: string;
  remaining: number;
  mode: "full" | "partial";
}

const InvoicesAdmin = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [paymentTarget, setPaymentTarget] = useState<PaymentTarget | null>(null);
  const [payMethod, setPayMethod] = useState<string>("Cash");
  const [payDate, setPayDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [payRef, setPayRef] = useState<string>("");
  const [payAmount, setPayAmount] = useState<string>("");
  const [form, setForm] = useState<InvoiceForm>({ ...emptyForm });

  const { data: invoices, isLoading } = useQuery({
    queryKey: ["admin-invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { getRef } = useFocusHighlight(!isLoading && !!invoices);

  const { data: serviceTypes } = useQuery({
    queryKey: ["service-types-for-invoice"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_types")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Bookings available for manual invoicing — those without an invoice yet.
  const { data: invoiceableBookings } = useQuery({
    queryKey: ["bookings-without-invoice"],
    queryFn: async () => {
      const { data: bks, error } = await supabase
        .from("bookings")
        .select("id, name, email, booking_date, service_type, total_price, source")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const { data: invs } = await supabase.from("invoices").select("booking_id");
      const taken = new Set((invs ?? []).map((i: any) => i.booking_id).filter(Boolean));
      return (bks ?? []).filter((b: any) => !taken.has(b.id));
    },
  });

  // Branding + settings for PDF (mirrors QuotesAdmin)
  const { data: branding } = useQuery({
    queryKey: ["branding-for-pdf"],
    queryFn: async () => {
      const { data } = await supabase.from("branding_settings").select("setting_key, setting_value");
      const map: Record<string, string> = {};
      data?.forEach((r) => (map[r.setting_key] = r.setting_value));
      return map;
    },
  });

  const { data: pdfSettings } = useQuery({
    queryKey: ["site-settings-for-pdf"],
    queryFn: async () => {
      const { data } = await supabase.from("site_settings").select("setting_key, setting_value");
      const map: Record<string, string> = {};
      data?.forEach((r) => (map[r.setting_key] = r.setting_value));
      return map;
    },
  });

  // SAFE-MODE: invoice creation is delegated to the database RPC.
  // The RPC snapshots line_items + totals from the booking — no client-side math.
  const createInvoice = useMutation({
    mutationFn: async () => {
      if (!form.booking_id) throw new Error("Booking is required");
      const { data: rpcResult, error } = await (supabase as any).rpc(
        "create_invoice_from_booking",
        { p_booking_id: form.booking_id },
      );
      if (error) throw error;
      const inv = rpcResult as any;

      // Optional metadata from the dialog (notes / payment_method / due_date)
      // are non-financial and applied via update — no totals are touched.
      const metaPatch: Record<string, any> = {};
      if (form.payment_method) metaPatch.payment_method = form.payment_method;
      if (form.notes) metaPatch.notes = form.notes;
      if (form.due_date) metaPatch.due_date = form.due_date;
      if (Object.keys(metaPatch).length > 0 && inv?.id) {
        const { error: patchErr } = await supabase
          .from("invoices")
          .update(metaPatch)
          .eq("id", inv.id)
          .select("id")
          .maybeSingle();
        if (patchErr) throw patchErr;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-invoices"] });
      qc.invalidateQueries({ queryKey: ["bookings-without-invoice"] });
      setOpen(false);
      setForm({ ...emptyForm });
      toast({ title: "Invoice created" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Single source of truth for ALL payment recording (full or partial).
  const applyPayment = useMutation({
    mutationFn: async (args: { id: string; amount: number; method: string; date: string; reference: string }) => {
      const inv = invoices?.find((i) => i.id === args.id);
      if (!inv) throw new Error("Invoice not found");
      if (!args.method) throw new Error("Payment method is required");
      if (!args.amount || args.amount <= 0) throw new Error("Amount must be greater than zero");

      const newPaid = +(Number(inv.amount_paid) + args.amount).toFixed(2);
      const total = Number(inv.total_amount);
      const isFullyPaid = newPaid >= total;
      const newStatus = isFullyPaid ? "paid" : newPaid > 0 ? "partial" : "unpaid";

      // Always record the payment metadata (method/date/reference + running total).
      const { data, error } = await supabase
        .from("invoices")
        .update({
          amount_paid: newPaid,
          payment_status: newStatus,
          payment_method: args.method,
          payment_date: args.date,
          payment_reference: args.reference || null,
        })
        .eq("id", args.id)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Update blocked by permissions or RLS");

      // SAFE-MODE: when fully paid, route through the DB RPC. It sets paid_at,
      // flips status, and auto-creates the receipt (idempotent — reused if exists).
      if (isFullyPaid) {
        const { error: paidError } = await (supabase as any).rpc("mark_invoice_paid", {
          p_invoice_id: args.id,
        });
        if (paidError) throw paidError;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-invoices"] });
      closePaymentDialog();
      toast({ title: "Payment recorded" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const openPaymentDialog = (inv: any, mode: "full" | "partial") => {
    const remaining = +(Number(inv.total_amount) - Number(inv.amount_paid)).toFixed(2);
    setPaymentTarget({ id: inv.id, remaining, mode });
    setPayMethod("Cash");
    setPayDate(format(new Date(), "yyyy-MM-dd"));
    setPayRef("");
    setPayAmount(mode === "partial" ? String(remaining) : "");
  };

  const closePaymentDialog = () => {
    setPaymentTarget(null);
    setPayMethod("Cash");
    setPayDate(format(new Date(), "yyyy-MM-dd"));
    setPayRef("");
    setPayAmount("");
  };

  const submitPayment = () => {
    if (!paymentTarget) return;
    const amount =
      paymentTarget.mode === "full" ? paymentTarget.remaining : Number(payAmount);
    applyPayment.mutate({
      id: paymentTarget.id,
      amount,
      method: payMethod,
      date: payDate,
      reference: payRef.trim(),
    });
  };

  const handleOpenChange = (o: boolean) => {
    setOpen(o);
    if (!o) setForm({ ...emptyForm });
  };

  const handleDownloadPdf = (inv: any) => {
    if (!branding || !pdfSettings) {
      toast({ title: "Loading branding…", description: "Please try again in a moment." });
      return;
    }
    generateInvoicePdf(inv, branding, pdfSettings);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" />
          <h1 className="text-2xl font-display font-bold text-foreground">Invoices</h1>
        </div>
        <HasPermission permission="can_manage_bookings">
          <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
              <Button variant="outline" onClick={() => setForm({ ...emptyForm })}>
                <Plus className="w-4 h-4 mr-2" /> Manual Invoice
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Manual Invoice</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <p className="text-xs text-muted-foreground">
                  Invoices are normally generated automatically when a booking is marked Completed. Use this only for manual adjustments.
                </p>
                <div>
                  <label className="text-sm font-medium mb-1 block">Service Type *</label>
                  <select
                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={form.service_type_id}
                    onChange={(e) => setForm({ ...form, service_type_id: e.target.value })}
                  >
                    <option value="">Select a service…</option>
                    {serviceTypes?.map((st) => (
                      <option key={st.id} value={st.id}>{st.name}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Customer Name *</label>
                    <Input value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Customer Email *</label>
                    <Input value={form.customer_email} onChange={(e) => setForm({ ...form, customer_email: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Subtotal ($)</label>
                    <Input type="number" min={0} step={0.01} value={form.subtotal} onChange={(e) => setForm({ ...form, subtotal: Number(e.target.value) })} />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Tax (%)</label>
                    <Input type="number" min={0} step={0.01} value={form.tax_rate} onChange={(e) => setForm({ ...form, tax_rate: Number(e.target.value) })} />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Due Date</label>
                    <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Payment Method</label>
                  <select
                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    value={form.payment_method}
                    onChange={(e) => setForm({ ...form, payment_method: e.target.value })}
                  >
                    <option value="">— None —</option>
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Notes</label>
                  <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
                </div>
                <Button
                  className="w-full"
                  onClick={() => createInvoice.mutate()}
                  disabled={!form.service_type_id || !form.customer_name || !form.customer_email || createInvoice.isPending}
                >
                  Create Invoice
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </HasPermission>
      </div>
      <p className="text-sm text-muted-foreground mb-6">Invoices are automatically generated when a booking is marked as Completed.</p>

      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : !invoices?.length ? (
        <p className="text-muted-foreground">No invoices yet. Complete a booking to generate one.</p>
      ) : (
        <div className="space-y-3">
          {invoices.map((inv) => (
            <div
              key={inv.id}
              ref={getRef(inv.id)}
              className="bg-card border border-border rounded-xl p-4 space-y-3 scroll-mt-24"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-foreground">{inv.customer_name}</h3>
                    {(inv as any).invoice_number && (
                      <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground font-mono">
                        {(inv as any).invoice_number}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{inv.customer_email}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColors[inv.payment_status] || "bg-muted text-muted-foreground"}`}>
                  {inv.payment_status}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Subtotal:</span>
                  <p className="font-medium text-foreground">${Number((inv as any).subtotal || 0).toFixed(2)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Tax:</span>
                  <p className="font-medium text-foreground">${Number((inv as any).tax_amount || 0).toFixed(2)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Total:</span>
                  <p className="font-medium text-foreground">${Number(inv.total_amount).toFixed(2)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Paid:</span>
                  <p className="font-medium text-foreground">${Number(inv.amount_paid).toFixed(2)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Issued:</span>
                  <p className="font-medium text-foreground">{format(new Date(inv.issued_date), "MMM d, yyyy")}</p>
                </div>
              </div>
              {inv.payment_status !== "unpaid" && (inv.payment_method || (inv as any).payment_date || (inv as any).payment_reference) && (
                <p className="text-sm text-muted-foreground">
                  <span className="text-foreground font-medium">Payment:</span>{" "}
                  {[
                    inv.payment_method,
                    (inv as any).payment_date ? format(new Date((inv as any).payment_date), "MMM d, yyyy") : null,
                    (inv as any).payment_reference ? `Ref ${(inv as any).payment_reference}` : null,
                  ].filter(Boolean).join(" · ")}
                </p>
              )}
              {inv.notes && (
                <p className="text-sm text-muted-foreground"><span className="text-foreground font-medium">Notes:</span> {inv.notes}</p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => handleDownloadPdf(inv)}>
                  <Download className="w-3 h-3 mr-1" /> Download PDF
                </Button>
                {inv.payment_status !== "paid" && (
                  <HasPermission permission="can_manage_bookings">
                    <Button variant="outline" size="sm" onClick={() => openPaymentDialog(inv, "full")}>
                      <CheckCircle2 className="w-3 h-3 mr-1" /> Mark Paid
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => openPaymentDialog(inv, "partial")}>
                      <DollarSign className="w-3 h-3 mr-1" /> Add Payment
                    </Button>
                  </HasPermission>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Single PaymentDialog — handles both Mark Paid (full) and Add Payment (partial) */}
      <Dialog open={!!paymentTarget} onOpenChange={(o) => !o && closePaymentDialog()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {paymentTarget?.mode === "full" ? "Mark Invoice as Paid" : "Record Payment"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <p className="text-sm text-muted-foreground">
              Remaining balance: <span className="font-medium text-foreground">${paymentTarget?.remaining.toFixed(2)}</span>
            </p>
            <div>
              <label className="text-sm font-medium mb-1 block">Method *</label>
              <select
                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                value={payMethod}
                onChange={(e) => setPayMethod(e.target.value)}
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Date Received *</label>
              <Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Reference # <span className="text-muted-foreground font-normal">(optional)</span></label>
              <Input value={payRef} onChange={(e) => setPayRef(e.target.value)} placeholder="Check #, txn id, …" />
            </div>
            {paymentTarget?.mode === "partial" && (
              <div>
                <label className="text-sm font-medium mb-1 block">Amount *</label>
                <Input
                  type="number"
                  min={0.01}
                  step={0.01}
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                />
              </div>
            )}
            <Button
              className="w-full"
              onClick={submitPayment}
              disabled={
                applyPayment.isPending ||
                !payMethod ||
                !payDate ||
                (paymentTarget?.mode === "partial" && (!payAmount || Number(payAmount) <= 0))
              }
            >
              {paymentTarget?.mode === "full" ? "Confirm Payment" : "Record Payment"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InvoicesAdmin;
