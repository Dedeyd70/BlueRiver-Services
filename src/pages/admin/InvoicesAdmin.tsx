import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { FileText, Plus, DollarSign, Download } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import jsPDF from "jspdf";

const statusColors: Record<string, string> = {
  unpaid: "bg-amber-100 text-amber-800",
  partial: "bg-blue-100 text-blue-800",
  paid: "bg-green-100 text-green-800",
};

interface InvoiceForm {
  service_type_id: string;
  customer_name: string;
  customer_email: string;
  services: { title: string; price: number }[];
  subtotal: number;
  tax_rate: number;
  payment_method: string;
  notes: string;
  due_date: string;
  booking_id: string | null;
}

const emptyForm: InvoiceForm = {
  service_type_id: "",
  customer_name: "",
  customer_email: "",
  services: [],
  subtotal: 0,
  tax_rate: 0,
  payment_method: "",
  notes: "",
  due_date: "",
  booking_id: null,
};

const generateInvoicePDF = (inv: any) => {
  const doc = new jsPDF();
  doc.setFontSize(18);
  doc.text("INVOICE", 20, 25);
  doc.setFontSize(11);
  if (inv.invoice_number) doc.text(`Invoice #: ${inv.invoice_number}`, 20, 33);
  doc.text(`Customer: ${inv.customer_name}`, 20, 44);
  doc.text(`Email: ${inv.customer_email}`, 20, 52);
  doc.text(`Issued: ${format(new Date(inv.issued_date), "MMM d, yyyy")}`, 20, 60);
  doc.text(`Due: ${inv.due_date ? format(new Date(inv.due_date), "MMM d, yyyy") : "N/A"}`, 20, 68);

  const services = Array.isArray(inv.services) ? inv.services : [];
  let y = 82;
  if (services.length) {
    doc.text("Services:", 20, y);
    services.forEach((s: any) => {
      y += 8;
      doc.text(`• ${s.title || "Item"} — $${Number(s.price || 0).toFixed(2)}`, 24, y);
    });
    y += 6;
  }

  doc.text(`Subtotal: $${Number(inv.subtotal || 0).toFixed(2)}`, 20, y); y += 8;
  doc.text(`Tax (${Number(inv.tax_rate || 0).toFixed(2)}%): $${Number(inv.tax_amount || 0).toFixed(2)}`, 20, y); y += 8;
  doc.setFontSize(13);
  doc.text(`Total: $${Number(inv.total_amount).toFixed(2)}`, 20, y); y += 8;
  doc.setFontSize(11);
  doc.text(`Paid: $${Number(inv.amount_paid).toFixed(2)}`, 20, y); y += 8;
  doc.text(`Status: ${inv.payment_status}`, 20, y); y += 8;
  if (inv.payment_method) { doc.text(`Method: ${inv.payment_method}`, 20, y); y += 8; }

  if (inv.notes) {
    doc.text(`Notes: ${inv.notes}`, 20, doc.internal.pageSize.height - 30);
  }

  doc.save(`invoice-${inv.invoice_number || inv.customer_name.replace(/\s+/g, "-").toLowerCase()}.pdf`);
};

const InvoicesAdmin = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
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

  const createInvoice = useMutation({
    mutationFn: async () => {
      if (!form.service_type_id) throw new Error("Service type is required");
      const taxAmount = +(form.subtotal * (form.tax_rate / 100)).toFixed(2);
      const totalAmount = +(form.subtotal + taxAmount).toFixed(2);
      const { error } = await supabase.from("invoices").insert({
        service_type_id: form.service_type_id,
        customer_name: form.customer_name,
        customer_email: form.customer_email,
        services: form.services as any,
        subtotal: form.subtotal,
        tax_rate: form.tax_rate,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        payment_method: form.payment_method || null,
        notes: form.notes || null,
        due_date: form.due_date || null,
        booking_id: form.booking_id || null,
        created_by: user?.id || null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-invoices"] });
      setOpen(false);
      setForm({ ...emptyForm });
      toast({ title: "Invoice created" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const recordPayment = useMutation({
    mutationFn: async ({ id, amount }: { id: string; amount: number }) => {
      const invoice = invoices?.find((i) => i.id === id);
      if (!invoice) throw new Error("Invoice not found");
      const newPaid = Number(invoice.amount_paid) + amount;
      const newStatus = newPaid >= Number(invoice.total_amount) ? "paid" : newPaid > 0 ? "partial" : "unpaid";
      const { error } = await supabase
        .from("invoices")
        .update({ amount_paid: newPaid, payment_status: newStatus })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-invoices"] });
      setPaymentOpen(null);
      setPaymentAmount("");
      toast({ title: "Payment recorded" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const markPaid = useMutation({
    mutationFn: async (id: string) => {
      const invoice = invoices?.find((i) => i.id === id);
      if (!invoice) return;
      const { error } = await supabase
        .from("invoices")
        .update({ amount_paid: invoice.total_amount, payment_status: "paid" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-invoices"] });
      toast({ title: "Invoice marked as paid" });
    },
  });

  const handleOpenChange = (o: boolean) => {
    setOpen(o);
    if (!o) setForm({ ...emptyForm });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" />
          <h1 className="text-2xl font-display font-bold text-foreground">Invoices</h1>
        </div>
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
                <Input value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })} placeholder="Cash, Zelle, etc." />
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
      </div>
      <p className="text-sm text-muted-foreground mb-6">Invoices are automatically generated when a booking is marked as Completed.</p>

      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : !invoices?.length ? (
        <p className="text-muted-foreground">No invoices yet. Complete a booking to generate one.</p>
      ) : (
        <div className="space-y-3">
          {invoices.map((inv) => (
            <div key={inv.id} className="bg-card border border-border rounded-xl p-4 space-y-3">
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
              {inv.payment_method && (
                <p className="text-sm text-muted-foreground"><span className="text-foreground font-medium">Method:</span> {inv.payment_method}</p>
              )}
              {inv.notes && (
                <p className="text-sm text-muted-foreground"><span className="text-foreground font-medium">Notes:</span> {inv.notes}</p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => generateInvoicePDF(inv)}>
                  <Download className="w-3 h-3 mr-1" /> Download PDF
                </Button>
                {inv.payment_status !== "paid" && (
                  <>
                    <Button variant="outline" size="sm" onClick={() => markPaid.mutate(inv.id)}>
                      Mark Paid
                    </Button>
                    <Dialog open={paymentOpen === inv.id} onOpenChange={(o) => { setPaymentOpen(o ? inv.id : null); setPaymentAmount(""); }}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <DollarSign className="w-3 h-3 mr-1" /> Add Payment
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-sm">
                        <DialogHeader>
                          <DialogTitle>Record Payment</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-3 mt-2">
                          <p className="text-sm text-muted-foreground">
                            Remaining: ${(Number(inv.total_amount) - Number(inv.amount_paid)).toFixed(2)}
                          </p>
                          <Input
                            type="number"
                            min={0.01}
                            step={0.01}
                            placeholder="Amount"
                            value={paymentAmount}
                            onChange={(e) => setPaymentAmount(e.target.value)}
                          />
                          <Button
                            className="w-full"
                            onClick={() => recordPayment.mutate({ id: inv.id, amount: Number(paymentAmount) })}
                            disabled={!paymentAmount || Number(paymentAmount) <= 0}
                          >
                            Record Payment
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default InvoicesAdmin;
