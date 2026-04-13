import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { FileText, Plus, DollarSign } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const statusColors: Record<string, string> = {
  unpaid: "bg-amber-100 text-amber-800",
  partial: "bg-blue-100 text-blue-800",
  paid: "bg-green-100 text-green-800",
};

interface InvoiceForm {
  customer_name: string;
  customer_email: string;
  services: { title: string; price: number }[];
  total_amount: number;
  payment_method: string;
  notes: string;
  due_date: string;
  booking_id: string | null;
  quote_id: string | null;
}

const emptyForm: InvoiceForm = {
  customer_name: "",
  customer_email: "",
  services: [],
  total_amount: 0,
  payment_method: "",
  notes: "",
  due_date: "",
  booking_id: null,
  quote_id: null,
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

  const { data: bookings } = useQuery({
    queryKey: ["admin-bookings-for-invoice"],
    queryFn: async () => {
      const { data } = await supabase
        .from("bookings")
        .select("id, name, email, service_type, total_price, selected_addons, booking_date")
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  const { data: quotes } = useQuery({
    queryKey: ["admin-quotes-for-invoice"],
    queryFn: async () => {
      const { data } = await supabase
        .from("quote_requests")
        .select("id, name, email, service_type, selected_addons")
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  const createInvoice = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("invoices").insert({
        customer_name: form.customer_name,
        customer_email: form.customer_email,
        services: form.services as any,
        total_amount: form.total_amount,
        payment_method: form.payment_method || null,
        notes: form.notes || null,
        due_date: form.due_date || null,
        booking_id: form.booking_id || null,
        quote_id: form.quote_id || null,
        created_by: user?.id || null,
      });
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

  const prefillFromBooking = (bookingId: string) => {
    const b = bookings?.find((x) => x.id === bookingId);
    if (!b) return;
    const addons = Array.isArray(b.selected_addons) ? (b.selected_addons as any[]) : [];
    const services = [
      ...(b.service_type ? [{ title: b.service_type, price: 0 }] : []),
      ...addons.map((a: any) => ({ title: a.title || "", price: a.price || 0 })),
    ];
    setForm({
      ...form,
      customer_name: b.name,
      customer_email: b.email,
      services,
      total_amount: Number(b.total_price) || 0,
      booking_id: b.id,
      quote_id: null,
    });
  };

  const prefillFromQuote = (quoteId: string) => {
    const q = quotes?.find((x) => x.id === quoteId);
    if (!q) return;
    const addons = Array.isArray(q.selected_addons) ? (q.selected_addons as any[]) : [];
    const services = [
      ...(q.service_type ? [{ title: q.service_type, price: 0 }] : []),
      ...addons.map((a: any) => ({ title: a.title || "", price: a.price || 0 })),
    ];
    setForm({
      ...form,
      customer_name: q.name,
      customer_email: q.email,
      services,
      total_amount: 0,
      booking_id: null,
      quote_id: q.id,
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" />
          <h1 className="text-2xl font-display font-bold text-foreground">Invoices</h1>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setForm({ ...emptyForm })}>
              <Plus className="w-4 h-4 mr-2" /> New Invoice
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Invoice</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div>
                <label className="text-sm font-medium mb-1 block">Pre-fill from Booking</label>
                <Select onValueChange={prefillFromBooking}>
                  <SelectTrigger><SelectValue placeholder="Select a booking..." /></SelectTrigger>
                  <SelectContent>
                    {bookings?.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name} — {b.service_type || "No service"} ({format(new Date(b.booking_date), "MMM d")})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Pre-fill from Quote</label>
                <Select onValueChange={prefillFromQuote}>
                  <SelectTrigger><SelectValue placeholder="Select a quote..." /></SelectTrigger>
                  <SelectContent>
                    {quotes?.map((q) => (
                      <SelectItem key={q.id} value={q.id}>
                        {q.name} — {q.service_type || "No service"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium mb-1 block">Total Amount ($)</label>
                  <Input type="number" min={0} step={0.01} value={form.total_amount} onChange={(e) => setForm({ ...form, total_amount: Number(e.target.value) })} />
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
                disabled={!form.customer_name || !form.customer_email || createInvoice.isPending}
              >
                Create Invoice
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : !invoices?.length ? (
        <p className="text-muted-foreground">No invoices yet. Create one from a booking or quote.</p>
      ) : (
        <div className="space-y-3">
          {invoices.map((inv) => (
            <div key={inv.id} className="bg-card border border-border rounded-xl p-4 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="font-medium text-foreground">{inv.customer_name}</h3>
                  <p className="text-sm text-muted-foreground">{inv.customer_email}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColors[inv.payment_status] || "bg-muted text-muted-foreground"}`}>
                  {inv.payment_status}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
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
                <div>
                  <span className="text-muted-foreground">Due:</span>
                  <p className="font-medium text-foreground">{inv.due_date ? format(new Date(inv.due_date), "MMM d, yyyy") : "—"}</p>
                </div>
              </div>
              {inv.payment_method && (
                <p className="text-sm text-muted-foreground"><span className="text-foreground font-medium">Method:</span> {inv.payment_method}</p>
              )}
              {inv.notes && (
                <p className="text-sm text-muted-foreground"><span className="text-foreground font-medium">Notes:</span> {inv.notes}</p>
              )}
              <div className="flex flex-wrap gap-2">
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
